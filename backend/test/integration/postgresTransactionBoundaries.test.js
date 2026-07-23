const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const {
  createConversationRepository,
} = require("../../repositories/postgres/conversationRepository");
const {
  createConversationWriteService,
} = require("../../services/conversationWriteService");

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
  organisationA: "50000000-0000-0000-0000-000000000001",
  organisationB: "50000000-0000-0000-0000-000000000002",
  businessA: "50000000-0000-0000-0000-000000000011",
  businessB: "50000000-0000-0000-0000-000000000012",
  conversationA: "50000000-0000-0000-0000-000000000031",
  conversationB: "50000000-0000-0000-0000-000000000032",
  blankFailureConversation: "50000000-0000-0000-0000-000000000033",
  postInsertFailureConversation: "50000000-0000-0000-0000-000000000034",
  monotonicConversation: "50000000-0000-0000-0000-000000000035",
};

test("application services own atomic conversation write transactions", async () => {
  const rollbackSignal = new Error("rollback transaction boundary fixtures");
  const generatedMessageIds = [];

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
      await trx("conversations").insert([
        {
          id: IDS.conversationA,
          business_id: IDS.businessA,
          started_at: trx.raw("now() - interval '1 hour'"),
          updated_at: trx.raw("now() - interval '1 day'"),
        },
        {
          id: IDS.conversationB,
          business_id: IDS.businessB,
          started_at: trx.raw("now() - interval '1 hour'"),
        },
        {
          id: IDS.blankFailureConversation,
          business_id: IDS.businessA,
          started_at: trx.raw("now() - interval '1 hour'"),
        },
        {
          id: IDS.postInsertFailureConversation,
          business_id: IDS.businessA,
          started_at: trx.raw("now() + interval '1 day'"),
          last_message_at: null,
        },
        {
          id: IDS.monotonicConversation,
          business_id: IDS.businessA,
          started_at: trx.raw("now() - interval '2 hours'"),
          last_message_at: null,
          updated_at: trx.raw("now() - interval '1 day'"),
        },
      ]);

      const conversationBefore = await trx("conversations")
        .where({ id: IDS.conversationA })
        .first();
      const writes = createConversationWriteService(trx);
      const appended = await writes.appendMessage({
        businessId: IDS.businessA,
        conversationId: IDS.conversationA,
        senderType: "customer",
        content: "Atomic message",
      });
      generatedMessageIds.push(appended.message.id);

      assert.equal(appended.message.businessId, IDS.businessA);
      assert.equal(appended.message.conversationId, IDS.conversationA);
      assert.deepEqual(appended.message.metadata, {});
      assert.ok(appended.message.createdAt instanceof Date);
      assert.equal(appended.conversation.id, IDS.conversationA);
      assert.equal(appended.conversation.businessId, IDS.businessA);
      assert.equal(
        appended.conversation.lastMessageAt.getTime(),
        appended.message.createdAt.getTime(),
      );
      assert.ok(
        appended.conversation.updatedAt.getTime() >
          conversationBefore.updated_at.getTime(),
      );

      const [{ count: scopedMessageCount }] = await trx("messages")
        .where({
          business_id: IDS.businessA,
          conversation_id: IDS.conversationA,
        })
        .count("* as count");
      assert.equal(Number(scopedMessageCount), 1);

      const wrongBusinessResult = await writes.appendMessage({
        businessId: IDS.businessB,
        conversationId: IDS.conversationA,
        senderType: "customer",
        content: "Must not be written",
      });
      assert.equal(wrongBusinessResult, null);
      const [{ count: wrongBusinessMessageCount }] = await trx("messages")
        .where({ content: "Must not be written" })
        .count("* as count");
      assert.equal(Number(wrongBusinessMessageCount), 0);

      const blankBefore = await trx("conversations")
        .where({ id: IDS.blankFailureConversation })
        .first();
      await assert.rejects(
        writes.appendMessage({
          businessId: IDS.businessA,
          conversationId: IDS.blankFailureConversation,
          senderType: "customer",
          content: "   ",
        }),
        (error) => error?.code === "23514",
      );
      const blankAfter = await trx("conversations")
        .where({ id: IDS.blankFailureConversation })
        .first();
      assert.equal(blankBefore.last_message_at, null);
      assert.equal(blankAfter.last_message_at, null);
      const [{ count: blankMessageCount }] = await trx("messages")
        .where({ conversation_id: IDS.blankFailureConversation })
        .count("* as count");
      assert.equal(Number(blankMessageCount), 0);

      await assert.rejects(
        writes.appendMessage({
          businessId: IDS.businessA,
          conversationId: IDS.postInsertFailureConversation,
          senderType: "customer",
          content: "Rollback after insert",
        }),
        (error) => error?.code === "23514",
      );
      const failedConversation = await trx("conversations")
        .where({ id: IDS.postInsertFailureConversation })
        .first();
      assert.equal(failedConversation.last_message_at, null);
      const [{ count: rolledBackMessageCount }] = await trx("messages")
        .where({ conversation_id: IDS.postInsertFailureConversation })
        .count("* as count");
      assert.equal(Number(rolledBackMessageCount), 0);

      const [{ databaseNow }] = await trx.select(
        trx.raw("now() AS \"databaseNow\""),
      );
      const laterTimestamp = new Date(databaseNow.getTime() + 30 * 60 * 1000);
      const earlierTimestamp = new Date(databaseNow.getTime() + 15 * 60 * 1000);
      const conversations = createConversationRepository(trx);

      const advanced =
        await conversations.updateLastMessageAtForBusiness(
          IDS.businessA,
          IDS.monotonicConversation,
          laterTimestamp,
        );
      assert.equal(advanced.lastMessageAt.getTime(), laterTimestamp.getTime());

      const preserved =
        await conversations.updateLastMessageAtForBusiness(
          IDS.businessA,
          IDS.monotonicConversation,
          earlierTimestamp,
        );
      assert.equal(preserved.lastMessageAt.getTime(), laterTimestamp.getTime());

      assert.equal(
        await conversations.updateLastMessageAtForBusiness(
          IDS.businessB,
          IDS.monotonicConversation,
          new Date(databaseNow.getTime() + 60 * 60 * 1000),
        ),
        null,
      );
      const scopedConversation = await trx("conversations")
        .where({ id: IDS.monotonicConversation })
        .first();
      assert.equal(
        scopedConversation.last_message_at.getTime(),
        laterTimestamp.getTime(),
      );

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  const allIds = [...Object.values(IDS), ...generatedMessageIds];
  for (const table of [
    "organisations",
    "businesses",
    "conversations",
    "messages",
  ]) {
    const [{ count }] = await db(table)
      .whereIn("id", allIds)
      .count("* as count");
    assert.equal(Number(count), 0);
  }
});
