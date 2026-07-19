const barberBusiness = require("../data/business.json");

// This registry is the single source of truth for demos with verified backend
// configuration. Adding a future business happens here, not in the chat route.
const configuredBusinesses = new Map([
  [barberBusiness.businessType, barberBusiness],
]);

function normaliseBusinessType(businessType) {
  return typeof businessType === "string"
    ? businessType.trim().toLowerCase()
    : "";
}

function isBusinessConfigured(businessType) {
  return configuredBusinesses.has(normaliseBusinessType(businessType));
}

// This storage boundary keeps route code independent from JSON files. Replace
// this implementation with a database query later without changing callers.
async function getBusinessData(businessType) {
  return configuredBusinesses.get(normaliseBusinessType(businessType)) ?? null;
}

module.exports = {
  getBusinessData,
  isBusinessConfigured,
  normaliseBusinessType,
};
