const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const {
  createTokenAdapter,
} = require("../security/tokenAdapter");

const USER_ID = "c0000000-0000-4000-8000-000000000001";
const CONFIG = {
  jwtSecret: "test-secret-that-is-not-used-outside-unit-tests",
  jwtIssuer: "test-issuer",
  jwtAudience: "test-audience",
  jwtExpirySeconds: 900,
};

function signCustom(payload, options = {}, secret = CONFIG.jwtSecret) {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    audience: CONFIG.jwtAudience,
    expiresIn: 900,
    issuer: CONFIG.jwtIssuer,
    ...options,
  });
}

function signRawPayload(payload, secret = CONFIG.jwtSecret) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function standardPayload(overrides = {}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    type: "access",
    sub: USER_ID,
    iss: CONFIG.jwtIssuer,
    aud: CONFIG.jwtAudience,
    iat: issuedAt,
    exp: issuedAt + CONFIG.jwtExpirySeconds,
    ...overrides,
  };
}

test("token adapter creates and verifies a minimal access token", () => {
  const tokens = createTokenAdapter(CONFIG);
  const token = tokens.createAccessToken({ userId: USER_ID });
  const payload = jwt.decode(token);

  assert.deepEqual(Object.keys(payload).sort(), [
    "aud",
    "exp",
    "iat",
    "iss",
    "sub",
    "type",
  ]);
  assert.equal(payload.sub, USER_ID);
  assert.equal(payload.type, "access");
  assert.equal(Object.hasOwn(payload, "email"), false);
  assert.equal(Object.hasOwn(payload, "organisationId"), false);
  assert.equal(Object.hasOwn(payload, "roles"), false);
  const injected = tokens.createAccessToken({
    userId: USER_ID,
    email: "injected@example.test",
    role: "owner",
    exp: 9999999999,
  });
  assert.deepEqual(Object.keys(jwt.decode(injected)).sort(), [
    "aud",
    "exp",
    "iat",
    "iss",
    "sub",
    "type",
  ]);
  assert.deepEqual(tokens.verifyAccessToken(token), {
    userId: USER_ID,
    tokenType: "access",
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  });
});

test("token adapter rejects expired and incorrectly signed tokens", () => {
  const tokens = createTokenAdapter(CONFIG);
  const expired = signCustom(
    { type: "access" },
    { expiresIn: -1, subject: USER_ID },
  );
  assert.throws(
    () => tokens.verifyAccessToken(expired),
    (error) => error?.code === "TOKEN_EXPIRED",
  );

  const wrongSignature = signCustom(
    { type: "access" },
    { subject: USER_ID },
    "different-test-secret",
  );
  assert.throws(
    () => tokens.verifyAccessToken(wrongSignature),
    (error) => error?.code === "INVALID_TOKEN",
  );
});

test("token adapter rejects wrong issuer and audience", () => {
  const tokens = createTokenAdapter(CONFIG);
  const wrongIssuer = signCustom(
    { type: "access" },
    { issuer: "wrong-issuer", subject: USER_ID },
  );
  const wrongAudience = signCustom(
    { type: "access" },
    { audience: "wrong-audience", subject: USER_ID },
  );

  for (const token of [wrongIssuer, wrongAudience]) {
    assert.throws(
      () => tokens.verifyAccessToken(token),
      (error) => error?.code === "INVALID_TOKEN",
    );
  }
});

test("token adapter rejects wrong token types and invalid subjects", () => {
  const tokens = createTokenAdapter(CONFIG);
  const wrongType = signCustom(
    { type: "refresh" },
    { subject: USER_ID },
  );
  const missingSubject = signCustom({ type: "access" });
  const malformedSubject = signCustom(
    { type: "access" },
    { subject: "not-a-user-uuid" },
  );

  for (const token of [wrongType, missingSubject, malformedSubject]) {
    assert.throws(
      () => tokens.verifyAccessToken(token),
      (error) => error?.code === "INVALID_TOKEN",
    );
  }
  assert.throws(
    () => tokens.createAccessToken({ userId: "not-a-user-uuid" }),
    (error) => error?.code === "VALIDATION_ERROR",
  );
});

test("token adapter enforces temporal claims and configured lifetime", () => {
  const tokens = createTokenAdapter(CONFIG);
  const issuedAt = Math.floor(Date.now() / 1000);
  const malformedTokens = [
    signRawPayload(
      standardPayload({ iat: undefined }),
    ),
    signRawPayload(
      standardPayload({ exp: undefined }),
    ),
    signRawPayload(standardPayload({ iat: "not-a-number" })),
    signRawPayload(standardPayload({ exp: "not-a-number" })),
    signRawPayload(
      standardPayload({ iat: issuedAt + 600, exp: issuedAt + 300 }),
    ),
    signRawPayload(
      standardPayload({
        iat: issuedAt,
        exp: issuedAt + CONFIG.jwtExpirySeconds + 1,
      }),
    ),
  ];

  for (const token of malformedTokens) {
    assert.throws(
      () => tokens.verifyAccessToken(token),
      (error) =>
        error?.code === "INVALID_TOKEN" &&
        error.message === "The access token is invalid.",
    );
  }
});

test("malformed tokens expose only the generic invalid-token error", () => {
  const tokens = createTokenAdapter(CONFIG);
  assert.throws(
    () => tokens.verifyAccessToken("not.a.valid.jwt"),
    (error) =>
      error?.code === "INVALID_TOKEN" &&
      error.message === "The access token is invalid." &&
      !error.message.toLowerCase().includes("jwt"),
  );
});
