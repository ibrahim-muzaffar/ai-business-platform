const { mapMessage } = require("./mappers");

function createMessageRepository(db) {
  async function createMessage(input) {
    const values = {
      business_id: input.businessId,
      conversation_id: input.conversationId,
      sender_type: input.senderType,
      content: input.content,
    };

    if (input.metadata !== undefined) values.metadata = input.metadata;

    const [row] = await db("messages").insert(values).returning("*");
    return mapMessage(row);
  }

  async function findByIdForBusiness(businessId, messageId) {
    const row = await db("messages")
      .where({ business_id: businessId, id: messageId })
      .first();
    return mapMessage(row);
  }

  async function listByConversationForBusiness(
    businessId,
    conversationId,
  ) {
    const rows = await db("messages")
      .where({
        business_id: businessId,
        conversation_id: conversationId,
      })
      .orderBy("created_at", "asc")
      .orderBy("id", "asc");
    return rows.map(mapMessage);
  }

  return {
    createMessage,
    findByIdForBusiness,
    listByConversationForBusiness,
  };
}

module.exports = { createMessageRepository };
