const { mapCustomer } = require("./mappers");

function createCustomerRepository(db) {
  async function createCustomer(input) {
    const values = {
      business_id: input.businessId,
      name: input.name,
      preferences:
        input.preferences === undefined ? {} : input.preferences,
    };

    if (input.phone !== undefined) values.phone = input.phone;
    if (input.email !== undefined) values.email = input.email;

    const [row] = await db("customers").insert(values).returning("*");
    return mapCustomer(row);
  }

  async function findByIdForBusiness(businessId, customerId) {
    const row = await db("customers")
      .where({ business_id: businessId, id: customerId })
      .first();
    return mapCustomer(row);
  }

  async function findFirstByPhoneForBusiness(businessId, phone) {
    const row = await db("customers")
      .where({ business_id: businessId, phone })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .first();
    return mapCustomer(row);
  }

  async function findFirstByEmailForBusiness(businessId, email) {
    const row = await db("customers")
      .where({ business_id: businessId, email })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .first();
    return mapCustomer(row);
  }

  async function listByBusinessId(businessId) {
    const rows = await db("customers")
      .where({ business_id: businessId })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
    return rows.map(mapCustomer);
  }

  return {
    createCustomer,
    findByIdForBusiness,
    findFirstByEmailForBusiness,
    findFirstByPhoneForBusiness,
    listByBusinessId,
  };
}

module.exports = { createCustomerRepository };
