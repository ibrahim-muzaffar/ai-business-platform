const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildMissingFieldsReply,
  prepareLead,
} = require("../services/leadService");

test("prepareLead reports every missing required field", () => {
  const result = prepareLead({ name: "Aisha Khan", service: "Skin fade" });

  assert.deepEqual(result.missingFields, [
    "phone",
    "preferredDate",
    "preferredTime",
  ]);
  assert.equal(result.lead, null);
  assert.equal(
    buildMissingFieldsReply(result.missingFields),
    "To record your enquiry, please include your phone number, preferred date and preferred time in one message.",
  );
});

test("prepareLead normalises and enriches a complete lead", () => {
  const result = prepareLead(
    {
      name: "  Aisha   Khan ",
      phone: " 07700 900123 ",
      email: " AISHA@EXAMPLE.COM ",
      service: " Skin fade ",
      preferredDate: " 22 July 2026 ",
      preferredTime: " 2:30 pm ",
    },
    {
      businessType: "barber",
      idFactory: () => "lead-test-id",
      now: () => new Date("2026-07-19T12:00:00.000Z"),
    },
  );

  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.invalidFields, []);
  assert.deepEqual(result.lead, {
    id: "lead-test-id",
    name: "Aisha Khan",
    phone: "07700 900123",
    email: "aisha@example.com",
    service: "Skin fade",
    preferredDate: "22 July 2026",
    preferredTime: "2:30 pm",
    businessType: "barber",
    createdAt: "2026-07-19T12:00:00.000Z",
    status: "new",
  });
});

test("prepareLead rejects malformed supplied contact details", () => {
  const result = prepareLead({
    name: "Aisha Khan",
    phone: "123",
    email: "not-an-email",
    service: "Skin fade",
    preferredDate: "22 July 2026",
    preferredTime: "2:30 pm",
  });

  assert.deepEqual(result.invalidFields, ["phone", "email"]);
  assert.equal(result.lead, null);
});
