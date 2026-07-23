const { mapBusiness } = require("./mappers");

function createBusinessRepository(db) {
  async function findById(businessId) {
    const row = await db("businesses").where({ id: businessId }).first();
    return mapBusiness(row);
  }

  async function findByIdForOrganisation(organisationId, businessId) {
    const row = await db("businesses")
      .where({ organisation_id: organisationId, id: businessId })
      .first();
    return mapBusiness(row);
  }

  async function listByOrganisationId(organisationId) {
    const rows = await db("businesses")
      .where({ organisation_id: organisationId })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
    return rows.map(mapBusiness);
  }

  return {
    findById,
    findByIdForOrganisation,
    listByOrganisationId,
  };
}

module.exports = { createBusinessRepository };
