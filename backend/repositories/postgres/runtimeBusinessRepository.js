const {
  getDatabaseConnection: defaultGetDatabaseConnection,
} = require("../../db/connection");
const { createBusinessRepository } = require("./businessRepository");
const { createServiceRepository } = require("./serviceRepository");
const {
  createOpeningHoursRepository,
} = require("./openingHoursRepository");
const { createPolicyRepository } = require("./policyRepository");

const DEFAULT_CONFIGURED_BUSINESS_IDS = Object.freeze({
  barber: "10000000-0000-0000-0000-000000000011",
});

const PAYMENT_METHODS_PREFIX = "Accepted payment methods:";

function normaliseBusinessType(businessType) {
  return typeof businessType === "string"
    ? businessType.trim().toLowerCase()
    : "";
}

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

function formatTime(time) {
  return typeof time === "string" ? time.slice(0, 5) : null;
}

function mapOpeningHours(openingHoursRows) {
  const openingHours = {};

  for (const row of openingHoursRows) {
    if (row.closed) {
      openingHours[row.dayOfWeek] = "Closed";
      continue;
    }

    const openingTime = formatTime(row.openingTime);
    const closingTime = formatTime(row.closingTime);

    if (openingTime && closingTime) {
      openingHours[row.dayOfWeek] = `${openingTime}-${closingTime}`;
    }
  }

  return openingHours;
}

function formatGbpPrice(price) {
  if (price === null || price === undefined) return null;
  return `£${String(price).replace(/\.00$/, "")}`;
}

function mapServices(serviceRows) {
  return serviceRows.map((service) => ({
    name: service.name,
    price: formatGbpPrice(service.price),
  }));
}

function mapPolicies(policyRows) {
  const policies = {};

  for (const policy of policyRows) {
    if (policy.category === "walk_ins") {
      policies.walkIns = policy.content;
    } else if (policy.category === "cancellations") {
      policies.cancellations = policy.content;
    } else if (policy.category === "student_discount") {
      policies.studentDiscount = policy.content;
    } else if (
      policy.category === "payment_methods" &&
      policy.content.startsWith(PAYMENT_METHODS_PREFIX)
    ) {
      policies.paymentMethods = policy.content
        .slice(PAYMENT_METHODS_PREFIX.length)
        .replace(/\.$/, "")
        .split(",")
        .map((method) => method.trim())
        .filter(Boolean);
    }
  }

  return policies;
}

function createRuntimeBusinessRepository({
  db,
  getDatabaseConnection = defaultGetDatabaseConnection,
  configuredBusinessIds = DEFAULT_CONFIGURED_BUSINESS_IDS,
} = {}) {
  const configuredBusinesses = createConfiguredBusinessMap(
    configuredBusinessIds,
  );

  function isBusinessConfigured(businessType) {
    return configuredBusinesses.has(normaliseBusinessType(businessType));
  }

  async function getBusinessData(businessType) {
    const selectedBusinessType = normaliseBusinessType(businessType);
    const businessId = configuredBusinesses.get(selectedBusinessType);

    if (!businessId) return null;

    const connection = db ?? getDatabaseConnection?.("development");
    if (!connection) {
      throw new Error("A database connection is required for business data.");
    }

    const businesses = createBusinessRepository(connection);
    const business = await businesses.findById(businessId);

    if (
      !business ||
      business.status !== "active" ||
      normaliseBusinessType(business.businessType) !== selectedBusinessType
    ) {
      return null;
    }

    const services = createServiceRepository(connection);
    const openingHours = createOpeningHoursRepository(connection);
    const policies = createPolicyRepository(connection);
    const serviceRows = await services.listActiveByBusinessId(businessId);
    const openingHoursRows = await openingHours.listByBusinessId(businessId);
    const policyRows = await policies.listActiveByBusinessId(businessId);

    return {
      businessType: business.businessType,
      name: business.name,
      description: business.description,
      address: business.address,
      phone: business.phone,
      email: business.email,
      website: business.website,
      openingHours: mapOpeningHours(openingHoursRows),
      services: mapServices(serviceRows),
      policies: mapPolicies(policyRows),
    };
  }

  return {
    getBusinessData,
    isBusinessConfigured,
    normaliseBusinessType,
  };
}

const defaultRepository = createRuntimeBusinessRepository();

module.exports = {
  DEFAULT_CONFIGURED_BUSINESS_IDS,
  createRuntimeBusinessRepository,
  getBusinessData: defaultRepository.getBusinessData,
  isBusinessConfigured: defaultRepository.isBusinessConfigured,
  normaliseBusinessType: defaultRepository.normaliseBusinessType,
};
