const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const { AuthenticationError } = require("../errors/authenticationError");
const { createAuthRouter } = require("../routes/auth");

const SAFE_USER = Object.freeze({
  id: "c0000000-0000-4000-8000-000000000002",
  email: "owner@example.test",
  normalisedEmail: "owner@example.test",
  displayName: "Owner",
  status: "active",
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24T10:00:00.000Z",
});

function createFixture(overrides = {}) {
  const calls = { login: [], register: [], logs: [] };
  const authenticationService = {
    async registerUser(input) {
      calls.register.push(input);
      return {
        user: {
          ...SAFE_USER,
          passwordHash: "must-not-be-exposed",
          unexpectedRepositoryField: "must-not-be-exposed",
        },
        accessToken: "registration-access-token",
      };
    },
    async loginWithPassword(input) {
      calls.login.push(input);
      return {
        user: {
          ...SAFE_USER,
          passwordHash: "must-not-be-exposed",
          unexpectedRepositoryField: "must-not-be-exposed",
        },
        accessToken: "login-access-token",
      };
    },
    ...overrides.authenticationService,
  };
  const router = createAuthRouter({
    getRuntime: () => ({
      authenticationService,
      jwtExpirySeconds: 900,
    }),
    logger: {
      error(...values) {
        calls.logs.push(values);
      },
    },
  });

  return { calls, router };
}

async function requestAuth(
  router,
  path,
  { body, contentType = "application/json", rawBody } = {},
) {
  const app = express();
  app.use("/api/auth", router);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () =>
      resolve(listener),
    );
  });

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/${path}`,
      {
        method: "POST",
        headers: contentType ? { "Content-Type": contentType } : {},
        body: rawBody ?? JSON.stringify(body),
      },
    );
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function assertSafeSuccess(result, expectedStatus, expectedToken) {
  assert.equal(result.status, expectedStatus);
  assert.equal(result.body.accessToken, expectedToken);
  assert.equal(result.body.tokenType, "Bearer");
  assert.equal(result.body.expiresIn, 900);
  assert.deepEqual(result.body.user, SAFE_USER);
  assert.equal("passwordHash" in result.body.user, false);
  assert.equal(JSON.stringify(result.body).includes("password"), false);
}

test("registration returns a safe contract and allowlists service input", async () => {
  const { calls, router } = createFixture();
  const result = await requestAuth(router, "register", {
    body: {
      email: " OWNER@EXAMPLE.TEST ",
      password: "registration password",
      displayName: " Owner ",
      id: "caller-controlled-id",
      status: "disabled",
      passwordHash: "caller-controlled-hash",
      organisationId: "caller-controlled-organisation",
      role: "owner",
      permissions: ["all"],
    },
  });

  assertSafeSuccess(result, 201, "registration-access-token");
  assert.deepEqual(calls.register, [
    {
      email: " OWNER@EXAMPLE.TEST ",
      password: "registration password",
      displayName: "Owner",
    },
  ]);
  assert.equal(calls.login.length, 0);
  assert.deepEqual(calls.logs, []);
});

test("registration accepts omitted or null displayName", async () => {
  for (const [body, expectedDisplayName] of [
    [
      {
        email: "owner@example.test",
        password: "registration password",
      },
      undefined,
    ],
    [
      {
        email: "owner@example.test",
        password: "registration password",
        displayName: null,
      },
      null,
    ],
  ]) {
    const { calls, router } = createFixture();
    const result = await requestAuth(router, "register", { body });
    assert.equal(result.status, 201);
    assert.equal(calls.register.length, 1);
    assert.equal(calls.register[0].displayName, expectedDisplayName);
  }
});

test("registration rejects invalid display names before service invocation", async () => {
  for (const displayName of ["   ", 123, [], {}]) {
    const { calls, router } = createFixture();
    const result = await requestAuth(router, "register", {
      body: {
        email: "owner@example.test",
        password: "registration password",
        displayName,
      },
    });
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      error: {
        code: "VALIDATION_ERROR",
        message: "The supplied authentication details are invalid.",
      },
    });
    assert.equal(calls.register.length, 0);
  }
});

test("registration maps approved and unexpected failures safely", async () => {
  const cases = [
    ["EMAIL_ALREADY_REGISTERED", 409],
    ["AUTHENTICATION_UNAVAILABLE", 503],
  ];
  for (const [code, status] of cases) {
    const { router } = createFixture({
      authenticationService: {
        async registerUser() {
          throw new AuthenticationError(code);
        },
      },
    });
    const result = await requestAuth(router, "register", {
      body: {
        email: "owner@example.test",
        password: "registration password",
      },
    });
    assert.equal(result.status, status);
    assert.equal(result.body.error.code, code);
  }

  const sensitive =
    "database constraint users_normalised_email_unique secret password";
  const { calls, router } = createFixture({
    authenticationService: {
      async registerUser() {
        throw new Error(sensitive);
      },
    },
  });
  const result = await requestAuth(router, "register", {
    body: {
      email: "owner@example.test",
      password: "registration password",
    },
  });
  assert.deepEqual(result, {
    status: 500,
    body: { error: {
      code: "INTERNAL_ERROR",
      message: "Authentication could not be completed.",
    } },
  });
  assert.equal(JSON.stringify(result).includes(sensitive), false);
  assert.equal(JSON.stringify(calls.logs).includes(sensitive), false);
});

test("login returns a safe contract and only passes credentials", async () => {
  const { calls, router } = createFixture();
  const result = await requestAuth(router, "login", {
    body: {
      email: " OWNER@EXAMPLE.TEST ",
      password: "login password",
      organisationId: "ignored",
      role: "owner",
      tokenClaims: { admin: true },
    },
  });

  assertSafeSuccess(result, 200, "login-access-token");
  assert.deepEqual(calls.login, [
    {
      email: " OWNER@EXAMPLE.TEST ",
      password: "login password",
    },
  ]);
  assert.equal(calls.register.length, 0);
  assert.deepEqual(calls.logs, []);
});

test("unknown email and wrong password have identical HTTP responses", async () => {
  const responses = [];
  for (const failure of ["unknown email", "wrong password"]) {
    const { router } = createFixture({
      authenticationService: {
        async loginWithPassword() {
          throw new AuthenticationError("INVALID_CREDENTIALS", failure);
        },
      },
    });
    responses.push(
      await requestAuth(router, "login", {
        body: {
          email: "owner@example.test",
          password: failure,
        },
      }),
    );
  }

  assert.deepEqual(responses[0], responses[1]);
  assert.deepEqual(responses[0], {
    status: 401,
    body: {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "The email or password is incorrect.",
      },
    },
  });
});

test("login maps disabled, infrastructure and unexpected failures safely", async () => {
  for (const [code, status] of [
    ["USER_DISABLED", 403],
    ["AUTHENTICATION_UNAVAILABLE", 503],
  ]) {
    const { router } = createFixture({
      authenticationService: {
        async loginWithPassword() {
          throw new AuthenticationError(code);
        },
      },
    });
    const result = await requestAuth(router, "login", {
      body: {
        email: "owner@example.test",
        password: "login password",
      },
    });
    assert.equal(result.status, status);
    assert.equal(result.body.error.code, code);
  }

  const { calls, router } = createFixture({
    authenticationService: {
      async loginWithPassword() {
        throw new Error("jsonwebtoken secret and token detail");
      },
    },
  });
  const result = await requestAuth(router, "login", {
    body: {
      email: "owner@example.test",
      password: "do-not-log-this-password",
    },
  });
  assert.equal(result.status, 500);
  assert.equal(result.body.error.code, "INTERNAL_ERROR");
  const observable = JSON.stringify({ result, logs: calls.logs });
  assert.equal(observable.includes("do-not-log-this-password"), false);
  assert.equal(observable.includes("jsonwebtoken"), false);
  assert.equal(observable.includes("token detail"), false);
});

test("missing fields and non-object JSON bodies are rejected safely", async () => {
  const invalidBodies = [
    undefined,
    {},
    { email: "owner@example.test" },
    { password: "registration password" },
    { email: 123, password: "registration password" },
    { email: "owner@example.test", password: 123 },
    null,
    [],
    "credentials",
    42,
  ];

  for (const path of ["register", "login"]) {
    for (const body of invalidBodies) {
      const { calls, router } = createFixture();
      const result = await requestAuth(router, path, { body });
      assert.equal(result.status, 400);
      assert.equal(result.body.error.code, "VALIDATION_ERROR");
      assert.equal(calls.register.length + calls.login.length, 0);
    }
  }
});

test("malformed, oversized and unsupported JSON are controlled", async () => {
  const malformed = await requestAuth(createFixture().router, "login", {
    rawBody: '{"email":',
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, "VALIDATION_ERROR");

  const oversized = await requestAuth(createFixture().router, "login", {
    body: {
      email: "owner@example.test",
      password: "x".repeat(17 * 1024),
    },
  });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error.code, "VALIDATION_ERROR");

  const unsupported = await requestAuth(
    createFixture().router,
    "login",
    {
      contentType: "text/plain",
      rawBody: "credentials",
    },
  );
  assert.deepEqual(unsupported, {
    status: 415,
    body: {
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json.",
      },
    },
  });
});
