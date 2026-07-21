const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const {
  createBusinessRepository,
} = require("../../repositories/postgres/businessRepository");
const {
  createOpeningHoursRepository,
} = require("../../repositories/postgres/openingHoursRepository");
const {
  createPolicyRepository,
} = require("../../repositories/postgres/policyRepository");
const {
  createServiceRepository,
} = require("../../repositories/postgres/serviceRepository");

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
  organisationA: "20000000-0000-0000-0000-000000000001",
  organisationB: "20000000-0000-0000-0000-000000000002",
  businessA: "20000000-0000-0000-0000-000000000011",
  businessASecond: "20000000-0000-0000-0000-000000000012",
  businessB: "20000000-0000-0000-0000-000000000013",
  activeService: "20000000-0000-0000-0000-000000000021",
  inactiveService: "20000000-0000-0000-0000-000000000022",
  otherBusinessService: "20000000-0000-0000-0000-000000000023",
  activePolicy: "20000000-0000-0000-0000-000000000031",
  inactivePolicy: "20000000-0000-0000-0000-000000000032",
};

const OPENING_HOUR_IDS = [
  "20000000-0000-0000-0000-000000000041",
  "20000000-0000-0000-0000-000000000042",
  "20000000-0000-0000-0000-000000000043",
  "20000000-0000-0000-0000-000000000044",
  "20000000-0000-0000-0000-000000000045",
  "20000000-0000-0000-0000-000000000046",
  "20000000-0000-0000-0000-000000000047",
];

function assertIdentityAndTimestamps(record) {
  assert.match(record.id, /^[0-9a-f-]{36}$/i);
  assert.ok(record.createdAt instanceof Date);
  assert.ok(record.updatedAt instanceof Date);
}

test("PostgreSQL business configuration repositories map and isolate reads", async () => {
  const rollbackSignal = new Error("rollback repository integration fixtures");

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
          name: "Repository Barbers",
          description: "Repository integration fixture",
          phone: "01234 567890",
          email: "hello@example.test",
          website: "https://example.test",
          address: { line1: "10 Test Street", city: "Teston" },
          timezone: "Europe/London",
          created_at: "2026-01-01T09:00:00.000Z",
          updated_at: "2026-01-01T09:00:00.000Z",
        },
        {
          id: IDS.businessASecond,
          organisation_id: IDS.organisationA,
          business_type: "barber",
          name: "Second Organisation A Business",
          timezone: "Europe/London",
          created_at: "2026-01-02T09:00:00.000Z",
          updated_at: "2026-01-02T09:00:00.000Z",
        },
        {
          id: IDS.businessB,
          organisation_id: IDS.organisationB,
          business_type: "barber",
          name: "Other Tenant Barbers",
          timezone: "Europe/London",
          created_at: "2026-01-03T09:00:00.000Z",
          updated_at: "2026-01-03T09:00:00.000Z",
        },
      ]);

      await trx("services").insert([
        {
          id: IDS.activeService,
          business_id: IDS.businessA,
          name: "Haircut",
          price: "25.50",
          duration_minutes: 30,
          active: true,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
        },
        {
          id: IDS.inactiveService,
          business_id: IDS.businessA,
          name: "Retired service",
          price: null,
          active: false,
          created_at: "2026-01-02T10:00:00.000Z",
          updated_at: "2026-01-02T10:00:00.000Z",
        },
        {
          id: IDS.otherBusinessService,
          business_id: IDS.businessB,
          name: "Other tenant service",
          price: "15.00",
          active: true,
        },
      ]);

      const shuffledDays = [
        "thursday",
        "monday",
        "sunday",
        "tuesday",
        "saturday",
        "wednesday",
        "friday",
      ];
      await trx("opening_hours").insert(
        shuffledDays.map((dayOfWeek, index) => ({
          id: OPENING_HOUR_IDS[index],
          business_id: IDS.businessA,
          day_of_week: dayOfWeek,
          opening_time: dayOfWeek === "sunday" ? null : "09:00:00",
          closing_time: dayOfWeek === "sunday" ? null : "17:00:00",
          closed: dayOfWeek === "sunday",
        })),
      );

      await trx("policies").insert([
        {
          id: IDS.activePolicy,
          business_id: IDS.businessA,
          category: "bookings",
          title: "Walk-ins",
          content: "Walk-ins are welcome.",
          active: true,
          created_at: "2026-01-01T11:00:00.000Z",
          updated_at: "2026-01-01T11:00:00.000Z",
        },
        {
          id: IDS.inactivePolicy,
          business_id: IDS.businessA,
          category: "discounts",
          title: "Old discount",
          content: "This policy is inactive.",
          active: false,
          created_at: "2026-01-02T11:00:00.000Z",
          updated_at: "2026-01-02T11:00:00.000Z",
        },
      ]);

      const businesses = createBusinessRepository(trx);
      const services = createServiceRepository(trx);
      const openingHours = createOpeningHoursRepository(trx);
      const policies = createPolicyRepository(trx);

      const business = await businesses.findById(IDS.businessA);
      assert.equal(business.id, IDS.businessA);
      assert.equal(business.organisationId, IDS.organisationA);
      assert.equal(business.businessType, "barber");
      assert.deepEqual(business.address, {
        line1: "10 Test Street",
        city: "Teston",
      });
      assert.equal(Object.hasOwn(business, "organisation_id"), false);
      assertIdentityAndTimestamps(business);

      assert.equal(
        await businesses.findByIdForOrganisation(
          IDS.organisationB,
          IDS.businessA,
        ),
        null,
      );
      assert.deepEqual(
        (await businesses.listByOrganisationId(IDS.organisationA)).map(
          ({ id }) => id,
        ),
        [IDS.businessA, IDS.businessASecond],
      );

      const service = await services.findByIdForBusiness(
        IDS.businessA,
        IDS.activeService,
      );
      assert.equal(service.businessId, IDS.businessA);
      assert.equal(service.price, "25.50");
      assert.equal(typeof service.price, "string");
      assert.equal(service.durationMinutes, 30);
      assertIdentityAndTimestamps(service);
      assert.equal(
        await services.findByIdForBusiness(
          IDS.businessB,
          IDS.activeService,
        ),
        null,
      );
      assert.deepEqual(
        (await services.listByBusinessId(IDS.businessA)).map(({ id }) => id),
        [IDS.activeService, IDS.inactiveService],
      );
      assert.deepEqual(
        (await services.listActiveByBusinessId(IDS.businessA)).map(
          ({ id }) => id,
        ),
        [IDS.activeService],
      );

      const hours = await openingHours.listByBusinessId(IDS.businessA);
      assert.deepEqual(
        hours.map(({ dayOfWeek }) => dayOfWeek),
        [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
      );
      hours.forEach(assertIdentityAndTimestamps);

      const policy = await policies.findByIdForBusiness(
        IDS.businessA,
        IDS.activePolicy,
      );
      assert.equal(policy.businessId, IDS.businessA);
      assertIdentityAndTimestamps(policy);
      assert.equal(
        await policies.findByIdForBusiness(
          IDS.businessB,
          IDS.activePolicy,
        ),
        null,
      );
      assert.deepEqual(
        (await policies.listByBusinessId(IDS.businessA)).map(({ id }) => id),
        [IDS.activePolicy, IDS.inactivePolicy],
      );
      assert.deepEqual(
        (await policies.listActiveByBusinessId(IDS.businessA)).map(
          ({ id }) => id,
        ),
        [IDS.activePolicy],
      );

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  const fixtureIds = Object.values(IDS);
  assert.equal(
    Number(
      (await db("organisations").whereIn("id", fixtureIds).count("* as count"))[0]
        .count,
    ),
    0,
  );
  for (const table of ["businesses", "services", "policies"]) {
    const [{ count }] = await db(table).whereIn("id", fixtureIds).count("* as count");
    assert.equal(Number(count), 0);
  }
  const [{ count: hoursCount }] = await db("opening_hours")
    .whereIn("id", OPENING_HOUR_IDS)
    .count("* as count");
  assert.equal(Number(hoursCount), 0);
});
