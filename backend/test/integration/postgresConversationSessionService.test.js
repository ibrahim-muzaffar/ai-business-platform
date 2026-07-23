const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const connectionModule = require("../../db/connection");
const { SEED_IDS, seed } = require("../../db/seeds/01_northside_barbers");

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for PostgreSQL conversation-session tests.",
  );
}

let importConnectionRequests = 0;
const originalGetDatabaseConnection = connectionModule.getDatabaseConnection;
connectionModule.getDatabaseConnection = () => {
  importConnectionRequests += 1;
  throw new Error("Import must not request a database connection.");
};
const servicePath = require.resolve(
  "../../services/conversationSessionService",
);
delete require.cache[servicePath];
const { createConversationSessionService } = require(servicePath);
connectionModule.getDatabaseConnection = originalGetDatabaseConnection;

const db = knex({ client: "pg", connection: process.env.TEST_DATABASE_URL });
test.after(async () => db.destroy());

const IDS = {
  otherOrganisation: "90000000-0000-0000-0000-000000000001",
  otherBusiness: "90000000-0000-0000-0000-000000000011",
  sameBusinessLead: "90000000-0000-0000-0000-000000000051",
  secondSameBusinessLead: "90000000-0000-0000-0000-000000000052",
  otherBusinessLead: "90000000-0000-0000-0000-000000000053",
  nonexistentLead: "90000000-0000-0000-0000-000000000054",
  missingBusiness: "90000000-0000-0000-0000-000000000099",
};

const PUBLIC_SESSION_KEYS = [
  "businessType",
  "completed",
  "createdAt",
  "id",
  "leadFields",
  "leadId",
  "messages",
  "updatedAt",
];

test("PostgreSQL conversation sessions are scoped, persistent and expiring", async () => {
  assert.equal(importConnectionRequests, 0);
  let unsupportedConnectionRequests = 0;
  const unsupported = createConversationSessionService({
    getDatabaseConnection: () => {
      unsupportedConnectionRequests += 1;
      throw new Error("Unsupported sessions must not request PostgreSQL.");
    },
  });
  assert.equal(await unsupported.getSession("not-a-uuid", "restaurant"), null);
  assert.equal(
    await unsupported.mergeLeadFields("not-a-uuid", {}, "restaurant"),
    null,
  );
  assert.equal(
    await unsupported.addMessage("not-a-uuid", {}, "restaurant"),
    null,
  );
  assert.equal(
    await unsupported.markCompleted("not-a-uuid", "not-a-uuid", "restaurant"),
    false,
  );
  await assert.rejects(unsupported.createSession("restaurant"), /not configured/);
  assert.equal(unsupportedConnectionRequests, 0);

  const rollbackSignal = new Error("rollback PostgreSQL session fixtures");
  await assert.rejects(
    db.transaction(async (trx) => {
      await seed(trx);
      await trx("organisations").insert({
        id: IDS.otherOrganisation,
        name: "Other Organisation",
      });
      await trx("businesses").insert({
        id: IDS.otherBusiness,
        organisation_id: IDS.otherOrganisation,
        business_type: "dentist",
        name: "Other Business",
        timezone: "Europe/London",
      });

      let currentTime = new Date();
      const sessions = createConversationSessionService({
        db: trx,
        maxMessages: 2,
        now: () => currentTime,
      });
      const created = await sessions.createSession("barber");
      assert.deepEqual(Object.keys(created).sort(), PUBLIC_SESSION_KEYS);
      assert.deepEqual(created, {
        id: created.id,
        businessType: "barber",
        leadFields: {},
        messages: [],
        completed: false,
        leadId: null,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
      assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2}T/);

      let storedConversation = await trx("conversations")
        .where({ id: created.id, business_id: SEED_IDS.business })
        .first();
      assert.equal(storedConversation.channel, "website");
      assert.equal(storedConversation.status, "open");
      assert.deepEqual(storedConversation.metadata, {
        leadFields: {},
        completed: false,
        leadId: null,
      });
      assert.equal(
        Number(
          (
            await trx("messages")
              .where({ conversation_id: created.id })
              .count("* as count")
          )[0].count,
        ),
        0,
      );

      currentTime = new Date(Date.parse(created.updatedAt) + 60_000);
      const retrieved = await sessions.getSession(created.id, "barber");
      assert.equal(retrieved.id, created.id);
      assert.equal(Date.parse(retrieved.updatedAt), currentTime.getTime());
      assert.equal(await sessions.getSession(created.id, "dentist"), null);
      for (const invalidId of [undefined, "", "old-memory-session", "123"] ) {
        assert.equal(await sessions.getSession(invalidId, "barber"), null);
      }

      await trx("conversations")
        .where({ id: created.id })
        .update({
          metadata: {
            leadFields: {},
            completed: false,
            leadId: null,
            unrelated: { preserved: true },
          },
        });

      let merged = await sessions.mergeLeadFields(
        created.id,
        { name: "  Alex   Smith ", phone: "07123 456789" },
        "barber",
      );
      assert.deepEqual(merged.leadFields, {
        name: "Alex Smith",
        phone: "07123 456789",
      });
      merged = await sessions.mergeLeadFields(
        created.id,
        { name: "unknown", phone: "   ", service: " Skin   fade " },
        "barber",
      );
      assert.deepEqual(merged.leadFields, {
        name: "Alex Smith",
        phone: "07123 456789",
        service: "Skin fade",
      });
      assert.deepEqual(
        (
          await trx("conversations")
            .where({ id: created.id })
            .first()
        ).metadata.unrelated,
        { preserved: true },
      );

      await sessions.addMessage(
        created.id,
        { role: "user", text: " First user message " },
        "barber",
      );
      await sessions.addMessage(
        created.id,
        { role: "assistant", text: "First assistant message" },
        "barber",
      );
      const beforeInvalidCount = Number(
        (
          await trx("messages")
            .where({ conversation_id: created.id })
            .count("* as count")
        )[0].count,
      );
      currentTime = new Date(currentTime.getTime() + 60_000);
      const invalidResult = await sessions.addMessage(
        created.id,
        { role: "staff", text: "Not allowed" },
        "barber",
      );
      assert.equal(invalidResult.messages.length, 2);
      assert.equal(
        Number(
          (
            await trx("messages")
              .where({ conversation_id: created.id })
              .count("* as count")
          )[0].count,
        ),
        beforeInvalidCount,
      );

      await Promise.all([
        sessions.addMessage(
          created.id,
          { role: "user", text: "Concurrent user" },
          "barber",
        ),
        sessions.addMessage(
          created.id,
          { role: "assistant", text: "Concurrent assistant" },
          "barber",
        ),
      ]);
      await trx("messages")
        .where({ conversation_id: created.id, content: "Concurrent user" })
        .update({ created_at: "2026-07-23T12:00:00.000Z" });
      await trx("messages")
        .where({
          conversation_id: created.id,
          content: "Concurrent assistant",
        })
        .update({ created_at: "2026-07-23T12:01:00.000Z" });
      const recent = await sessions.getSession(created.id, "barber");
      assert.equal(recent.messages.length, 2);
      assert.deepEqual(
        recent.messages.map(({ text }) => text),
        ["Concurrent user", "Concurrent assistant"],
      );
      const persistedMessages = await trx("messages").where({
        conversation_id: created.id,
      });
      assert.equal(persistedMessages.length, 4);
      assert.equal(
        persistedMessages.find(({ content }) => content === "First user message")
          .sender_type,
        "customer",
      );
      assert.equal(
        persistedMessages.find(
          ({ content }) => content === "First assistant message",
        ).sender_type,
        "ai",
      );

      await trx("leads").insert([
        {
          id: IDS.sameBusinessLead,
          business_id: SEED_IDS.business,
          conversation_id: created.id,
        },
        {
          id: IDS.secondSameBusinessLead,
          business_id: SEED_IDS.business,
        },
        {
          id: IDS.otherBusinessLead,
          business_id: IDS.otherBusiness,
        },
      ]);
      assert.equal(
        await sessions.markCompleted(
          created.id,
          IDS.nonexistentLead,
          "barber",
        ),
        false,
      );
      storedConversation = await trx("conversations")
        .where({ id: created.id })
        .first();
      assert.equal(storedConversation.metadata.completed, false);
      assert.equal(storedConversation.metadata.leadId, null);
      assert.equal(
        await sessions.markCompleted(
          created.id,
          IDS.otherBusinessLead,
          "barber",
        ),
        false,
      );
      assert.equal(
        await sessions.markCompleted(
          created.id,
          IDS.sameBusinessLead,
          "barber",
        ),
        true,
      );
      assert.equal(
        await sessions.markCompleted(
          created.id,
          IDS.secondSameBusinessLead,
          "barber",
        ),
        false,
      );
      storedConversation = await trx("conversations")
        .where({ id: created.id })
        .first();
      assert.equal(storedConversation.metadata.completed, true);
      assert.equal(storedConversation.metadata.leadId, IDS.sameBusinessLead);

      const expiring = await sessions.createSession("barber");
      await sessions.addMessage(
        expiring.id,
        { role: "user", text: "Retained history" },
        "barber",
      );
      const expiredAt = new Date(currentTime.getTime() - 30 * 60 * 1000 - 1);
      await trx("conversations")
        .where({ id: expiring.id })
        .update({ updated_at: expiredAt });
      const beforeExpired = await trx("conversations")
        .where({ id: expiring.id })
        .first();
      assert.equal(await sessions.getSession(expiring.id, "barber"), null);
      assert.equal(
        await sessions.mergeLeadFields(
          expiring.id,
          { name: "Changed" },
          "barber",
        ),
        null,
      );
      assert.equal(
        await sessions.addMessage(
          expiring.id,
          { role: "assistant", text: "Not stored" },
          "barber",
        ),
        null,
      );
      assert.equal(
        await sessions.markCompleted(
          expiring.id,
          IDS.secondSameBusinessLead,
          "barber",
        ),
        false,
      );
      const afterExpired = await trx("conversations")
        .where({ id: expiring.id })
        .first();
      assert.equal(afterExpired.status, "open");
      assert.equal(afterExpired.updated_at.getTime(), beforeExpired.updated_at.getTime());
      assert.deepEqual(afterExpired.metadata, beforeExpired.metadata);
      assert.equal(
        Number(
          (
            await trx("messages")
              .where({ conversation_id: expiring.id })
              .count("* as count")
          )[0].count,
        ),
        1,
      );

      for (const [configuredBusinessIds, status, storedType] of [
        [{ barber: IDS.missingBusiness }, null, null],
        [undefined, "inactive", null],
        [undefined, "active", "dentist"],
      ]) {
        if (status) {
          await trx("businesses")
            .where({ id: SEED_IDS.business })
            .update({
              status,
              ...(storedType ? { business_type: storedType } : {}),
            });
        }
        const unavailable = createConversationSessionService({
          db: trx,
          ...(configuredBusinessIds ? { configuredBusinessIds } : {}),
        });
        await assert.rejects(unavailable.createSession("barber"), /unavailable/);
        if (status) {
          await trx("businesses")
            .where({ id: SEED_IDS.business })
            .update({ status: "active", business_type: "barber" });
        }
      }

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  for (const table of ["conversations", "messages", "leads"]) {
    const [{ count }] = await db(table)
      .whereIn("business_id", [SEED_IDS.business, IDS.otherBusiness])
      .count("* as count");
    assert.equal(Number(count), 0);
  }
});
