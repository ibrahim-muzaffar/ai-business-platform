const { mapOrganisationMembership } = require("./mappers");

function createOrganisationMembershipRepository(db) {
  function orderedQuery() {
    return db("organisation_memberships")
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
  }

  async function createMembership(input) {
    const [row] = await db("organisation_memberships")
      .insert({
        organisation_id: input.organisationId,
        user_id: input.userId,
        role: input.role,
        status: input.status,
      })
      .returning("*");
    return mapOrganisationMembership(row);
  }

  async function findById(organisationId, membershipId) {
    const row = await db("organisation_memberships")
      .where({ organisation_id: organisationId, id: membershipId })
      .first();
    return mapOrganisationMembership(row);
  }

  async function findByOrganisationAndUser(organisationId, userId) {
    const row = await db("organisation_memberships")
      .where({ organisation_id: organisationId, user_id: userId })
      .first();
    return mapOrganisationMembership(row);
  }

  async function findActiveByOrganisationAndUser(organisationId, userId) {
    const row = await db("organisation_memberships")
      .where({
        organisation_id: organisationId,
        user_id: userId,
        status: "active",
      })
      .first();
    return mapOrganisationMembership(row);
  }

  async function listByUserId(userId) {
    const rows = await orderedQuery().where({ user_id: userId });
    return rows.map(mapOrganisationMembership);
  }

  async function listActiveByUserId(userId) {
    const rows = await orderedQuery().where({
      user_id: userId,
      status: "active",
    });
    return rows.map(mapOrganisationMembership);
  }

  async function listByOrganisationId(organisationId) {
    const rows = await orderedQuery().where({
      organisation_id: organisationId,
    });
    return rows.map(mapOrganisationMembership);
  }

  async function updateRole(organisationId, membershipId, role) {
    const [row] = await db("organisation_memberships")
      .where({ organisation_id: organisationId, id: membershipId })
      .update({ role, updated_at: db.fn.now() })
      .returning("*");
    return mapOrganisationMembership(row);
  }

  async function updateStatus(organisationId, membershipId, status) {
    const [row] = await db("organisation_memberships")
      .where({ organisation_id: organisationId, id: membershipId })
      .update({ status, updated_at: db.fn.now() })
      .returning("*");
    return mapOrganisationMembership(row);
  }

  return {
    createMembership,
    findActiveByOrganisationAndUser,
    findById,
    findByOrganisationAndUser,
    listActiveByUserId,
    listByOrganisationId,
    listByUserId,
    updateRole,
    updateStatus,
  };
}

module.exports = { createOrganisationMembershipRepository };
