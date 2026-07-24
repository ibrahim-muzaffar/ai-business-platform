const assert = require("node:assert/strict");
const test = require("node:test");

const { AuthenticationError } = require("../errors/authenticationError");
const {
  createAuthenticationMiddleware,
  parseBearerToken,
} = require("../middleware/authenticationMiddleware");

const USER_ID = "c0000000-0000-4000-8000-000000000002";
const ACTIVE_USER = Object.freeze({
  id: USER_ID,
  email: "owner@example.test",
  normalisedEmail: "owner@example.test",
  displayName: "Owner",
  status: "active",
  passwordHash: "must-not-be-attached",
  role: "owner",
  organisationId: "must-not-be-attached",
  permissions: ["all"],
});

function createRequest(header, extras = {}) {
  const rawHeaders =
    header === undefined ? [] : ["Authorization", header];
  return {
    rawHeaders,
    get(name) {
      return name.toLowerCase() === "authorization"
        ? header
        : undefined;
    },
    ...extras,
  };
}

function createFixture(overrides = {}) {
  const calls = { findById: [], verify: [] };
  const tokenAdapter = {
    verifyAccessToken(token) {
      calls.verify.push(token);
      return {
        userId: USER_ID,
        email: "untrusted@example.test",
        role: "owner",
        organisationId: "untrusted-tenant",
      };
    },
    ...overrides.tokenAdapter,
  };
  const userRepository = {
    async findById(userId) {
      calls.findById.push(userId);
      return { ...ACTIVE_USER };
    },
    ...overrides.userRepository,
  };
  return {
    calls,
    middleware: createAuthenticationMiddleware({
      tokenAdapter,
      userRepository,
    }),
  };
}

async function invoke(middleware, request) {
  const nextCalls = [];
  await middleware(request, {}, (error) => {
    nextCalls.push(error);
  });
  return nextCalls;
}

test("valid Bearer authentication resolves and freezes safe identity", async () => {
  for (const scheme of ["Bearer", "bearer"]) {
    const { calls, middleware } = createFixture();
    const request = createRequest(`${scheme} signed-access-token`);
    const nextCalls = await invoke(middleware, request);

    assert.deepEqual(nextCalls, [undefined]);
    assert.deepEqual(calls.verify, ["signed-access-token"]);
    assert.deepEqual(calls.findById, [USER_ID]);
    assert.deepEqual(request.auth, {
      userId: USER_ID,
      user: {
        id: USER_ID,
        email: "owner@example.test",
        displayName: "Owner",
        status: "active",
      },
    });
    assert.equal(Object.isFrozen(request.auth), true);
    assert.equal(Object.isFrozen(request.auth.user), true);
    assert.equal("passwordHash" in request.auth.user, false);
    assert.equal("normalisedEmail" in request.auth.user, false);
    assert.equal("role" in request.auth.user, false);
    assert.equal("organisationId" in request.auth, false);
    assert.equal("permissions" in request.auth.user, false);
  }
});

test("malformed Authorization headers are rejected before dependencies", async () => {
  const malformedHeaders = [
    undefined,
    "",
    "   ",
    "Basic value",
    "Bearer",
    "Bearer ",
    "Bearer token extra",
    "token",
    ["Bearer", "token"],
    123,
  ];

  for (const header of malformedHeaders) {
    const { calls, middleware } = createFixture();
    const request = createRequest(header);
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls.length, 1);
    assert.equal(nextCalls[0]?.code, "AUTHENTICATION_REQUIRED");
    assert.equal(request.auth, undefined);
    assert.deepEqual(calls, { findById: [], verify: [] });
  }

  const multiple = createRequest("Bearer first");
  multiple.rawHeaders = [
    "Authorization",
    "Bearer first",
    "authorization",
    "Bearer second",
  ];
  assert.throws(
    () => parseBearerToken(multiple),
    (error) => error?.code === "AUTHENTICATION_REQUIRED",
  );
});

test("query, body, cookie and fallback tokens are ignored", async () => {
  const { calls, middleware } = createFixture();
  const request = createRequest(undefined, {
    query: { accessToken: "query-token" },
    body: { accessToken: "body-token" },
    cookies: { accessToken: "cookie-token" },
    headers: { "x-access-token": "fallback-token" },
  });
  const nextCalls = await invoke(middleware, request);

  assert.equal(nextCalls[0]?.code, "AUTHENTICATION_REQUIRED");
  assert.deepEqual(calls, { findById: [], verify: [] });
  assert.equal(request.auth, undefined);
});

test("token rejection codes remain safe and skip user lookup", async () => {
  const tokenFailures = [
    ["invalid token", "INVALID_TOKEN"],
    ["expired token", "TOKEN_EXPIRED"],
    ["wrong issuer", "INVALID_TOKEN"],
    ["wrong audience", "INVALID_TOKEN"],
    ["wrong token type", "INVALID_TOKEN"],
    ["malformed subject", "INVALID_TOKEN"],
  ];

  for (const [scenario, code] of tokenFailures) {
    const { calls, middleware } = createFixture({
      tokenAdapter: {
        verifyAccessToken() {
          throw new AuthenticationError(code, scenario);
        },
      },
    });
    const request = createRequest("Bearer opaque-token");
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls[0]?.code, code);
    assert.deepEqual(calls.findById, []);
    assert.equal(request.auth, undefined);
  }
});

test("unexpected token-adapter failures map to unavailable safely", async () => {
  const { calls, middleware } = createFixture({
    tokenAdapter: {
      verifyAccessToken() {
        throw new Error("sensitive jsonwebtoken diagnostic");
      },
    },
  });
  const request = createRequest("Bearer do-not-expose-token");
  const nextCalls = await invoke(middleware, request);

  assert.equal(nextCalls[0]?.code, "AUTHENTICATION_UNAVAILABLE");
  assert.equal(
    nextCalls[0]?.message.includes("jsonwebtoken"),
    false,
  );
  assert.deepEqual(calls.findById, []);
  assert.equal(request.auth, undefined);
});

test("missing and disabled users are rejected after one scoped lookup", async () => {
  for (const [user, code] of [
    [null, "INVALID_TOKEN"],
    [{ ...ACTIVE_USER, status: "disabled" }, "USER_DISABLED"],
  ]) {
    const { calls, middleware } = createFixture({
      userRepository: {
        async findById(userId) {
          calls.findById.push(userId);
          return user;
        },
      },
    });
    const request = createRequest("Bearer signed-token");
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls[0]?.code, code);
    assert.deepEqual(calls.verify, ["signed-token"]);
    assert.deepEqual(calls.findById, [USER_ID]);
    assert.equal(request.auth, undefined);
  }
});

test("repository failures are controlled and do not attach identity", async () => {
  const { calls, middleware } = createFixture({
    userRepository: {
      async findById(userId) {
        calls.findById.push(userId);
        throw new Error("sensitive PostgreSQL diagnostic");
      },
    },
  });
  const request = createRequest("Bearer signed-token");
  const nextCalls = await invoke(middleware, request);

  assert.equal(nextCalls[0]?.code, "AUTHENTICATION_UNAVAILABLE");
  assert.equal(nextCalls[0]?.message.includes("PostgreSQL"), false);
  assert.deepEqual(calls.verify, ["signed-token"]);
  assert.deepEqual(calls.findById, [USER_ID]);
  assert.equal(request.auth, undefined);
});

test("middleware validates dependencies at construction", () => {
  assert.throws(
    () => createAuthenticationMiddleware({}),
    /token adapter and user repository/,
  );
});
