const {
  getDatabaseConnection: defaultGetDatabaseConnection,
} = require("../db/connection");
const {
  DEFAULT_CONFIGURED_BUSINESS_IDS,
  normaliseBusinessType,
} = require("../repositories/postgres/runtimeBusinessRepository");
const {
  createBusinessRepository,
} = require("../repositories/postgres/businessRepository");
const {
  createConversationRepository,
} = require("../repositories/postgres/conversationRepository");
const {
  createMessageRepository,
} = require("../repositories/postgres/messageRepository");
const {
  createLeadRepository,
} = require("../repositories/postgres/leadRepository");

const DEFAULT_EXPIRATION_MS = 30 * 60 * 1000;
const DEFAULT_MAX_MESSAGES = 10;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEAD_FIELDS = [
  "name",
  "phone",
  "email",
  "service",
  "preferredDate",
  "preferredTime",
];
const UNCERTAIN_VALUES = new Set([
  "unknown",
  "not known",
  "not sure",
  "unsure",
  "uncertain",
  "n/a",
  "none",
  "null",
]);

function createConfiguredBusinessMap(configuredBusinessIds) {
  const entries =
    configuredBusinessIds instanceof Map
      ? configuredBusinessIds.entries()
      : Object.entries(configuredBusinessIds);
  return new Map(
    [...entries].map(([businessType, businessId]) => [
      normaliseBusinessType(businessType),
      businessId,
    ]),
  );
}

function reliableFieldValue(value) {
  if (typeof value !== "string") return null;
  const normalised = value.trim().replace(/\s+/g, " ");
  if (!normalised || UNCERTAIN_VALUES.has(normalised.toLowerCase())) return null;
  return normalised;
}

function validUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid session clock value.");
  return date;
}

function metadataState(metadata) {
  const source =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  return {
    ...source,
    leadFields:
      source.leadFields &&
      typeof source.leadFields === "object" &&
      !Array.isArray(source.leadFields)
        ? { ...source.leadFields }
        : {},
    completed: source.completed === true,
    leadId: typeof source.leadId === "string" ? source.leadId : null,
  };
}

function toPublicSession(conversation, businessType, messageRows = []) {
  const metadata = metadataState(conversation.metadata);
  const messages = messageRows.flatMap((message) => {
    const role =
      message.senderType === "customer"
        ? "user"
        : message.senderType === "ai"
          ? "assistant"
          : null;
    return role ? [{ role, text: message.content }] : [];
  });
  return {
    id: conversation.id,
    businessType,
    leadFields: metadata.leadFields,
    messages,
    completed: metadata.completed,
    leadId: metadata.leadId,
    createdAt: asDate(conversation.createdAt).toISOString(),
    updatedAt: asDate(conversation.updatedAt).toISOString(),
  };
}

function createConversationSessionService({
  db,
  getDatabaseConnection = defaultGetDatabaseConnection,
  configuredBusinessIds = DEFAULT_CONFIGURED_BUSINESS_IDS,
  expirationMs = DEFAULT_EXPIRATION_MS,
  maxMessages = DEFAULT_MAX_MESSAGES,
  now = () => new Date(),
} = {}) {
  const configuredBusinesses = createConfiguredBusinessMap(
    configuredBusinessIds,
  );

  function resolveBusiness(businessType) {
    const normalisedType = normaliseBusinessType(businessType);
    return {
      businessType: normalisedType,
      businessId: configuredBusinesses.get(normalisedType) ?? null,
    };
  }

  function getConnection() {
    const connection = db ?? getDatabaseConnection?.("development");
    if (!connection) throw new Error("A database connection is required for sessions.");
    return connection;
  }

  function expired(conversation, currentTime) {
    return asDate(conversation.updatedAt).getTime() <=
      currentTime.getTime() - expirationMs;
  }

  async function loadMessages(trx, businessId, conversationId) {
    return createMessageRepository(trx).listRecentByConversationForBusiness(
      businessId,
      conversationId,
      maxMessages,
    );
  }

  async function lockActiveSession(trx, businessId, sessionId, currentTime) {
    const conversations = createConversationRepository(trx);
    const conversation =
      await conversations.findByIdForBusinessForUpdate(businessId, sessionId);
    if (
      !conversation ||
      conversation.status !== "open" ||
      expired(conversation, currentTime)
    ) {
      return null;
    }
    return { conversation, conversations };
  }

  async function createSession(businessType) {
    const resolved = resolveBusiness(businessType);
    if (!resolved.businessId) {
      throw new Error("Sessions are not configured for this business type.");
    }
    return getConnection().transaction(async (trx) => {
      const business = await createBusinessRepository(trx).findById(
        resolved.businessId,
      );
      if (
        !business ||
        business.status !== "active" ||
        normaliseBusinessType(business.businessType) !== resolved.businessType
      ) {
        throw new Error("Configured business is unavailable for sessions.");
      }
      const conversation = await createConversationRepository(
        trx,
      ).createConversation({
        businessId: resolved.businessId,
        customerId: null,
        channel: "website",
        status: "open",
        metadata: { leadFields: {}, completed: false, leadId: null },
      });
      return toPublicSession(conversation, resolved.businessType);
    });
  }

  async function getSession(sessionId, businessType) {
    const resolved = resolveBusiness(businessType);
    if (!resolved.businessId || !validUuid(sessionId)) return null;
    const currentTime = asDate(now());
    return getConnection().transaction(async (trx) => {
      const active = await lockActiveSession(
        trx,
        resolved.businessId,
        sessionId,
        currentTime,
      );
      if (!active) return null;
      const touched = await active.conversations.touchForBusiness(
        resolved.businessId,
        sessionId,
        currentTime,
      );
      const messages = await loadMessages(trx, resolved.businessId, sessionId);
      return toPublicSession(touched, resolved.businessType, messages);
    });
  }

  async function mergeLeadFields(sessionId, fields = {}, businessType) {
    const resolved = resolveBusiness(businessType);
    if (!resolved.businessId || !validUuid(sessionId)) return null;
    const currentTime = asDate(now());
    return getConnection().transaction(async (trx) => {
      const active = await lockActiveSession(
        trx,
        resolved.businessId,
        sessionId,
        currentTime,
      );
      if (!active) return null;
      const metadata = metadataState(active.conversation.metadata);
      for (const field of LEAD_FIELDS) {
        const value = reliableFieldValue(fields?.[field]);
        if (value !== null) metadata.leadFields[field] = value;
      }
      const updated = await active.conversations.updateMetadataForBusiness(
        resolved.businessId,
        sessionId,
        metadata,
        currentTime,
      );
      const messages = await loadMessages(trx, resolved.businessId, sessionId);
      return toPublicSession(updated, resolved.businessType, messages);
    });
  }

  async function addMessage(sessionId, message, businessType) {
    const resolved = resolveBusiness(businessType);
    if (!resolved.businessId || !validUuid(sessionId)) return null;
    const currentTime = asDate(now());
    return getConnection().transaction(async (trx) => {
      const active = await lockActiveSession(
        trx,
        resolved.businessId,
        sessionId,
        currentTime,
      );
      if (!active) return null;
      const validMessage =
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.text === "string" &&
        message.text.trim();
      let conversation;
      if (validMessage) {
        await createMessageRepository(trx).createMessage({
          businessId: resolved.businessId,
          conversationId: sessionId,
          senderType: message.role === "user" ? "customer" : "ai",
          content: message.text.trim(),
        });
        conversation =
          await active.conversations.updateLastMessageAtForBusiness(
            resolved.businessId,
            sessionId,
            currentTime,
            currentTime,
          );
      } else {
        conversation = await active.conversations.touchForBusiness(
          resolved.businessId,
          sessionId,
          currentTime,
        );
      }
      const messages = await loadMessages(trx, resolved.businessId, sessionId);
      return toPublicSession(conversation, resolved.businessType, messages);
    });
  }

  async function markCompleted(sessionId, leadId, businessType) {
    const resolved = resolveBusiness(businessType);
    if (
      !resolved.businessId ||
      !validUuid(sessionId) ||
      !validUuid(leadId)
    ) {
      return false;
    }
    const currentTime = asDate(now());
    return getConnection().transaction(async (trx) => {
      const active = await lockActiveSession(
        trx,
        resolved.businessId,
        sessionId,
        currentTime,
      );
      if (!active) return false;
      const metadata = metadataState(active.conversation.metadata);
      if (metadata.completed) return false;
      const lead = await createLeadRepository(trx).findByIdForBusiness(
        resolved.businessId,
        leadId,
      );
      if (!lead) return false;
      metadata.completed = true;
      metadata.leadId = lead.id;
      const updated = await active.conversations.updateMetadataForBusiness(
        resolved.businessId,
        sessionId,
        metadata,
        currentTime,
      );
      return Boolean(updated);
    });
  }

  return {
    addMessage,
    createSession,
    getSession,
    markCompleted,
    mergeLeadFields,
  };
}

const defaultService = createConversationSessionService();

module.exports = {
  createConversationSessionService,
  addMessage: defaultService.addMessage,
  createSession: defaultService.createSession,
  getSession: defaultService.getSession,
  markCompleted: defaultService.markCompleted,
  mergeLeadFields: defaultService.mergeLeadFields,
};
