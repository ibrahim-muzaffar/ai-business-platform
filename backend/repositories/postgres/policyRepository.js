const { mapPolicy } = require("./mappers");

function createPolicyRepository(db) {
  async function findByIdForBusiness(businessId, policyId) {
    const row = await db("policies")
      .where({ business_id: businessId, id: policyId })
      .first();
    return mapPolicy(row);
  }

  async function listByBusinessId(businessId) {
    const rows = await db("policies")
      .where({ business_id: businessId })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
    return rows.map(mapPolicy);
  }

  async function listActiveByBusinessId(businessId) {
    const rows = await db("policies")
      .where({ business_id: businessId, active: true })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
    return rows.map(mapPolicy);
  }

  return {
    findByIdForBusiness,
    listActiveByBusinessId,
    listByBusinessId,
  };
}

module.exports = { createPolicyRepository };
