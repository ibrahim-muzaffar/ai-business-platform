const { mapOrganisation } = require("./mappers");

function createOrganisationRepository(db) {
  async function findById(organisationId) {
    const row = await db("organisations")
      .where({ id: organisationId })
      .first();
    return mapOrganisation(row);
  }

  return { findById };
}

module.exports = { createOrganisationRepository };
