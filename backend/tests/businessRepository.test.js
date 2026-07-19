const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getBusinessData,
  isBusinessConfigured,
  normaliseBusinessType,
} = require("../repositories/businessRepository");

test("barber is configured and resolves its verified business data", async () => {
  assert.equal(isBusinessConfigured("barber"), true);
  assert.equal(isBusinessConfigured(" BARBER "), true);
  assert.equal(normaliseBusinessType(" BARBER "), "barber");

  const business = await getBusinessData("barber");
  assert.equal(business.businessType, "barber");
});

test("unsupported businesses are not configured and receive no business data", async () => {
  assert.equal(isBusinessConfigured("restaurant"), false);
  assert.equal(isBusinessConfigured("dentist"), false);
  assert.equal(await getBusinessData("restaurant"), null);
});
