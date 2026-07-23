const { mapService } = require("./mappers");

function createServiceRepository(db) {
  async function findByIdForBusiness(businessId, serviceId) {
    const row = await db("services")
      .where({ business_id: businessId, id: serviceId })
      .first();
    return mapService(row);
  }

  async function listByBusinessId(businessId) {
    const rows = await db("services")
      .where({ business_id: businessId })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
    return rows.map(mapService);
  }

  async function listActiveByBusinessId(businessId) {
    const rows = await db("services")
      .where({ business_id: businessId, active: true })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
    return rows.map(mapService);
  }

  return {
    findByIdForBusiness,
    listActiveByBusinessId,
    listByBusinessId,
  };
}

module.exports = { createServiceRepository };
