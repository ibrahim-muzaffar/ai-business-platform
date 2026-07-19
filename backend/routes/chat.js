const express = require("express");
const OpenAI = require("openai");
const { getBusinessData } = require("../repositories/businessRepository");
const { saveLead } = require("../repositories/leadRepository");
const {
  addMessage,
  createSession,
  getSession,
  markCompleted,
  mergeLeadFields,
} = require("../repositories/conversationSessionRepository");
const {
  analyseChatMessage,
} = require("../services/chatAnalysisService");
const {
  buildMissingFieldsReply,
  prepareLead,
} = require("../services/leadService");

const router = express.Router();
const supportedBusinessTypes = new Set([
  "barber",
  "restaurant",
  "dentist",
  "gym",
]);

// Keep the OpenAI client on the server. Deferring creation when the key is
// absent lets the API return a controlled 503 instead of failing at startup.
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function sendSessionReply(response, session, reply) {
  addMessage(session.id, { role: "assistant", text: reply });
  return response.json({ status: "success", reply, sessionId: session.id });
}

// Accept a customer message and continue or create its server-side session.
router.post("/", async (request, response) => {
  const { message, businessType, sessionId } = request.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return response.status(400).json({
      status: "error",
      message: "A non-empty message is required.",
    });
  }

  if (!client) {
    return response.status(503).json({
      status: "error",
      message: "The AI service is not configured yet.",
    });
  }

  const selectedBusiness =
    typeof businessType === "string" &&
    supportedBusinessTypes.has(businessType.trim().toLowerCase())
      ? businessType.trim().toLowerCase()
      : "local business";
  const session =
    getSession(sessionId, selectedBusiness) ?? createSession(selectedBusiness);

  try {
    const businessData = await getBusinessData(selectedBusiness);
    const recentMessages = [...session.messages];
    addMessage(session.id, { role: "user", text: message.trim() });

    const analysis = await analyseChatMessage({
      client,
      model: process.env.OPENAI_MODEL,
      message: message.trim(),
      businessType: selectedBusiness,
      businessData,
      collectedLeadFields: session.leadFields,
      recentMessages,
    });

    if (analysis.intent === "general") {
      return sendSessionReply(response, session, analysis.reply);
    }

    if (session.completed) {
      return sendSessionReply(
        response,
        session,
        "This enquiry has already been recorded. The business will contact you to confirm availability; no appointment has been confirmed.",
      );
    }

    mergeLeadFields(session.id, analysis.leadFields);

    // Validate the complete accumulated state independently instead of trusting
    // the model's missingFields array as the source of truth.
    const validation = prepareLead(session.leadFields, {
      businessType: selectedBusiness,
    });

    if (validation.missingFields.length) {
      return sendSessionReply(
        response,
        session,
        buildMissingFieldsReply(validation.missingFields),
      );
    }

    if (validation.invalidFields.length) {
      const invalidField = validation.invalidFields[0];
      const fieldDescription =
        invalidField === "email" ? "a valid email address" : "a valid phone number";

      return sendSessionReply(
        response,
        session,
        `Please provide ${fieldDescription}.`,
      );
    }

    const saveResult = await saveLead(validation.lead);
    markCompleted(session.id, saveResult.lead.id);

    if (!saveResult.created) {
      return sendSessionReply(
        response,
        session,
        "We already recorded this enquiry recently. The business will contact you to confirm availability; no appointment has been confirmed.",
      );
    }

    return sendSessionReply(
      response,
      session,
      `Thanks, ${validation.lead.name}. Your enquiry has been recorded and the business will contact you to confirm availability. This is not a confirmed appointment.`,
    );
  } catch (error) {
    // Log diagnostic metadata only; never log request headers or credentials.
    console.error("Chat request failed", {
      name: error?.name,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      message: error?.message,
    });

    return response.status(500).json({
      status: "error",
      message: "The AI assistant is temporarily unavailable. Please try again.",
    });
  }
});

module.exports = router;
