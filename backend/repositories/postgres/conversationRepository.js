const { mapConversation } = require("./mappers");

const OPTIONAL_COLUMNS = {
  customerId: "customer_id",
  channel: "channel",
  status: "status",
  startedAt: "started_at",
  lastMessageAt: "last_message_at",
  closedAt: "closed_at",
  metadata: "metadata",
};

const ACTIVITY_ORDER =
  'COALESCE("conversations"."last_message_at", "conversations"."started_at") DESC';

function createConversationRepository(db) {
  async function createConversation(input) {
    const values = { business_id: input.businessId };

    for (const [inputName, columnName] of Object.entries(OPTIONAL_COLUMNS)) {
      if (input[inputName] !== undefined) {
        values[columnName] = input[inputName];
      }
    }

    const [row] = await db("conversations").insert(values).returning("*");
    return mapConversation(row);
  }

  async function findByIdForBusiness(businessId, conversationId) {
    const row = await db("conversations")
      .where({ business_id: businessId, id: conversationId })
      .first();
    return mapConversation(row);
  }

  async function findByIdForBusinessForUpdate(businessId, conversationId) {
    const row = await db("conversations")
      .where({ business_id: businessId, id: conversationId })
      .forUpdate()
      .first();
    return mapConversation(row);
  }

  async function touchForBusiness(businessId, conversationId, touchedAt) {
    const [row] = await db("conversations")
      .where({ business_id: businessId, id: conversationId })
      .update({ updated_at: touchedAt })
      .returning("*");
    return mapConversation(row);
  }

  async function updateMetadataForBusiness(
    businessId,
    conversationId,
    metadata,
    updatedAt,
  ) {
    const [row] = await db("conversations")
      .where({ business_id: businessId, id: conversationId })
      .update({ metadata, updated_at: updatedAt })
      .returning("*");
    return mapConversation(row);
  }

  async function updateLastMessageAtForBusiness(
    businessId,
    conversationId,
    lastMessageAt,
    updatedAt,
  ) {
    const timestampExpression = db.raw(
      `CASE
        WHEN ?::timestamptz < "started_at" THEN ?::timestamptz
        WHEN "last_message_at" IS NULL
          OR ?::timestamptz > "last_message_at" THEN ?::timestamptz
        ELSE "last_message_at"
      END`,
      [lastMessageAt, lastMessageAt, lastMessageAt, lastMessageAt],
    );
    const [row] = await db("conversations")
      .where({ business_id: businessId, id: conversationId })
      .update({
        last_message_at: timestampExpression,
        updated_at: updatedAt ?? db.raw("clock_timestamp()"),
      })
      .returning("*");
    return mapConversation(row);
  }

  function orderedBusinessQuery(businessId) {
    return db("conversations")
      .where({ business_id: businessId })
      .orderByRaw(ACTIVITY_ORDER)
      .orderBy("id", "desc");
  }

  async function listByBusinessId(businessId) {
    const rows = await orderedBusinessQuery(businessId);
    return rows.map(mapConversation);
  }

  async function listByStatusForBusiness(businessId, status) {
    const rows = await orderedBusinessQuery(businessId).where({ status });
    return rows.map(mapConversation);
  }

  async function listByCustomerForBusiness(businessId, customerId) {
    const rows = await orderedBusinessQuery(businessId).where({
      customer_id: customerId,
    });
    return rows.map(mapConversation);
  }

  return {
    createConversation,
    findByIdForBusiness,
    findByIdForBusinessForUpdate,
    listByBusinessId,
    listByCustomerForBusiness,
    listByStatusForBusiness,
    touchForBusiness,
    updateMetadataForBusiness,
    updateLastMessageAtForBusiness,
  };
}

module.exports = { createConversationRepository };
