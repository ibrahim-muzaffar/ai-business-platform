const express = require("express");
const OpenAI = require("openai");

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

// Accept a customer message and generate a stateless demo receptionist reply.
router.post("/", async (request, response) => {
  const { message, businessType } = request.body ?? {};

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

  try {
    const aiResponse = await client.responses.create({
      model: process.env.OPENAI_MODEL,
      instructions: `You are a concise demo receptionist for a ${selectedBusiness} business. Answer helpfully and briefly. Do not invent or claim confirmed prices, appointment availability, or bookings.`,
      input: message.trim(),
    });

    if (!aiResponse.output_text) {
      throw new Error("OpenAI returned an empty text response.");
    }

    return response.json({
      status: "success",
      reply: aiResponse.output_text,
    });
  } catch (error) {
    // Log diagnostic metadata only; never log request headers or credentials.
    console.error("OpenAI API request failed", {
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
