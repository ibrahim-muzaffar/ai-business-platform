const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const {
  createCustomerRepository,
} = require("../../repositories/postgres/customerRepository");
const {
  createLeadRepository,
} = require("../../repositories/postgres/leadRepository");

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for PostgreSQL repository integration tests.",
  );
}

const db = knex({
  client: "pg",
  connection: process.env.TEST_DATABASE_URL,
});

test.after(async () => {
  await db.destroy();
});

const IDS = {
  organisationA: "30000000-0000-0000-0000-000000000001",
  organisationB: "30000000-0000-0000-0000-000000000002",
  businessA: "30000000-0000-0000-0000-000000000011",
  businessB: "30000000-0000-0000-0000-000000000012",
  serviceA: "30000000-0000-0000-0000-000000000021",
  serviceB: "30000000-0000-0000-0000-000000000022",
  conversationA: "30000000-0000-0000-0000-000000000031",
  conversationB: "30000000-0000-0000-0000-000000000032",
  customerAFirst: "30000000-0000-0000-0000-000000000041",
  customerASecond: "30000000-0000-0000-0000-000000000042",
  customerB: "30000000-0000-0000-0000-000000000043",
  leadAOlder: "30000000-0000-0000-0000-000000000051",
  leadANewer: "30000000-0000-0000-0000-000000000052",
  leadB: "30000000-0000-0000-0000-000000000053",
};

function assertIdentityAndTimestamps(record) {
  assert.match(record.id, /^[0-9a-f-]{36}$/i);
  assert.ok(record.createdAt instanceof Date);
  assert.ok(record.updatedAt instanceof Date);
}

async function expectCreateLeadError(trx, input, expectedCode) {
  await assert.rejects(
    trx.transaction(async (savepoint) => {
      await createLeadRepository(savepoint).createLead(input);
    }),
    (error) => error?.code === expectedCode,
  );
}

test("PostgreSQL customer and lead repositories map, default and isolate data", async () => {
  const rollbackSignal = new Error("rollback customer and lead fixtures");
  const generatedIds = [];

  await assert.rejects(
    db.transaction(async (trx) => {
      await trx("organisations").insert([
        { id: IDS.organisationA, name: "Organisation A" },
        { id: IDS.organisationB, name: "Organisation B" },
      ]);
      await trx("businesses").insert([
        {
          id: IDS.businessA,
          organisation_id: IDS.organisationA,
          business_type: "barber",
          name: "Business A",
          timezone: "Europe/London",
        },
        {
          id: IDS.businessB,
          organisation_id: IDS.organisationB,
          business_type: "barber",
          name: "Business B",
          timezone: "Europe/London",
        },
      ]);
      await trx("services").insert([
        {
          id: IDS.serviceA,
          business_id: IDS.businessA,
          name: "Business A service",
        },
        {
          id: IDS.serviceB,
          business_id: IDS.businessB,
          name: "Business B service",
        },
      ]);
      await trx("conversations").insert([
        { id: IDS.conversationA, business_id: IDS.businessA },
        { id: IDS.conversationB, business_id: IDS.businessB },
      ]);
      await trx("customers").insert([
        {
          id: IDS.customerAFirst,
          business_id: IDS.businessA,
          name: "Shared Contact First",
          phone: "07000 000001",
          email: "shared@example.test",
          created_at: "2026-01-01T09:00:00.000Z",
          updated_at: "2026-01-01T09:00:00.000Z",
        },
        {
          id: IDS.customerASecond,
          business_id: IDS.businessA,
          name: "Shared Contact Second",
          phone: "07000 000001",
          email: "shared@example.test",
          created_at: "2026-01-02T09:00:00.000Z",
          updated_at: "2026-01-02T09:00:00.000Z",
        },
        {
          id: IDS.customerB,
          business_id: IDS.businessB,
          name: "Other Tenant Contact",
          phone: "07000 000001",
          email: "shared@example.test",
        },
      ]);

      const customers = createCustomerRepository(trx);
      const leads = createLeadRepository(trx);

      const createdCustomer = await customers.createCustomer({
        businessId: IDS.businessA,
        name: "Created Customer",
        phone: null,
        email: "created@example.test",
        preferences: { contactMethod: "email" },
      });
      generatedIds.push(createdCustomer.id);
      assert.equal(createdCustomer.businessId, IDS.businessA);
      assert.equal(createdCustomer.phone, null);
      assert.deepEqual(createdCustomer.preferences, {
        contactMethod: "email",
      });
      assert.equal(Object.hasOwn(createdCustomer, "business_id"), false);
      assertIdentityAndTimestamps(createdCustomer);

      const defaultPreferencesCustomer = await customers.createCustomer({
        businessId: IDS.businessA,
        name: "Default Preferences Customer",
      });
      generatedIds.push(defaultPreferencesCustomer.id);
      assert.deepEqual(defaultPreferencesCustomer.preferences, {});

      assert.equal(
        (await customers.findByIdForBusiness(
          IDS.businessA,
          createdCustomer.id,
        )).id,
        createdCustomer.id,
      );
      assert.equal(
        await customers.findByIdForBusiness(
          IDS.businessB,
          createdCustomer.id,
        ),
        null,
      );
      assert.equal(
        (await customers.findFirstByPhoneForBusiness(
          IDS.businessA,
          "07000 000001",
        )).id,
        IDS.customerAFirst,
      );
      assert.equal(
        (await customers.findFirstByEmailForBusiness(
          IDS.businessA,
          "shared@example.test",
        )).id,
        IDS.customerAFirst,
      );
      assert.equal(
        (await customers.findFirstByPhoneForBusiness(
          IDS.businessB,
          "07000 000001",
        )).id,
        IDS.customerB,
      );
      const businessACustomers = await customers.listByBusinessId(
        IDS.businessA,
      );
      assert.equal(businessACustomers.length, 4);
      assert.equal(
        businessACustomers.some(({ id }) => id === IDS.customerB),
        false,
      );

      const defaultLead = await leads.createLead({
        businessId: IDS.businessA,
        customerId: createdCustomer.id,
        serviceId: IDS.serviceA,
        conversationId: IDS.conversationA,
        requestedService: "Haircut",
        requestedDate: "2026-08-15",
        requestedTime: "14:30:00",
      });
      generatedIds.push(defaultLead.id);
      assert.equal(defaultLead.businessId, IDS.businessA);
      assert.equal(defaultLead.customerId, createdCustomer.id);
      assert.equal(defaultLead.serviceId, IDS.serviceA);
      assert.equal(defaultLead.conversationId, IDS.conversationA);
      assert.equal(defaultLead.sourceChannel, "website");
      assert.equal(defaultLead.enquiryType, "general");
      assert.equal(defaultLead.status, "new");
      assert.equal(defaultLead.requestedDate, "2026-08-15");
      assert.equal(defaultLead.requestedTime, "14:30:00");
      assert.equal(Object.hasOwn(defaultLead, "business_id"), false);
      assertIdentityAndTimestamps(defaultLead);

      const nullLead = await leads.createLead({
        businessId: IDS.businessA,
        customerId: null,
        serviceId: null,
        conversationId: null,
        requestedService: null,
        requestedDate: null,
        requestedTime: null,
        requestedDateText: "22 July 2026",
        requestedTimeText: "2:30 pm",
      });
      generatedIds.push(nullLead.id);
      assert.equal(nullLead.customerId, null);
      assert.equal(nullLead.serviceId, null);
      assert.equal(nullLead.conversationId, null);
      assert.equal(nullLead.requestedService, null);
      assert.equal(nullLead.requestedDate, null);
      assert.equal(nullLead.requestedTime, null);
      assert.equal(nullLead.requestedDateText, "22 July 2026");
      assert.equal(nullLead.requestedTimeText, "2:30 pm");

      await trx("leads").insert([
        {
          id: IDS.leadAOlder,
          business_id: IDS.businessA,
          customer_id: IDS.customerAFirst,
          status: "new",
        },
        {
          id: IDS.leadANewer,
          business_id: IDS.businessA,
          customer_id: IDS.customerAFirst,
          status: "contacted",
        },
        {
          id: IDS.leadB,
          business_id: IDS.businessB,
          customer_id: IDS.customerB,
          status: "new",
        },
      ]);

      await trx("leads")
        .where({ id: nullLead.id })
        .update({ created_at: "2026-04-04T12:00:00.000Z" });
      await trx("leads")
        .where({ id: defaultLead.id })
        .update({ created_at: "2026-04-03T12:00:00.000Z" });
      await trx("leads")
        .whereIn("id", [IDS.leadAOlder, IDS.leadANewer])
        .update({ created_at: "2026-04-02T12:00:00.000Z" });

      assert.equal(
        (await leads.findByIdForBusiness(IDS.businessA, defaultLead.id)).id,
        defaultLead.id,
      );
      assert.equal(
        await leads.findByIdForBusiness(IDS.businessB, defaultLead.id),
        null,
      );

      assert.deepEqual(
        (await leads.listByBusinessId(IDS.businessA)).map(({ id }) => id),
        [nullLead.id, defaultLead.id, IDS.leadANewer, IDS.leadAOlder],
      );
      assert.deepEqual(
        (await leads.listByStatusForBusiness(
          IDS.businessA,
          "contacted",
        )).map(({ id }) => id),
        [IDS.leadANewer],
      );
      assert.deepEqual(
        (await leads.listByCustomerForBusiness(
          IDS.businessA,
          IDS.customerAFirst,
        )).map(({ id }) => id),
        [IDS.leadANewer, IDS.leadAOlder],
      );

      await expectCreateLeadError(
        trx,
        { businessId: IDS.businessA, customerId: IDS.customerB },
        "23503",
      );
      await expectCreateLeadError(
        trx,
        { businessId: IDS.businessA, serviceId: IDS.serviceB },
        "23503",
      );
      await expectCreateLeadError(
        trx,
        { businessId: IDS.businessA, conversationId: IDS.conversationB },
        "23503",
      );
      await expectCreateLeadError(
        trx,
        { businessId: IDS.businessA, sourceChannel: "carrier_pigeon" },
        "23514",
      );
      await expectCreateLeadError(
        trx,
        { businessId: IDS.businessA, status: "pending" },
        "23514",
      );
      await expectCreateLeadError(
        trx,
        { businessId: IDS.businessA, requestedDateText: "   " },
        "23514",
      );
      await expectCreateLeadError(
        trx,
        { businessId: IDS.businessA, requestedTimeText: "  " },
        "23514",
      );

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  const fixedIds = Object.values(IDS);
  for (const table of [
    "organisations",
    "businesses",
    "services",
    "conversations",
    "customers",
    "leads",
  ]) {
    const [{ count }] = await db(table)
      .whereIn("id", [...fixedIds, ...generatedIds])
      .count("* as count");
    assert.equal(Number(count), 0);
  }
});
