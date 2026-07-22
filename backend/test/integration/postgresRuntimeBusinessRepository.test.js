const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const connectionModule = require("../../db/connection");
const { SEED_IDS, seed } = require("../../db/seeds/01_northside_barbers");

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for PostgreSQL runtime business repository tests.",
  );
}

let importConnectionRequests = 0;
const originalGetDatabaseConnection = connectionModule.getDatabaseConnection;
connectionModule.getDatabaseConnection = () => {
  importConnectionRequests += 1;
  throw new Error("Import must not request a database connection.");
};

const runtimeRepositoryPath = require.resolve(
  "../../repositories/postgres/runtimeBusinessRepository",
);
delete require.cache[runtimeRepositoryPath];
const {
  createRuntimeBusinessRepository,
} = require(runtimeRepositoryPath);
connectionModule.getDatabaseConnection = originalGetDatabaseConnection;

const db = knex({
  client: "pg",
  connection: process.env.TEST_DATABASE_URL,
});

test.after(async () => {
  await db.destroy();
});

const EXPECTED_BUSINESS_DATA = {
  businessType: "barber",
  name: "Northside Barbers",
  description:
    "A friendly neighbourhood barber shop offering traditional cuts, modern styling and beard grooming for adults and children.",
  address: {
    line1: "24 Market Street",
    city: "Manchester",
    postcode: "M1 1AB",
    country: "United Kingdom",
  },
  phone: "0161 496 0123",
  email: "hello@northsidebarbers.example",
  website: "https://northsidebarbers.example",
  openingHours: {
    monday: "09:00-18:00",
    tuesday: "09:00-18:00",
    wednesday: "09:00-18:00",
    thursday: "09:00-20:00",
    friday: "09:00-20:00",
    saturday: "08:30-17:00",
    sunday: "Closed",
  },
  services: [
    { name: "Classic haircut", price: "£22" },
    { name: "Skin fade", price: "£26" },
    { name: "Haircut and beard trim", price: "£34" },
    { name: "Beard trim and shape-up", price: "£14" },
    { name: "Children's haircut (under 12)", price: "£17" },
  ],
  policies: {
    walkIns:
      "Walk-ins are welcome, but appointments are recommended on Fridays and Saturdays.",
    cancellations:
      "Please give at least 24 hours' notice when cancelling or rearranging an appointment.",
    studentDiscount:
      "Students receive 10% off Monday to Thursday with valid student identification.",
    paymentMethods: [
      "Cash",
      "Visa",
      "Mastercard",
      "Contactless payments",
    ],
  },
};

async function countSeedRows(connection, tableName, ids) {
  const [{ count }] = await connection(tableName)
    .whereIn("id", ids)
    .count("* as count");
  return Number(count);
}

test("runtime business repository reads only verified PostgreSQL data", async () => {
  assert.equal(importConnectionRequests, 0);

  let unsupportedConnectionRequests = 0;
  const unsupportedRepository = createRuntimeBusinessRepository({
    getDatabaseConnection: () => {
      unsupportedConnectionRequests += 1;
      throw new Error("Unsupported businesses must not query PostgreSQL.");
    },
  });

  assert.equal(unsupportedRepository.normaliseBusinessType(" BARBER "), "barber");
  assert.equal(unsupportedRepository.normaliseBusinessType(42), "");
  assert.equal(unsupportedRepository.isBusinessConfigured(" Barber "), true);
  for (const businessType of ["restaurant", "dentist", "gym"]) {
    assert.equal(unsupportedRepository.isBusinessConfigured(businessType), false);
    assert.equal(
      await unsupportedRepository.getBusinessData(businessType),
      null,
    );
  }
  assert.equal(unsupportedConnectionRequests, 0);

  const rollbackSignal = new Error("rollback runtime business fixtures");

  await assert.rejects(
    db.transaction(async (trx) => {
      await seed(trx);

      await trx("services").insert({
        id: "60000000-0000-0000-0000-000000000021",
        business_id: SEED_IDS.business,
        name: "Inactive service",
        price: "22.50",
        active: false,
      });
      await trx("policies").insert({
        id: "60000000-0000-0000-0000-000000000041",
        business_id: SEED_IDS.business,
        category: "walk_ins",
        title: "Inactive policy",
        content: "Must not be exposed.",
        active: false,
      });

      const repository = createRuntimeBusinessRepository({ db: trx });
      assert.deepEqual(
        await repository.getBusinessData(" BARBER "),
        EXPECTED_BUSINESS_DATA,
      );

      await trx("businesses")
        .where({ id: SEED_IDS.business })
        .update({ status: "inactive" });
      assert.equal(await repository.getBusinessData("barber"), null);
      await trx("businesses")
        .where({ id: SEED_IDS.business })
        .update({ status: "active", business_type: "dentist" });
      assert.equal(await repository.getBusinessData("barber"), null);
      await trx("businesses")
        .where({ id: SEED_IDS.business })
        .update({ business_type: "barber" });

      const missingRepository = createRuntimeBusinessRepository({
        db: trx,
        configuredBusinessIds: {
          barber: "60000000-0000-0000-0000-000000000099",
        },
      });
      assert.equal(await missingRepository.getBusinessData("barber"), null);

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  assert.equal(
    await countSeedRows(db, "organisations", [SEED_IDS.organisation]),
    0,
  );
  assert.equal(await countSeedRows(db, "businesses", [SEED_IDS.business]), 0);
  assert.equal(await countSeedRows(db, "services", SEED_IDS.services), 0);
  assert.equal(
    await countSeedRows(db, "opening_hours", SEED_IDS.openingHours),
    0,
  );
  assert.equal(await countSeedRows(db, "policies", SEED_IDS.policies), 0);
  assert.equal(
    await countSeedRows(db, "services", [
      "60000000-0000-0000-0000-000000000021",
    ]),
    0,
  );
  assert.equal(
    await countSeedRows(db, "policies", [
      "60000000-0000-0000-0000-000000000041",
    ]),
    0,
  );
});
