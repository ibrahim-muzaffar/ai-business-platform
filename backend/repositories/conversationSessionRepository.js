const { randomUUID } = require("node:crypto");

const DEFAULT_EXPIRATION_MS = 30 * 60 * 1000;
const DEFAULT_MAX_MESSAGES = 10;
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

function reliableFieldValue(value) {
  if (typeof value !== "string") return null;

  const normalised = value.trim().replace(/\s+/g, " ");
  if (!normalised || UNCERTAIN_VALUES.has(normalised.toLowerCase())) return null;
  return normalised;
}

function createConversationSessionRepository({
  expirationMs = DEFAULT_EXPIRATION_MS,
  maxMessages = DEFAULT_MAX_MESSAGES,
  idFactory = randomUUID,
  now = () => new Date(),
} = {}) {
  const sessions = new Map();

  function cleanupExpiredSessions() {
    const cutoff = now().getTime() - expirationMs;
    let deletedCount = 0;

    for (const [sessionId, session] of sessions) {
      if (Date.parse(session.updatedAt) <= cutoff) {
        sessions.delete(sessionId);
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  function touch(session) {
    session.updatedAt = now().toISOString();
    return session;
  }

  function createSession(businessType) {
    cleanupExpiredSessions();

    const timestamp = now().toISOString();
    const session = {
      id: idFactory(),
      businessType,
      leadFields: {},
      messages: [],
      completed: false,
      leadId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    sessions.set(session.id, session);
    return session;
  }

  function getSession(sessionId, businessType) {
    cleanupExpiredSessions();

    if (typeof sessionId !== "string" || !sessionId) return null;
    const session = sessions.get(sessionId);

    // A session is scoped to one business demo and cannot cross business types.
    if (!session || session.businessType !== businessType) return null;
    return touch(session);
  }

  function mergeLeadFields(sessionId, fields = {}) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    for (const field of LEAD_FIELDS) {
      const value = reliableFieldValue(fields[field]);
      if (value !== null) session.leadFields[field] = value;
    }

    return touch(session);
  }

  function addMessage(sessionId, message) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.text !== "string" ||
      !message.text.trim()
    ) {
      return touch(session);
    }

    session.messages.push({ role: message.role, text: message.text.trim() });
    session.messages = session.messages.slice(-maxMessages);
    return touch(session);
  }

  function markCompleted(sessionId, leadId) {
    const session = sessions.get(sessionId);
    if (!session || session.completed) return false;

    session.completed = true;
    session.leadId = leadId;
    touch(session);
    return true;
  }

  return {
    addMessage,
    cleanupExpiredSessions,
    createSession,
    getSession,
    markCompleted,
    mergeLeadFields,
  };
}

const defaultRepository = createConversationSessionRepository();

module.exports = {
  createConversationSessionRepository,
  addMessage: defaultRepository.addMessage,
  cleanupExpiredSessions: defaultRepository.cleanupExpiredSessions,
  createSession: defaultRepository.createSession,
  getSession: defaultRepository.getSession,
  markCompleted: defaultRepository.markCompleted,
  mergeLeadFields: defaultRepository.mergeLeadFields,
};
