const { randomUUID } = require("node:crypto");

const REQUIRED_FIELDS = [
  "name",
  "phone",
  "service",
  "preferredDate",
  "preferredTime",
];

const FIELD_LABELS = {
  name: "name",
  phone: "phone number",
  service: "requested service",
  preferredDate: "preferred date",
  preferredTime: "preferred time",
};

function normaliseText(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function normaliseLeadFields(fields = {}) {
  const normalised = {
    name: normaliseText(fields.name),
    phone: normaliseText(fields.phone),
    service: normaliseText(fields.service),
    preferredDate: normaliseText(fields.preferredDate),
    preferredTime: normaliseText(fields.preferredTime),
  };

  const email = normaliseText(fields.email).toLowerCase();
  if (email) normalised.email = email;

  return normalised;
}

function prepareLead(
  fields,
  { businessType, idFactory = randomUUID, now = () => new Date() } = {},
) {
  const normalised = normaliseLeadFields(fields);
  const missingFields = REQUIRED_FIELDS.filter((field) => !normalised[field]);
  const invalidFields = [];

  if (normalised.phone && normalised.phone.replace(/\D/g, "").length < 7) {
    invalidFields.push("phone");
  }

  if (
    normalised.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised.email)
  ) {
    invalidFields.push("email");
  }

  if (missingFields.length || invalidFields.length) {
    return { invalidFields, missingFields, lead: null };
  }

  return {
    invalidFields: [],
    missingFields: [],
    lead: {
      id: idFactory(),
      ...normalised,
      businessType,
      createdAt: now().toISOString(),
      status: "new",
    },
  };
}

function readableList(items) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function buildMissingFieldsReply(missingFields) {
  const labels = missingFields.map((field) => FIELD_LABELS[field]);
  return `To record your enquiry, please provide your ${readableList(labels)}.`;
}

module.exports = {
  REQUIRED_FIELDS,
  buildMissingFieldsReply,
  normaliseLeadFields,
  prepareLead,
};
