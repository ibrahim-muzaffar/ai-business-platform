const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAuthenticationService,
  DUMMY_PASSWORD_HASH,
} = require("../services/authenticationService");

const USER_ID = "c0000000-0000-4000-8000-000000000002";
const STORED_USER = {
  id: USER_ID,
  email: "owner@example.test",
  normalisedEmail: "owner@example.test",
  displayName: "Owner",
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  unexpectedInternalProperty: "must-not-be-returned",
};

function createDependencies(overrides = {}) {
  const calls = {
    createUser: [],
    createAccessToken: [],
    findAuthenticationRecord: [],
    findByNormalisedEmail: [],
    hashPassword: [],
    verifyPassword: [],
  };
  const userRepository = {
    async createUser(input) {
      calls.createUser.push(input);
      return { ...STORED_USER, email: input.email };
    },
    async findByNormalisedEmail(email) {
      calls.findByNormalisedEmail.push(email);
      return null;
    },
    async findAuthenticationRecordByNormalisedEmail(email) {
      calls.findAuthenticationRecord.push(email);
      return { ...STORED_USER, passwordHash: "stored-password-hash" };
    },
    ...overrides.userRepository,
  };
  const passwordAdapter = {
    async hashPassword(password) {
      calls.hashPassword.push(password);
      return "generated-password-hash";
    },
    async verifyPassword(password, passwordHash) {
      calls.verifyPassword.push({ password, passwordHash });
      return true;
    },
    ...overrides.passwordAdapter,
  };
  const tokenAdapter = {
    createAccessToken(identity) {
      calls.createAccessToken.push(identity);
      return "signed-access-token";
    },
    verifyAccessToken() {
      return { userId: USER_ID };
    },
    ...overrides.tokenAdapter,
  };

  return {
    calls,
    service: createAuthenticationService({
      passwordAdapter,
      tokenAdapter,
      userRepository,
    }),
  };
}

function assertSafeResult(result) {
  assert.equal(result.accessToken, "signed-access-token");
  assert.equal(result.user.id, USER_ID);
  assert.equal(Object.hasOwn(result.user, "passwordHash"), false);
  assert.equal(Object.hasOwn(result.user, "password_hash"), false);
  assert.equal(
    Object.hasOwn(result.user, "unexpectedInternalProperty"),
    false,
  );
  assert.equal(JSON.stringify(result).includes("stored-password-hash"), false);
  assert.equal(
    JSON.stringify(result).includes("generated-password-hash"),
    false,
  );
}

test("registration normalises email, hashes first and returns safe data", async () => {
  const { calls, service } = createDependencies();
  const result = await service.registerUser({
    email: " OWNER@Example.TEST ",
    password: "registration password",
    displayName: " Owner ",
  });

  assert.deepEqual(calls.findByNormalisedEmail, ["owner@example.test"]);
  assert.deepEqual(calls.hashPassword, ["registration password"]);
  assert.deepEqual(calls.createUser, [
    {
      email: "owner@example.test",
      passwordHash: "generated-password-hash",
      displayName: "Owner",
    },
  ]);
  assert.deepEqual(calls.createAccessToken, [{ userId: USER_ID }]);
  assertSafeResult(result);
});

test("registration maps duplicate checks and database races safely", async () => {
  const duplicate = createDependencies({
    userRepository: {
      async findByNormalisedEmail() {
        return STORED_USER;
      },
    },
  }).service;
  await assert.rejects(
    duplicate.registerUser({
      email: "owner@example.test",
      password: "registration password",
    }),
    (error) => error?.code === "EMAIL_ALREADY_REGISTERED",
  );

  const race = createDependencies({
    userRepository: {
      async createUser() {
        const error = new Error("internal database uniqueness detail");
        error.code = "23505";
        error.constraint = "users_normalised_email_unique";
        throw error;
      },
    },
  }).service;
  await assert.rejects(
    race.registerUser({
      email: "owner@example.test",
      password: "registration password",
    }),
    (error) =>
      error?.code === "EMAIL_ALREADY_REGISTERED" &&
      !error.message.includes("database"),
  );

  const otherUniqueViolation = createDependencies({
    userRepository: {
      async createUser() {
        const error = new Error("different internal uniqueness detail");
        error.code = "23505";
        error.constraint = "some_future_unique_constraint";
        throw error;
      },
    },
  }).service;
  await assert.rejects(
    otherUniqueViolation.registerUser({
      email: "owner@example.test",
      password: "registration password",
    }),
    (error) => error?.code === "AUTHENTICATION_UNAVAILABLE",
  );
});

test("authentication service does not expose repository failures", async () => {
  const registration = createDependencies({
    userRepository: {
      async findByNormalisedEmail() {
        throw new Error("sensitive PostgreSQL connection detail");
      },
    },
  }).service;
  const login = createDependencies({
    userRepository: {
      async findAuthenticationRecordByNormalisedEmail() {
        throw new Error("sensitive PostgreSQL query detail");
      },
    },
  }).service;

  for (const operation of [
    () =>
      registration.registerUser({
        email: "owner@example.test",
        password: "registration password",
      }),
    () =>
      login.loginWithPassword({
        email: "owner@example.test",
        password: "login password",
      }),
  ]) {
    await assert.rejects(
      operation(),
      (error) =>
        error?.code === "AUTHENTICATION_UNAVAILABLE" &&
        !error.message.includes("PostgreSQL"),
    );
  }
});

test("login verifies injected credentials and returns safe data", async () => {
  const { calls, service } = createDependencies();
  const result = await service.loginWithPassword({
    email: " OWNER@EXAMPLE.TEST ",
    password: "login password",
  });

  assert.deepEqual(calls.findAuthenticationRecord, [
    "owner@example.test",
  ]);
  assert.deepEqual(calls.verifyPassword, [
    {
      password: "login password",
      passwordHash: "stored-password-hash",
    },
  ]);
  assert.deepEqual(calls.createAccessToken, [{ userId: USER_ID }]);
  assertSafeResult(result);
});

test("unknown email and wrong password use the same public error", async () => {
  const unknownDependencies = createDependencies({
    userRepository: {
      async findAuthenticationRecordByNormalisedEmail() {
        return null;
      },
    },
  });
  const unknown = unknownDependencies.service;
  const wrongPassword = createDependencies({
    passwordAdapter: {
      async verifyPassword() {
        return false;
      },
    },
  }).service;

  const errors = [];
  for (const service of [unknown, wrongPassword]) {
    await assert.rejects(
      service.loginWithPassword({
        email: "owner@example.test",
        password: "incorrect password",
      }),
      (error) => {
        errors.push({ code: error.code, message: error.message });
        return error.code === "INVALID_CREDENTIALS";
      },
    );
  }
  assert.deepEqual(errors[0], errors[1]);
  assert.deepEqual(unknownDependencies.calls.verifyPassword, [
    {
      password: "incorrect password",
      passwordHash: DUMMY_PASSWORD_HASH,
    },
  ]);
});

test("disabled users disclose status only after correct password verification", async () => {
  const disabledRecord = {
    ...STORED_USER,
    status: "disabled",
    passwordHash: "stored-password-hash",
  };
  const wrongPassword = createDependencies({
    userRepository: {
      async findAuthenticationRecordByNormalisedEmail() {
        return disabledRecord;
      },
    },
    passwordAdapter: {
      async verifyPassword() {
        return false;
      },
    },
  });
  await assert.rejects(
    wrongPassword.service.loginWithPassword({
      email: "owner@example.test",
      password: "incorrect password",
    }),
    (error) => error?.code === "INVALID_CREDENTIALS",
  );
  assert.deepEqual(wrongPassword.calls.createAccessToken, []);

  const correctPassword = createDependencies({
    userRepository: {
      async findAuthenticationRecordByNormalisedEmail() {
        return disabledRecord;
      },
    },
  });

  await assert.rejects(
    correctPassword.service.loginWithPassword({
      email: "owner@example.test",
      password: "login password",
    }),
    (error) =>
      error?.code === "USER_DISABLED" &&
      !error.message.includes("stored-password-hash"),
  );
  assert.equal(correctPassword.calls.verifyPassword.length, 1);
  assert.deepEqual(correctPassword.calls.createAccessToken, []);
});

test("token creation failures are safely mapped and never return success", async () => {
  const tokenAdapter = {
    createAccessToken() {
      throw new Error("sensitive jsonwebtoken signing detail");
    },
    verifyAccessToken() {
      return null;
    },
  };
  const registration = createDependencies({ tokenAdapter });
  const login = createDependencies({ tokenAdapter });

  for (const operation of [
    () =>
      registration.service.registerUser({
        email: "owner@example.test",
        password: "registration password",
      }),
    () =>
      login.service.loginWithPassword({
        email: "owner@example.test",
        password: "login password",
      }),
  ]) {
    await assert.rejects(
      operation(),
      (error) =>
        error?.code === "AUTHENTICATION_UNAVAILABLE" &&
        !error.message.includes("jsonwebtoken"),
    );
  }
  assert.equal(registration.calls.createUser.length, 1);
});

test("authentication service validates email and requires dependencies", async () => {
  const { service } = createDependencies();
  await assert.rejects(
    service.registerUser({
      email: "invalid",
      password: "registration password",
    }),
    (error) => error?.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () => createAuthenticationService({}),
    /repositories and adapters are required/,
  );
  const dependencies = createDependencies();
  assert.throws(
    () =>
      createAuthenticationService({
        userRepository: {},
        passwordAdapter: {
          hashPassword() {},
          verifyPassword() {},
        },
        tokenAdapter: {
          createAccessToken() {},
          verifyAccessToken() {},
        },
      }),
    /repositories and adapters are required/,
  );
  assert.ok(dependencies.service);
});
