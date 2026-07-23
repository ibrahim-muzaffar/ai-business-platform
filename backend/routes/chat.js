const express = require("express");
const OpenAI = require("openai");
const businessRepository = require("../repositories/postgres/runtimeBusinessRepository");
const leadRepository = require("../services/leadCaptureService");
const conversationSessionRepository = require("../services/conversationSessionService");
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

  async function sendSessionReply(response, session, reply, businessType) {
    const updatedSession = await sessions.addMessage(
      session.id,
      { role: "assistant", text: reply },
      businessType,
    );
    if (!updatedSession) {
      throw new Error("Conversation session became unavailable.");
    }
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

      let session = await sessions.getSession(sessionId, selectedBusiness);
      if (!session) {
        session = await sessions.createSession(selectedBusiness);
      }
      if (!session) {
        throw new Error("Conversation session could not be created.");
      }
      const recentMessages = [...session.messages];
      session = await sessions.addMessage(
        session.id,
        { role: "user", text: message.trim() },
        selectedBusiness,
      );
      if (!session) {
        throw new Error("Conversation session became unavailable.");
      }

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
        return await sendSessionReply(
          response,
          session,
          result.reply,
          selectedBusiness,
        );
      }

      if (session.completed) {
        return await sendSessionReply(
          response,
          session,
          "This enquiry has already been recorded. The business will contact you to confirm availability; no appointment has been confirmed.",
          selectedBusiness,
        );
      }

      session = await sessions.mergeLeadFields(
        session.id,
        result.leadFields,
        selectedBusiness,
      );
      if (!session) {
        throw new Error("Conversation session became unavailable.");
      }

      // Validate accumulated state independently instead of trusting the model.
      const validation = leadValidation.prepareLead(session.leadFields, {
        businessType: selectedBusiness,
      });

      if (validation.missingFields.length) {
        return await sendSessionReply(
          response,
          session,
          leadValidation.buildMissingFieldsReply(validation.missingFields),
          selectedBusiness,
        );
      }

      if (validation.invalidFields.length) {
        const invalidField = validation.invalidFields[0];
        const fieldDescription =
          invalidField === "email"
            ? "a valid email address"
            : "a valid phone number";

        return await sendSessionReply(
          response,
          session,
          `Please provide ${fieldDescription}.`,
          selectedBusiness,
        );
      }

      const saveResult = await leads.saveLead({
        ...validation.lead,
        conversationId: session.id,
      });
      const completed = await sessions.markCompleted(
        session.id,
        saveResult.lead.id,
        selectedBusiness,
      );
      if (!completed) {
        throw new Error("Conversation session could not be completed.");
      }

      if (!saveResult.created) {
        return await sendSessionReply(
          response,
          session,
          "We already recorded this enquiry recently. The business will contact you to confirm availability; no appointment has been confirmed.",
          selectedBusiness,
        );
      }

      return await sendSessionReply(
        response,
        session,
        `Thanks, ${validation.lead.name}. Your enquiry has been recorded and the business will contact you to confirm availability. This is not a confirmed appointment.`,
        selectedBusiness,
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
