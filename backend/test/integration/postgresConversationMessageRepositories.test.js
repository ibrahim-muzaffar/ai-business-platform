const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const {
  createConversationRepository,
} = require("../../repositories/postgres/conversationRepository");
const {
  createMessageRepository,
} = require("../../repositories/postgres/messageRepository");

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
  organisationA: "40000000-0000-0000-0000-000000000001",
  organisationB: "40000000-0000-0000-0000-000000000002",
  businessA: "40000000-0000-0000-0000-000000000011",
  businessB: "40000000-0000-0000-0000-000000000012",
  customerA: "40000000-0000-0000-0000-000000000021",
  customerB: "40000000-0000-0000-0000-000000000022",
  conversationAOlder: "40000000-0000-0000-0000-000000000051",
  conversationANewer: "40000000-0000-0000-0000-000000000052",
  messageOlder: "40000000-0000-0000-0000-000000000061",
  messageTieLower: "40000000-0000-0000-0000-000000000062",
  messageTieHigher: "40000000-0000-0000-0000-000000000063",
};

function assertIdentityAndTimestamps(record) {
  assert.match(record.id, /^[0-9a-f-]{36}$/i);
  assert.ok(record.createdAt instanceof Date);
  assert.ok(record.updatedAt instanceof Date);
}

async function expectConversationError(trx, input, expectedCode) {
  await assert.rejects(
    trx.transaction(async (savepoint) => {
      await createConversationRepository(savepoint).createConversation(input);
    }),
    (error) => error?.code === expectedCode,
  );
}

async function expectMessageError(trx, input, expectedCode) {
  await assert.rejects(
    trx.transaction(async (savepoint) => {
      await createMessageRepository(savepoint).createMessage(input);
    }),
    (error) => error?.code === expectedCode,
  );
}

test("PostgreSQL conversation and message repositories map, order and isolate data", async () => {
  const rollbackSignal = new Error("rollback conversation and message fixtures");
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
      await trx("customers").insert([
        {
          id: IDS.customerA,
          business_id: IDS.businessA,
          name: "Customer A",
        },
        {
          id: IDS.customerB,
          business_id: IDS.businessB,
          name: "Customer B",
        },
      ]);

      const conversations = createConversationRepository(trx);
      const messages = createMessageRepository(trx);

      const defaultConversation = await conversations.createConversation({
        businessId: IDS.businessA,
        customerId: IDS.customerA,
      });
      generatedIds.push(defaultConversation.id);
      assert.equal(defaultConversation.businessId, IDS.businessA);
      assert.equal(defaultConversation.customerId, IDS.customerA);
      assert.equal(defaultConversation.channel, "website");
      assert.equal(defaultConversation.status, "open");
      assert.deepEqual(defaultConversation.metadata, {});
      assert.equal(Object.hasOwn(defaultConversation, "business_id"), false);
      assert.ok(defaultConversation.startedAt instanceof Date);
      assertIdentityAndTimestamps(defaultConversation);

      const nullConversation = await conversations.createConversation({
        businessId: IDS.businessA,
        customerId: null,
        lastMessageAt: null,
        closedAt: null,
      });
      generatedIds.push(nullConversation.id);
      assert.equal(nullConversation.customerId, null);
      assert.equal(nullConversation.lastMessageAt, null);
      assert.equal(nullConversation.closedAt, null);

      const otherBusinessConversation =
        await conversations.createConversation({
          businessId: IDS.businessB,
          customerId: IDS.customerB,
        });
      generatedIds.push(otherBusinessConversation.id);

      await trx("conversations").insert([
        {
          id: IDS.conversationAOlder,
          business_id: IDS.businessA,
          customer_id: IDS.customerA,
          status: "open",
        },
        {
          id: IDS.conversationANewer,
          business_id: IDS.businessA,
          customer_id: IDS.customerA,
          status: "closed",
        },
      ]);

      await trx("conversations")
        .where({ id: nullConversation.id })
        .update({
          started_at: "2026-04-04T12:00:00.000Z",
          last_message_at: null,
        });
      await trx("conversations")
        .where({ id: defaultConversation.id })
        .update({
          started_at: "2026-04-01T12:00:00.000Z",
          last_message_at: "2026-04-03T12:00:00.000Z",
        });
      await trx("conversations")
        .whereIn("id", [IDS.conversationAOlder, IDS.conversationANewer])
        .update({
          started_at: "2026-04-02T12:00:00.000Z",
          last_message_at: null,
        });

      assert.equal(
        (
          await conversations.findByIdForBusiness(
            IDS.businessA,
            defaultConversation.id,
          )
        ).id,
        defaultConversation.id,
      );
      assert.equal(
        await conversations.findByIdForBusiness(
          IDS.businessB,
          defaultConversation.id,
        ),
        null,
      );
      assert.deepEqual(
        (await conversations.listByBusinessId(IDS.businessA)).map(
          ({ id }) => id,
        ),
        [
          nullConversation.id,
          defaultConversation.id,
          IDS.conversationANewer,
          IDS.conversationAOlder,
        ],
      );
      assert.deepEqual(
        (await conversations.listByStatusForBusiness(
          IDS.businessA,
          "closed",
        )).map(({ id }) => id),
        [IDS.conversationANewer],
      );
      assert.deepEqual(
        (await conversations.listByCustomerForBusiness(
          IDS.businessA,
          IDS.customerA,
        )).map(({ id }) => id),
        [
          defaultConversation.id,
          IDS.conversationANewer,
          IDS.conversationAOlder,
        ],
      );
      assert.deepEqual(
        await conversations.listByCustomerForBusiness(
          IDS.businessA,
          IDS.customerB,
        ),
        [],
      );

      await expectConversationError(
        trx,
        { businessId: IDS.businessA, customerId: IDS.customerB },
        "23503",
      );
      await expectConversationError(
        trx,
        { businessId: IDS.businessA, channel: "carrier_pigeon" },
        "23514",
      );
      await expectConversationError(
        trx,
        { businessId: IDS.businessA, status: "pending" },
        "23514",
      );
      await expectConversationError(
        trx,
        {
          businessId: IDS.businessA,
          startedAt: "2026-04-02T12:00:00.000Z",
          lastMessageAt: "2026-04-01T12:00:00.000Z",
        },
        "23514",
      );
      await expectConversationError(
        trx,
        {
          businessId: IDS.businessA,
          startedAt: "2026-04-02T12:00:00.000Z",
          closedAt: "2026-04-01T12:00:00.000Z",
        },
        "23514",
      );

      const createdMessage = await messages.createMessage({
        businessId: IDS.businessA,
        conversationId: defaultConversation.id,
        senderType: "customer",
        content: "Please book a haircut.",
      });
      generatedIds.push(createdMessage.id);
      assert.equal(createdMessage.businessId, IDS.businessA);
      assert.equal(createdMessage.conversationId, defaultConversation.id);
      assert.equal(createdMessage.senderType, "customer");
      assert.equal(createdMessage.content, "Please book a haircut.");
      assert.deepEqual(createdMessage.metadata, {});
      assert.equal(Object.hasOwn(createdMessage, "sender_type"), false);
      assertIdentityAndTimestamps(createdMessage);

      const otherBusinessMessage = await messages.createMessage({
        businessId: IDS.businessB,
        conversationId: otherBusinessConversation.id,
        senderType: "customer",
        content: "Other tenant message.",
        metadata: { source: "fixture" },
      });
      generatedIds.push(otherBusinessMessage.id);

      await trx("messages").insert([
        {
          id: IDS.messageOlder,
          business_id: IDS.businessA,
          conversation_id: defaultConversation.id,
          sender_type: "system",
          content: "Conversation started.",
        },
        {
          id: IDS.messageTieLower,
          business_id: IDS.businessA,
          conversation_id: defaultConversation.id,
          sender_type: "ai",
          content: "First tied message.",
        },
        {
          id: IDS.messageTieHigher,
          business_id: IDS.businessA,
          conversation_id: defaultConversation.id,
          sender_type: "staff",
          content: "Second tied message.",
        },
      ]);

      await trx("messages")
        .where({ id: IDS.messageOlder })
        .update({ created_at: "2026-05-01T12:00:00.000Z" });
      await trx("messages")
        .where({ id: createdMessage.id })
        .update({ created_at: "2026-05-02T12:00:00.000Z" });
      await trx("messages")
        .whereIn("id", [IDS.messageTieLower, IDS.messageTieHigher])
        .update({ created_at: "2026-05-03T12:00:00.000Z" });

      assert.equal(
        (
          await messages.findByIdForBusiness(
            IDS.businessA,
            createdMessage.id,
          )
        ).id,
        createdMessage.id,
      );
      assert.equal(
        await messages.findByIdForBusiness(
          IDS.businessB,
          createdMessage.id,
        ),
        null,
      );
      assert.deepEqual(
        (await messages.listByConversationForBusiness(
          IDS.businessA,
          defaultConversation.id,
        )).map(({ id }) => id),
        [
          IDS.messageOlder,
          createdMessage.id,
          IDS.messageTieLower,
          IDS.messageTieHigher,
        ],
      );
      assert.deepEqual(
        await messages.listByConversationForBusiness(
          IDS.businessA,
          otherBusinessConversation.id,
        ),
        [],
      );

      await expectMessageError(
        trx,
        {
          businessId: IDS.businessA,
          conversationId: otherBusinessConversation.id,
          senderType: "customer",
          content: "Cross-business message.",
        },
        "23503",
      );
      await expectMessageError(
        trx,
        {
          businessId: IDS.businessA,
          conversationId: defaultConversation.id,
          senderType: "visitor",
          content: "Invalid sender.",
        },
        "23514",
      );
      await expectMessageError(
        trx,
        {
          businessId: IDS.businessA,
          conversationId: defaultConversation.id,
          senderType: "customer",
          content: "   ",
        },
        "23514",
      );

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  const allIds = [...Object.values(IDS), ...generatedIds];
  for (const table of [
    "organisations",
    "businesses",
    "customers",
    "conversations",
    "messages",
  ]) {
    const [{ count }] = await db(table)
      .whereIn("id", allIds)
      .count("* as count");
    assert.equal(Number(count), 0);
  }
});
