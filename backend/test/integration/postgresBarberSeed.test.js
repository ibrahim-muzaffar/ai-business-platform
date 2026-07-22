const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const {
  SEED_IDS,
  seed,
} = require("../../db/seeds/01_northside_barbers");

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for PostgreSQL seed integration tests.",
  );
}

const db = knex({
  client: "pg",
  connection: process.env.TEST_DATABASE_URL,
});

test.after(async () => {
  await db.destroy();
});

const EXPECTED_ADDRESS = {
  line1: "24 Market Street",
  city: "Manchester",
  postcode: "M1 1AB",
  country: "United Kingdom",
};

const EXPECTED_SERVICES = [
  ["Classic haircut", "22.00"],
  ["Skin fade", "26.00"],
  ["Haircut and beard trim", "34.00"],
  ["Beard trim and shape-up", "14.00"],
  ["Children's haircut (under 12)", "17.00"],
];

const EXPECTED_HOURS = [
  ["monday", "09:00:00", "18:00:00", false],
  ["tuesday", "09:00:00", "18:00:00", false],
  ["wednesday", "09:00:00", "18:00:00", false],
  ["thursday", "09:00:00", "20:00:00", false],
  ["friday", "09:00:00", "20:00:00", false],
  ["saturday", "08:30:00", "17:00:00", false],
  ["sunday", null, null, true],
];

const EXPECTED_POLICIES = [
  [
    "walk_ins",
    "Walk-ins",
    "Walk-ins are welcome, but appointments are recommended on Fridays and Saturdays.",
  ],
  [
    "cancellations",
    "Cancellations",
    "Please give at least 24 hours' notice when cancelling or rearranging an appointment.",
  ],
  [
    "student_discount",
    "Student discount",
    "Students receive 10% off Monday to Thursday with valid student identification.",
  ],
  [
    "payment_methods",
    "Payment methods",
    "Accepted payment methods: Cash, Visa, Mastercard, Contactless payments.",
  ],
];

async function countByIds(connection, tableName, ids) {
  const [{ count }] = await connection(tableName)
    .whereIn("id", ids)
    .count("* as count");
  return Number(count);
}

test("Northside Barbers seed is verified, atomic and rerunnable", async () => {
  assert.equal(
    await countByIds(db, "organisations", [SEED_IDS.organisation]),
    0,
    "The test database must not contain the permanent seed before this rollback test.",
  );

  const rollbackSignal = new Error("rollback Northside Barbers seed fixtures");

  await assert.rejects(
    db.transaction(async (trx) => {
      await seed(trx);

      assert.equal(
        await countByIds(trx, "organisations", [SEED_IDS.organisation]),
        1,
      );
      assert.equal(
        await countByIds(trx, "businesses", [SEED_IDS.business]),
        1,
      );

      const organisation = await trx("organisations")
        .where({ id: SEED_IDS.organisation })
        .first();
      assert.equal(organisation.name, "Northside Barbers");

      let business = await trx("businesses")
        .where({ id: SEED_IDS.business })
        .first();
      assert.equal(business.organisation_id, SEED_IDS.organisation);
      assert.equal(business.business_type, "barber");
      assert.equal(business.name, "Northside Barbers");
      assert.equal(business.timezone, "Europe/London");
      assert.deepEqual(business.address, EXPECTED_ADDRESS);
      assert.equal(business.phone, "0161 496 0123");
      assert.equal(business.email, "hello@northsidebarbers.example");
      assert.equal(business.website, "https://northsidebarbers.example");
      assert.equal(
        business.description,
        "A friendly neighbourhood barber shop offering traditional cuts, modern styling and beard grooming for adults and children.",
      );

      let services = await trx("services")
        .where({ business_id: SEED_IDS.business })
        .whereIn("id", SEED_IDS.services)
        .orderBy("id", "asc");
      assert.equal(services.length, 5);
      assert.deepEqual(
        services.map(({ name, price }) => [name, price]),
        EXPECTED_SERVICES,
      );
      assert.equal(
        services.some(({ price }) => /£|Â£|Ã‚Â£/.test(String(price))),
        false,
      );
      assert.equal(
        services.every(
          ({ duration_minutes: duration, active }) =>
            duration === null && active === true,
        ),
        true,
      );

      const hours = await trx("opening_hours")
        .where({ business_id: SEED_IDS.business })
        .whereIn("id", SEED_IDS.openingHours)
        .orderBy("id", "asc");
      assert.equal(hours.length, 7);
      assert.deepEqual(
        hours.map(
          ({ day_of_week: day, opening_time: opens, closing_time: closes, closed }) =>
            [day, opens, closes, closed],
        ),
        EXPECTED_HOURS,
      );

      const policies = await trx("policies")
        .where({ business_id: SEED_IDS.business })
        .whereIn("id", SEED_IDS.policies)
        .orderBy("id", "asc");
      assert.equal(policies.length, 4);
      assert.deepEqual(
        policies.map(({ category, title, content }) => [
          category,
          title,
          content,
        ]),
        EXPECTED_POLICIES,
      );
      assert.equal(policies.every(({ active }) => active === true), true);

      const [{ count: workflowCount }] = await trx("workflows")
        .where((builder) =>
          builder
            .where({ business_id: SEED_IDS.business })
            .orWhere({ business_type: "barber" }),
        )
        .count("* as count");
      assert.equal(Number(workflowCount), 0);
      const [{ count: moduleCount }] = await trx("business_modules")
        .where({ business_id: SEED_IDS.business })
        .count("* as count");
      assert.equal(Number(moduleCount), 0);
      for (const table of [
        "customers",
        "leads",
        "conversations",
        "messages",
      ]) {
        const [{ count }] = await trx(table)
          .where({ business_id: SEED_IDS.business })
          .count("* as count");
        assert.equal(Number(count), 0);
      }

      await trx("organisations")
        .where({ id: SEED_IDS.organisation })
        .update({ name: "Stale organisation" });
      await trx("businesses")
        .where({ id: SEED_IDS.business })
        .update({ phone: "stale phone" });
      await trx("services")
        .where({ id: SEED_IDS.services[0] })
        .update({ name: "Stale service", price: "999.00" });
      await trx("policies")
        .where({ id: SEED_IDS.policies[0] })
        .update({ content: "Stale policy" });
      await trx("opening_hours")
        .where({ id: SEED_IDS.openingHours[0] })
        .update({
          opening_time: "10:00:00",
          closing_time: "16:00:00",
          closed: false,
        });

      await seed(trx);

      assert.equal(
        await countByIds(trx, "organisations", [SEED_IDS.organisation]),
        1,
      );
      assert.equal(
        await countByIds(trx, "businesses", [SEED_IDS.business]),
        1,
      );
      assert.equal(await countByIds(trx, "services", SEED_IDS.services), 5);
      assert.equal(
        await countByIds(trx, "opening_hours", SEED_IDS.openingHours),
        7,
      );
      assert.equal(await countByIds(trx, "policies", SEED_IDS.policies), 4);

      assert.equal(
        (
          await trx("organisations")
            .where({ id: SEED_IDS.organisation })
            .first()
        ).name,
        "Northside Barbers",
      );
      business = await trx("businesses")
        .where({ id: SEED_IDS.business })
        .first();
      assert.equal(business.phone, "0161 496 0123");
      services = await trx("services")
        .where({ business_id: SEED_IDS.business })
        .whereIn("id", SEED_IDS.services)
        .orderBy("id", "asc");
      assert.deepEqual(
        services.map(({ name, price }) => [name, price]),
        EXPECTED_SERVICES,
      );
      const refreshedHours = await trx("opening_hours")
        .where({ business_id: SEED_IDS.business })
        .whereIn("id", SEED_IDS.openingHours)
        .orderBy("id", "asc");
      assert.deepEqual(
        refreshedHours.map(
          ({
            day_of_week: day,
            opening_time: opens,
            closing_time: closes,
            closed,
          }) => [day, opens, closes, closed],
        ),
        EXPECTED_HOURS,
      );
      assert.equal(
        (
          await trx("policies")
            .where({ id: SEED_IDS.policies[0] })
            .first()
        ).content,
        EXPECTED_POLICIES[0][2],
      );

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  assert.equal(
    await countByIds(db, "organisations", [SEED_IDS.organisation]),
    0,
  );
  assert.equal(await countByIds(db, "businesses", [SEED_IDS.business]), 0);
  assert.equal(await countByIds(db, "services", SEED_IDS.services), 0);
  assert.equal(
    await countByIds(db, "opening_hours", SEED_IDS.openingHours),
    0,
  );
  assert.equal(await countByIds(db, "policies", SEED_IDS.policies), 0);
});
