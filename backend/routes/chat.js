const express = require("express");
const OpenAI = require("openai");
const businessRepository = require("../repositories/postgres/runtimeBusinessRepository");
const leadRepository = require("../repositories/leadRepository");
const conversationSessionRepository = require("../repositories/conversationSessionRepository");
const chatAnalysisService = require("../services/chatAnalysisService");
const leadService = require("../services/leadService");

const UNSUPPORTED_BUSINESS_REPLY =
  "The live AI assistant is not configured for this business demo yet. Please try the barber demo.";

// Keep the OpenAI client on the server. Deferring creation when the key is
// absent lets the API return a controlled 503 instead of failing at startup.
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Dependencies are injectable so the complete HTTP boundary can be tested
// offline and prove an unsupported request never reaches protected services.
function createChatRouter({
  openAIClient = client,
  businesses = businessRepository,
  leads = leadRepository,
  sessions = conversationSessionRepository,
  analysis = chatAnalysisService,
  leadValidation = leadService,
} = {}) {
  const router = express.Router();

  function sendSessionReply(response, session, reply) {
    sessions.addMessage(session.id, { role: "assistant", text: reply });
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

    const selectedBusiness = businesses.normaliseBusinessType(businessType);

    // This must precede the API-key and session checks: unsupported demos may
    // not access OpenAI, sessions, leads, or another demo's verified data.
    if (!businesses.isBusinessConfigured(selectedBusiness)) {
      return response.json({
        status: "success",
        reply: UNSUPPORTED_BUSINESS_REPLY,
        sessionId: null,
      });
    }

    if (!openAIClient) {
      return response.status(503).json({
        status: "error",
        message: "The AI service is not configured yet.",
      });
    }

    try {
      const businessData = await businesses.getBusinessData(selectedBusiness);
      if (!businessData) {
        throw new Error("Configured business data is unavailable.");
      }

      const session =
        sessions.getSession(sessionId, selectedBusiness) ??
        sessions.createSession(selectedBusiness);
      const recentMessages = [...session.messages];
      sessions.addMessage(session.id, { role: "user", text: message.trim() });

      const result = await analysis.analyseChatMessage({
        client: openAIClient,
        model: process.env.OPENAI_MODEL,
        message: message.trim(),
        businessType: selectedBusiness,
        businessData,
        collectedLeadFields: session.leadFields,
        recentMessages,
      });

      if (result.intent === "general") {
        return sendSessionReply(response, session, result.reply);
      }

      if (session.completed) {
        return sendSessionReply(
          response,
          session,
          "This enquiry has already been recorded. The business will contact you to confirm availability; no appointment has been confirmed.",
        );
      }

      sessions.mergeLeadFields(session.id, result.leadFields);

      // Validate accumulated state independently instead of trusting the model.
      const validation = leadValidation.prepareLead(session.leadFields, {
        businessType: selectedBusiness,
      });

      if (validation.missingFields.length) {
        return sendSessionReply(
          response,
          session,
          leadValidation.buildMissingFieldsReply(validation.missingFields),
        );
      }

      if (validation.invalidFields.length) {
        const invalidField = validation.invalidFields[0];
        const fieldDescription =
          invalidField === "email"
            ? "a valid email address"
            : "a valid phone number";

        return sendSessionReply(
          response,
          session,
          `Please provide ${fieldDescription}.`,
        );
      }

      const saveResult = await leads.saveLead(validation.lead);
      sessions.markCompleted(session.id, saveResult.lead.id);

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

  return router;
}

const router = createChatRouter();
router.createChatRouter = createChatRouter;
router.UNSUPPORTED_BUSINESS_REPLY = UNSUPPORTED_BUSINESS_REPLY;

module.exports = router;
