const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const connectionModule = require("../../db/connection");
const { SEED_IDS, seed } = require("../../db/seeds/01_northside_barbers");

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for PostgreSQL lead-capture integration tests.",
  );
}

let importConnectionRequests = 0;
const originalGetDatabaseConnection = connectionModule.getDatabaseConnection;
connectionModule.getDatabaseConnection = () => {
  importConnectionRequests += 1;
  throw new Error("Import must not request a database connection.");
};

const leadCaptureServicePath = require.resolve(
  "../../services/leadCaptureService",
);
delete require.cache[leadCaptureServicePath];
const { createLeadCaptureService } = require(leadCaptureServicePath);
connectionModule.getDatabaseConnection = originalGetDatabaseConnection;

const db = knex({
  client: "pg",
  connection: process.env.TEST_DATABASE_URL,
});

test.after(async () => {
  await db.destroy();
});

const IDS = {
  firstLead: "80000000-0000-0000-0000-000000000051",
  duplicateLead: "80000000-0000-0000-0000-000000000052",
  serviceLead: "80000000-0000-0000-0000-000000000053",
  dateLead: "80000000-0000-0000-0000-000000000054",
  timeLead: "80000000-0000-0000-0000-000000000055",
  failedLead: "80000000-0000-0000-0000-000000000056",
  missingBusiness: "80000000-0000-0000-0000-000000000099",
  conversation: "80000000-0000-0000-0000-000000000061",
  otherOrganisation: "80000000-0000-0000-0000-000000000071",
  otherBusiness: "80000000-0000-0000-0000-000000000072",
  otherConversation: "80000000-0000-0000-0000-000000000073",
  crossBusinessLead: "80000000-0000-0000-0000-000000000074",
};

const BASE_LEAD = {
  id: IDS.firstLead,
  name: "Alex Smith",
  phone: "(07123) 456-789",
  service: "Classic haircut",
  preferredDate: "22 July 2026",
  preferredTime: "2:30 pm",
  businessType: "barber",
  createdAt: "1999-01-01T00:00:00.000Z",
  status: "new",
  conversationId: IDS.conversation,
};

const LEGACY_KEYS = [
  "businessType",
  "createdAt",
  "id",
  "name",
  "phone",
  "preferredDate",
  "preferredTime",
  "service",
  "status",
];

async function countForBusiness(connection, tableName) {
  const [{ count }] = await connection(tableName)
    .where({ business_id: SEED_IDS.business })
    .count("* as count");
  return Number(count);
}

test("PostgreSQL lead capture is atomic, scoped and legacy-compatible", async () => {
  assert.equal(importConnectionRequests, 0);

  let unsupportedConnectionRequests = 0;
  const unsupportedService = createLeadCaptureService({
    getDatabaseConnection: () => {
      unsupportedConnectionRequests += 1;
      throw new Error("Unsupported leads must not request PostgreSQL.");
    },
  });
  await assert.rejects(
    unsupportedService.saveLead({ ...BASE_LEAD, businessType: "restaurant" }),
    /not configured/,
  );
  assert.equal(unsupportedConnectionRequests, 0);

  const rollbackSignal = new Error("rollback lead-capture fixtures");

  await assert.rejects(
    db.transaction(async (trx) => {
      await seed(trx);
      await trx("organisations").insert({
        id: IDS.otherOrganisation,
        name: "Other Lead Organisation",
      });
      await trx("businesses").insert({
        id: IDS.otherBusiness,
        organisation_id: IDS.otherOrganisation,
        business_type: "dentist",
        name: "Other Lead Business",
        timezone: "Europe/London",
      });
      await trx("conversations").insert([
        {
          id: IDS.conversation,
          business_id: SEED_IDS.business,
        },
        {
          id: IDS.otherConversation,
          business_id: IDS.otherBusiness,
        },
      ]);
      const service = createLeadCaptureService({ db: trx });

      const firstResult = await service.saveLead(BASE_LEAD);
      assert.equal(firstResult.created, true);
      assert.deepEqual(Object.keys(firstResult.lead).sort(), LEGACY_KEYS);
      assert.deepEqual(firstResult.lead, {
        id: IDS.firstLead,
        name: "Alex Smith",
        phone: "(07123) 456-789",
        service: "Classic haircut",
        preferredDate: "22 July 2026",
        preferredTime: "2:30 pm",
        businessType: "barber",
        createdAt: firstResult.lead.createdAt,
        status: "new",
      });
      assert.match(firstResult.lead.createdAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.notEqual(firstResult.lead.createdAt, BASE_LEAD.createdAt);

      let customers = await trx("customers").where({
        business_id: SEED_IDS.business,
      });
      let storedLeads = await trx("leads").where({
        business_id: SEED_IDS.business,
      });
      assert.equal(customers.length, 1);
      assert.equal(storedLeads.length, 1);
      assert.equal(customers[0].name, BASE_LEAD.name);
      assert.equal(customers[0].phone, BASE_LEAD.phone);
      assert.equal(customers[0].email, null);
      assert.equal(storedLeads[0].id, IDS.firstLead);
      assert.equal(storedLeads[0].requested_service, BASE_LEAD.service);
      assert.equal(
        storedLeads[0].requested_date_text,
        BASE_LEAD.preferredDate,
      );
      assert.equal(
        storedLeads[0].requested_time_text,
        BASE_LEAD.preferredTime,
      );
      assert.equal(storedLeads[0].requested_date, null);
      assert.equal(storedLeads[0].requested_time, null);
      assert.equal(storedLeads[0].service_id, null);
      assert.equal(storedLeads[0].conversation_id, IDS.conversation);
      assert.equal(Object.hasOwn(firstResult.lead, "conversationId"), false);

      const duplicateResult = await service.saveLead({
        ...BASE_LEAD,
        id: IDS.duplicateLead,
        name: "ALEX SMITH",
        phone: "07123 456 789",
        email: "new@example.test",
        service: "CLASSIC HAIRCUT",
        preferredDate: "22 JULY 2026",
        preferredTime: "2:30 PM",
      });
      assert.equal(duplicateResult.created, false);
      assert.equal(duplicateResult.lead.id, IDS.firstLead);
      assert.equal(duplicateResult.lead.email, "new@example.test");
      assert.equal(await countForBusiness(trx, "customers"), 1);
      assert.equal(await countForBusiness(trx, "leads"), 1);

      await service.saveLead({
        ...BASE_LEAD,
        id: IDS.duplicateLead,
        email: "conflicting@example.test",
      });
      customers = await trx("customers").where({
        business_id: SEED_IDS.business,
      });
      assert.equal(customers[0].email, "new@example.test");

      for (const changedLead of [
        { id: IDS.serviceLead, service: "Skin fade" },
        { id: IDS.dateLead, preferredDate: "23 July 2026" },
        { id: IDS.timeLead, preferredTime: "3:30 pm" },
      ]) {
        const result = await service.saveLead({
          ...BASE_LEAD,
          ...changedLead,
        });
        assert.equal(result.created, true);
      }
      assert.equal(await countForBusiness(trx, "customers"), 1);
      assert.equal(await countForBusiness(trx, "leads"), 4);

      await assert.rejects(
        service.saveLead({
          ...BASE_LEAD,
          id: IDS.crossBusinessLead,
          name: "Cross Business Customer",
          phone: "07999 111111",
          conversationId: IDS.otherConversation,
        }),
        (error) => error?.code === "23503",
      );
      assert.equal(
        Number(
          (
            await trx("customers")
              .where({
                business_id: SEED_IDS.business,
                name: "Cross Business Customer",
              })
              .count("* as count")
          )[0].count,
        ),
        0,
      );

      for (const [configuredBusinessIds, status, businessType] of [
        [{ barber: IDS.missingBusiness }, null, null],
        [undefined, "inactive", null],
        [undefined, "active", "dentist"],
      ]) {
        if (status) {
          await trx("businesses")
            .where({ id: SEED_IDS.business })
            .update({ status, ...(businessType ? { business_type: businessType } : {}) });
        }
        const unavailableService = createLeadCaptureService({
          db: trx,
          ...(configuredBusinessIds ? { configuredBusinessIds } : {}),
        });
        await assert.rejects(
          unavailableService.saveLead({
            ...BASE_LEAD,
            id: "80000000-0000-0000-0000-000000000070",
          }),
          /unavailable/,
        );
        if (status) {
          await trx("businesses")
            .where({ id: SEED_IDS.business })
            .update({ status: "active", business_type: "barber" });
        }
      }
      assert.equal(await countForBusiness(trx, "leads"), 4);

      await assert.rejects(
        service.saveLead({
          ...BASE_LEAD,
          id: IDS.failedLead,
          name: "Rollback Customer",
          phone: "07999 000000",
          status: "invalid_status",
        }),
        (error) => error?.code === "23514",
      );
      assert.equal(
        Number(
          (
            await trx("customers")
              .where({ business_id: SEED_IDS.business, name: "Rollback Customer" })
              .count("* as count")
          )[0].count,
        ),
        0,
      );

      await trx("leads")
        .where({ id: IDS.firstLead })
        .update({ created_at: "2026-07-22T09:00:00.000Z" });
      await trx("leads")
        .where({ id: IDS.serviceLead })
        .update({ created_at: "2026-07-22T10:00:00.000Z" });
      await trx("leads")
        .where({ id: IDS.dateLead })
        .update({ created_at: "2026-07-22T11:00:00.000Z" });
      await trx("leads")
        .where({ id: IDS.timeLead })
        .update({ created_at: "2026-07-22T12:00:00.000Z" });

      const allLeads = await service.getAllLeads();
      assert.deepEqual(
        allLeads.map(({ id }) => id),
        [IDS.firstLead, IDS.serviceLead, IDS.dateLead, IDS.timeLead],
      );
      for (const lead of allLeads) {
        assert.deepEqual(
          Object.keys(lead).sort(),
          [...LEGACY_KEYS, "email"].sort(),
        );
        assert.equal(lead.businessType, "barber");
      }

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  assert.equal(await countForBusiness(db, "customers"), 0);
  assert.equal(await countForBusiness(db, "leads"), 0);
});
