const LEAD_FIELDS = [
  "name",
  "phone",
  "email",
  "service",
  "preferredDate",
  "preferredTime",
];
const REQUIRED_LEAD_FIELDS = LEAD_FIELDS.filter((field) => field !== "email");

const chatAnalysisSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["lead", "general"],
      description:
        "Whether the message is a booking/enquiry lead or a general business question.",
    },
    leadFields: {
      type: "object",
      properties: Object.fromEntries(
        LEAD_FIELDS.map((field) => [field, { type: ["string", "null"] }]),
      ),
      required: LEAD_FIELDS,
      additionalProperties: false,
    },
    missingFields: {
      type: "array",
      items: { type: "string", enum: REQUIRED_LEAD_FIELDS },
    },
    reply: {
      type: "string",
      description: "A concise grounded reply for a general business question.",
    },
  },
  required: ["intent", "leadFields", "missingFields", "reply"],
  additionalProperties: false,
};

function validateAnalysis(analysis) {
  if (!analysis || !["lead", "general"].includes(analysis.intent)) {
    throw new Error("OpenAI returned an invalid intent analysis.");
  }

  if (!analysis.leadFields || typeof analysis.reply !== "string") {
    throw new Error("OpenAI returned an incomplete structured response.");
  }

  for (const field of LEAD_FIELDS) {
    const value = analysis.leadFields[field];
    if (value !== null && typeof value !== "string") {
      throw new Error(`OpenAI returned an invalid ${field} value.`);
    }
  }

  if (
    !Array.isArray(analysis.missingFields) ||
    analysis.missingFields.some(
      (field) => !REQUIRED_LEAD_FIELDS.includes(field),
    )
  ) {
    throw new Error("OpenAI returned invalid missing lead fields.");
  }

  return analysis;
}

async function analyseChatMessage({
  client,
  model,
  message,
  businessType,
  businessData,
  collectedLeadFields = {},
  recentMessages = [],
}) {
  const verifiedBusinessContext = businessData
    ? JSON.stringify(businessData)
    : "No verified business data is available for this demo.";

  const response = await client.responses.create({
    model,
    instructions: [
      `You are a concise demo receptionist for a ${businessType} business.`,
      "Classify booking or service enquiries as lead intent; classify ordinary business questions as general intent.",
      "For lead intent, extract only customer details explicitly supplied in the latest message. Use null for anything not supplied or uncertain in that message.",
      "Use the recent messages to understand whether the latest message continues an active enquiry, but do not copy prior details into leadFields because the backend already stores them.",
      `Lead fields already collected by the backend: ${JSON.stringify(collectedLeadFields)}`,
      "Never invent customer details, prices, opening hours, availability or bookings.",
      "For general intent, answer business-specific questions using only the verified business data below. If information is missing, politely say you do not know.",
      "Never claim an appointment is confirmed. Leads are enquiries only.",
      `Verified business data: ${verifiedBusinessContext}`,
    ].join("\n"),
    input: [
      ...recentMessages.map((recentMessage) => ({
        role: recentMessage.role,
        content: recentMessage.text,
      })),
      { role: "user", content: message },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "chat_intent_and_lead_fields",
        strict: true,
        schema: chatAnalysisSchema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("OpenAI returned an empty structured response.");
  }

  return validateAnalysis(JSON.parse(response.output_text));
}

module.exports = {
  analyseChatMessage,
  chatAnalysisSchema,
  validateAnalysis,
};
