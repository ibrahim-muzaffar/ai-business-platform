const {
  createConversationRepository,
} = require("../repositories/postgres/conversationRepository");
const {
  createMessageRepository,
} = require("../repositories/postgres/messageRepository");

function createConversationWriteService(db) {
  async function appendMessage(input) {
    return db.transaction(async (trx) => {
      const conversations = createConversationRepository(trx);
      const messages = createMessageRepository(trx);
      const conversation = await conversations.findByIdForBusiness(
        input.businessId,
        input.conversationId,
      );

      if (!conversation) return null;

      const messageInput = {
        businessId: input.businessId,
        conversationId: input.conversationId,
        senderType: input.senderType,
        content: input.content,
      };
      if (input.metadata !== undefined) {
        messageInput.metadata = input.metadata;
      }

      const message = await messages.createMessage(messageInput);
      const updatedConversation =
        await conversations.updateLastMessageAtForBusiness(
          input.businessId,
          input.conversationId,
          message.createdAt,
        );

      if (!updatedConversation) {
        throw new Error(
          "Conversation disappeared while appending a message.",
        );
      }

      return { conversation: updatedConversation, message };
    });
  }

  return { appendMessage };
}

module.exports = { createConversationWriteService };
