const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAuthenticationRuntime,
} = require("../runtime/authentication");

const VALID_ENV = Object.freeze({
  JWT_SECRET: "a-secure-test-secret-with-at-least-32-bytes",
  JWT_ISSUER: "test-issuer",
  JWT_AUDIENCE: "test-audience",
  JWT_EXPIRY_SECONDS: "900",
  PASSWORD_HASH_COST: "10",
});

test("authentication runtime validates configuration before database access", () => {
  let connectionRequests = 0;
  assert.throws(
    () =>
      createAuthenticationRuntime({
        env: { ...VALID_ENV, JWT_SECRET: "short" },
        getConnection() {
          connectionRequests += 1;
        },
      }),
    /JWT_SECRET/,
  );
  assert.equal(connectionRequests, 0);
});

test("authentication runtime composes one injected database dependency", () => {
  const calls = [];
  const db = () => {
    throw new Error("Database access is not expected during composition.");
  };
  const runtime = createAuthenticationRuntime({
    env: VALID_ENV,
    getConnection(environment) {
      calls.push(environment);
      return db;
    },
  });

  assert.deepEqual(calls, ["development"]);
  assert.equal(runtime.jwtExpirySeconds, 900);
  assert.equal(
    typeof runtime.authenticationService.registerUser,
    "function",
  );
  assert.equal(
    typeof runtime.authenticationService.loginWithPassword,
    "function",
  );
  assert.equal(typeof runtime.authenticationMiddleware, "function");
  assert.equal(
    typeof runtime.organisationContextMiddleware,
    "function",
  );
});
