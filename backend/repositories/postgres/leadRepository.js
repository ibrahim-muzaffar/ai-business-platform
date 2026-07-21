const { mapLead } = require("./mappers");

const OPTIONAL_COLUMNS = {
  customerId: "customer_id",
  serviceId: "service_id",
  conversationId: "conversation_id",
  sourceChannel: "source_channel",
  enquiryType: "enquiry_type",
  status: "status",
  requestedService: "requested_service",
  requestedDate: "requested_date",
  requestedTime: "requested_time",
};

function createLeadRepository(db) {
  function selectedLeads() {
    return db("leads").select(
      "leads.id",
      "leads.business_id",
      "leads.customer_id",
      "leads.service_id",
      "leads.conversation_id",
      "leads.source_channel",
      "leads.enquiry_type",
      "leads.status",
      "leads.requested_service",
      "leads.created_at",
      "leads.updated_at",
      db.raw('"leads"."requested_date"::text AS "requested_date"'),
      db.raw('"leads"."requested_time"::text AS "requested_time"'),
    );
  }

  async function createLead(input) {
    const values = { business_id: input.businessId };

    for (const [inputName, columnName] of Object.entries(OPTIONAL_COLUMNS)) {
      if (input[inputName] !== undefined) {
        values[columnName] = input[inputName];
      }
    }

    const [inserted] = await db("leads")
      .insert(values)
      .returning(["id", "business_id"]);
    const row = await selectedLeads()
      .where({
        "leads.business_id": inserted.business_id,
        "leads.id": inserted.id,
      })
      .first();
    return mapLead(row);
  }

  async function findByIdForBusiness(businessId, leadId) {
    const row = await selectedLeads()
      .where({
        "leads.business_id": businessId,
        "leads.id": leadId,
      })
      .first();
    return mapLead(row);
  }

  function orderedBusinessQuery(businessId) {
    return selectedLeads()
      .where({ "leads.business_id": businessId })
      .orderBy("leads.created_at", "desc")
      .orderBy("leads.id", "desc");
  }

  async function listByBusinessId(businessId) {
    const rows = await orderedBusinessQuery(businessId);
    return rows.map(mapLead);
  }

  async function listByStatusForBusiness(businessId, status) {
    const rows = await orderedBusinessQuery(businessId).where({ status });
    return rows.map(mapLead);
  }

  async function listByCustomerForBusiness(businessId, customerId) {
    const rows = await orderedBusinessQuery(businessId).where({
      customer_id: customerId,
    });
    return rows.map(mapLead);
  }

  return {
    createLead,
    findByIdForBusiness,
    listByBusinessId,
    listByCustomerForBusiness,
    listByStatusForBusiness,
  };
}

module.exports = { createLeadRepository };
