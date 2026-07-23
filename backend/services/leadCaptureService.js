const {
  getDatabaseConnection: defaultGetDatabaseConnection,
} = require("../db/connection");
const {
  DEFAULT_CONFIGURED_BUSINESS_IDS,
  normaliseBusinessType,
} = require("../repositories/postgres/runtimeBusinessRepository");
const {
  createBusinessRepository,
} = require("../repositories/postgres/businessRepository");
const {
  createCustomerRepository,
} = require("../repositories/postgres/customerRepository");
const {
  createLeadRepository,
} = require("../repositories/postgres/leadRepository");

const DEFAULT_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

function createConfiguredBusinessMap(configuredBusinessIds) {
  const entries =
    configuredBusinessIds instanceof Map
      ? configuredBusinessIds.entries()
      : Object.entries(configuredBusinessIds);

  return new Map(
    [...entries].map(([businessType, businessId]) => [
      normaliseBusinessType(businessType),
      businessId,
    ]),
  );
}

function normaliseIdentity(lead) {
  const name =
    typeof lead?.name === "string" ? lead.name.trim().toLowerCase() : "";
  const phoneDigits =
    typeof lead?.phone === "string" ? lead.phone.replace(/\D/g, "") : "";

  if (!name || !phoneDigits) {
    throw new Error("A customer name and phone number are required.");
  }

  return { name, phoneDigits };
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Stored lead has an invalid creation timestamp.");
  }
  return date.toISOString();
}

function mapLegacyLead({ businessType, customer, lead }) {
  if (!customer) {
    throw new Error("Stored lead customer is unavailable.");
  }

  return {
    id: lead.id,
    name: customer.name,
    phone: customer.phone,
    ...(customer.email ? { email: customer.email } : {}),
    service: lead.requestedService,
    preferredDate: lead.requestedDateText ?? lead.requestedDate,
    preferredTime: lead.requestedTimeText ?? lead.requestedTime,
    businessType,
    createdAt: toIsoString(lead.createdAt),
    status: lead.status,
  };
}

function createLeadCaptureService({
  db,
  getDatabaseConnection = defaultGetDatabaseConnection,
  configuredBusinessIds = DEFAULT_CONFIGURED_BUSINESS_IDS,
  duplicateWindowMs = DEFAULT_DUPLICATE_WINDOW_MS,
  now = () => new Date(),
} = {}) {
  const configuredBusinesses = createConfiguredBusinessMap(
    configuredBusinessIds,
  );

  function getConnection() {
    const connection = db ?? getDatabaseConnection?.("development");
    if (!connection) {
      throw new Error("A database connection is required for lead capture.");
    }
    return connection;
  }

  async function saveLead(lead) {
    const businessType = normaliseBusinessType(lead?.businessType);
    const businessId = configuredBusinesses.get(businessType);
    if (!businessId) {
      throw new Error("Lead capture is not configured for this business type.");
    }

    const identity = normaliseIdentity(lead);
    const connection = getConnection();

    return connection.transaction(async (trx) => {
      const businesses = createBusinessRepository(trx);
      const business = await businesses.findById(businessId);
      if (
        !business ||
        business.status !== "active" ||
        normaliseBusinessType(business.businessType) !== businessType
      ) {
        throw new Error("Configured business is unavailable for lead capture.");
      }

      const lockIdentity = `${businessId}:${identity.name}:${identity.phoneDigits}`;
      await trx.raw(
        "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
        [lockIdentity],
      );

      const customers = createCustomerRepository(trx);
      const leads = createLeadRepository(trx);
      let customer =
        await customers.findFirstByNormalisedIdentityForBusiness(
          businessId,
          identity,
        );

      if (!customer) {
        customer = await customers.createCustomer({
          businessId,
          name: lead.name,
          phone: lead.phone,
          ...(lead.email ? { email: lead.email } : {}),
        });
      } else if (!customer.email && lead.email) {
        customer =
          (await customers.fillMissingEmailForBusiness(
            businessId,
            customer.id,
            lead.email,
          )) ?? customer;
      }

      const currentTime = new Date(now());
      if (Number.isNaN(currentTime.getTime())) {
        throw new Error("The lead capture clock returned an invalid value.");
      }
      const duplicate = await leads.findRecentDuplicateForBusiness({
        businessId,
        customerId: customer.id,
        requestedService: lead.service,
        requestedDateText: lead.preferredDate,
        requestedTimeText: lead.preferredTime,
        createdAfter: new Date(currentTime.getTime() - duplicateWindowMs),
      });

      if (duplicate) {
        return {
          created: false,
          lead: mapLegacyLead({ businessType, customer, lead: duplicate }),
        };
      }

      const storedLead = await leads.createLead({
        id: lead.id,
        businessId,
        customerId: customer.id,
        serviceId: null,
        conversationId: lead.conversationId ?? null,
        sourceChannel: "website",
        status: lead.status,
        requestedService: lead.service,
        requestedDate: null,
        requestedTime: null,
        requestedDateText: lead.preferredDate,
        requestedTimeText: lead.preferredTime,
      });

      return {
        created: true,
        lead: mapLegacyLead({ businessType, customer, lead: storedLead }),
      };
    });
  }

  async function getAllLeads() {
    const connection = getConnection();
    const businesses = createBusinessRepository(connection);
    const customers = createCustomerRepository(connection);
    const leads = createLeadRepository(connection);
    const mappedLeads = [];

    for (const [businessType, businessId] of configuredBusinesses) {
      const business = await businesses.findById(businessId);
      if (
        !business ||
        business.status !== "active" ||
        normaliseBusinessType(business.businessType) !== businessType
      ) {
        throw new Error("Configured business is unavailable for lead reads.");
      }

      for (const lead of await leads.listByBusinessId(businessId)) {
        const customer = lead.customerId
          ? await customers.findByIdForBusiness(businessId, lead.customerId)
          : null;
        mappedLeads.push(mapLegacyLead({ businessType, customer, lead }));
      }
    }

    return mappedLeads.sort((first, second) => {
      const timestampDifference =
        Date.parse(first.createdAt) - Date.parse(second.createdAt);
      return timestampDifference || first.id.localeCompare(second.id);
    });
  }

  return { getAllLeads, saveLead };
}

const defaultService = createLeadCaptureService();

module.exports = {
  createLeadCaptureService,
  getAllLeads: defaultService.getAllLeads,
  saveLead: defaultService.saveLead,
};
