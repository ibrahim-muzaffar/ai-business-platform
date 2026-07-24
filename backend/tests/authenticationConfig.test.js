const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAuthenticationConfig,
} = require("../config/authentication");

const VALID_SECRET = "s".repeat(32);

test("authentication config reads required values and safe defaults", () => {
  assert.deepEqual(
    createAuthenticationConfig({
      JWT_SECRET: VALID_SECRET,
      JWT_ISSUER: "unit-test-issuer",
      JWT_AUDIENCE: "unit-test-audience",
    }),
    {
      jwtSecret: VALID_SECRET,
      jwtIssuer: "unit-test-issuer",
      jwtAudience: "unit-test-audience",
      jwtExpirySeconds: 900,
      passwordHashCost: 12,
    },
  );
});

test("authentication config fails clearly without exposing other values", () => {
  const sensitiveValue = "must-not-appear-in-errors".repeat(2);
  assert.throws(
    () =>
      createAuthenticationConfig({
        JWT_SECRET: sensitiveValue,
        JWT_AUDIENCE: "unit-test-audience",
      }),
    (error) =>
      error.message === "JWT_ISSUER is required for authentication." &&
      !error.message.includes(sensitiveValue),
  );
});

test("authentication config rejects blank, short and placeholder secrets", () => {
  for (const JWT_SECRET of [
    "",
    "short-secret",
    "replace-with-a-long-random-secret",
    "replace-me",
  ]) {
    assert.throws(
      () =>
        createAuthenticationConfig({
          JWT_SECRET,
          JWT_ISSUER: "unit-test-issuer",
          JWT_AUDIENCE: "unit-test-audience",
        }),
      /JWT_SECRET/,
    );
  }
  assert.equal(
    createAuthenticationConfig({
      JWT_SECRET: VALID_SECRET,
      JWT_ISSUER: "unit-test-issuer",
      JWT_AUDIENCE: "unit-test-audience",
    }).jwtSecret,
    VALID_SECRET,
  );
});

test("authentication config validates expiry seconds", () => {
  const base = {
    JWT_SECRET: VALID_SECRET,
    JWT_ISSUER: "unit-test-issuer",
    JWT_AUDIENCE: "unit-test-audience",
  };
  for (const JWT_EXPIRY_SECONDS of [
    "not-a-number",
    "300.5",
    "0",
    "-300",
    "299",
    "86401",
  ]) {
    assert.throws(
      () =>
        createAuthenticationConfig({
          ...base,
          JWT_EXPIRY_SECONDS,
        }),
      /between 300 and 86400/,
    );
  }
  assert.equal(
    createAuthenticationConfig({
      ...base,
      JWT_EXPIRY_SECONDS: "3600",
    }).jwtExpirySeconds,
    3600,
  );
});

test("authentication config validates production bcrypt cost", () => {
  const base = {
    JWT_SECRET: VALID_SECRET,
    JWT_ISSUER: "unit-test-issuer",
    JWT_AUDIENCE: "unit-test-audience",
  };
  for (const PASSWORD_HASH_COST of ["ten", "10.5", "9", "15"]) {
    assert.throws(
      () =>
        createAuthenticationConfig({
          ...base,
          PASSWORD_HASH_COST,
        }),
      /between 10 and 14/,
    );
  }
  assert.equal(
    createAuthenticationConfig({
      ...base,
      PASSWORD_HASH_COST: "13",
    }).passwordHashCost,
    13,
  );
});
