const assert = require("node:assert/strict");
const test = require("node:test");

const {
  chatAnalysisSchema,
  validateAnalysis,
} = require("../services/chatAnalysisService");

test("structured analysis schema requires all lead extraction fields", () => {
  assert.equal(chatAnalysisSchema.additionalProperties, false);
  assert.deepEqual(chatAnalysisSchema.properties.leadFields.required, [
    "name",
    "phone",
    "email",
    "service",
    "preferredDate",
    "preferredTime",
  ]);
});

test("validateAnalysis accepts a complete structured result", () => {
  const analysis = {
    intent: "lead",
    leadFields: {
      name: "Aisha Khan",
      phone: "07700 900123",
      email: null,
      service: "Skin fade",
      preferredDate: "22 July 2026",
      preferredTime: "2:30 pm",
    },
    missingFields: [],
    reply: "",
  };

  assert.equal(validateAnalysis(analysis), analysis);
});

test("validateAnalysis rejects unstructured lead values", () => {
  assert.throws(
    () =>
      validateAnalysis({
        intent: "lead",
        leadFields: {
          name: { invented: true },
          phone: null,
          email: null,
          service: null,
          preferredDate: null,
          preferredTime: null,
        },
        missingFields: [],
        reply: "",
      }),
    /invalid name value/,
  );
});
