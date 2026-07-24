const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createBusinessContextMiddleware,
  parseBusinessId,
} = require("../middleware/businessContextMiddleware");

const USER_ID = "c0000000-0000-4000-8000-000000000002";
const ORGANISATION_ID = "d0000000-0000-4000-8000-000000000001";
const OTHER_ORGANISATION_ID =
  "d0000000-0000-4000-8000-000000000009";
const BUSINESS_ID = "e0000000-0000-4000-8000-000000000001";

const BUSINESS = Object.freeze({
  id: BUSINESS_ID,
  organisationId: ORGANISATION_ID,
  name: "Northside Barbers",
  businessType: "barber",
  description: "must-not-be-attached",
  address: { line1: "must-not-be-attached" },
  status: "active",
  secret: "must-not-be-attached",
  customers: ["must-not-be-attached"],
  permissions: ["must-not-be-attached"],
});

function createRequest(header, extras = {}) {
  return {
    auth: { userId: USER_ID },
    tenant: { organisationId: ORGANISATION_ID },
    rawHeaders:
      header === undefined ? [] : ["X-Business-Id", header],
    get(name) {
      return name.toLowerCase() === "x-business-id"
        ? header
        : undefined;
    },
    ...extras,
  };
}

function createFixture(overrides = {}) {
  const calls = [];
  const businessRepository = {
    async findByIdForOrganisation(organisationId, businessId) {
      calls.push({ organisationId, businessId });
      return { ...BUSINESS };
    },
    ...overrides.businessRepository,
  };
  return {
    calls,
    middleware: createBusinessContextMiddleware({
      businessRepository,
    }),
  };
}

async function invoke(middleware, request) {
  const nextCalls = [];
  await middleware(request, {}, (error) => nextCalls.push(error));
  return nextCalls;
}

test("matching organisation business creates frozen safe context", async () => {
  const { calls, middleware } = createFixture();
  const request = createRequest(BUSINESS_ID, {
    query: {
      businessId: "query-business",
      organisationId: OTHER_ORGANISATION_ID,
    },
    body: {
      businessId: "body-business",
      organisationId: OTHER_ORGANISATION_ID,
    },
    cookies: { businessId: "cookie-business" },
  });
  const nextCalls = await invoke(middleware, request);

  assert.deepEqual(nextCalls, [undefined]);
  assert.deepEqual(calls, [
    { organisationId: ORGANISATION_ID, businessId: BUSINESS_ID },
  ]);
  assert.deepEqual(request.business, {
    id: BUSINESS_ID,
    organisationId: ORGANISATION_ID,
    name: "Northside Barbers",
  });
  assert.equal(Object.isFrozen(request.business), true);
  for (const field of [
    "businessType",
    "description",
    "address",
    "status",
    "secret",
    "customers",
    "permissions",
  ]) {
    assert.equal(field in request.business, false);
  }
});

test("invalid business headers are rejected before repository access", async () => {
  const invalidHeaders = [
    undefined,
    "",
    "   ",
    "not-a-uuid",
    ` ${BUSINESS_ID}`,
    `${BUSINESS_ID} `,
    `${BUSINESS_ID},${BUSINESS_ID}`,
    [BUSINESS_ID],
    123,
  ];

  for (const header of invalidHeaders) {
    const { calls, middleware } = createFixture();
    const request = createRequest(header);
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls.length, 1);
    assert.equal(nextCalls[0]?.code, "BUSINESS_REQUIRED");
    assert.equal(request.business, undefined);
    assert.deepEqual(calls, []);
  }

  const duplicate = createRequest(BUSINESS_ID);
  duplicate.rawHeaders = [
    "X-Business-Id",
    BUSINESS_ID,
    "x-business-id",
    BUSINESS_ID,
  ];
  assert.throws(
    () => parseBusinessId(duplicate),
    (error) => error?.code === "BUSINESS_REQUIRED",
  );
});

test("query, body, cookie and token business claims are ignored", async () => {
  const { calls, middleware } = createFixture();
  const request = createRequest(undefined, {
    auth: {
      userId: USER_ID,
      businessId: BUSINESS_ID,
      organisationId: OTHER_ORGANISATION_ID,
    },
    tenant: {
      organisationId: ORGANISATION_ID,
      businessId: BUSINESS_ID,
    },
    query: { businessId: BUSINESS_ID },
    body: { businessId: BUSINESS_ID },
    cookies: { businessId: BUSINESS_ID },
  });
  const nextCalls = await invoke(middleware, request);

  assert.equal(nextCalls[0]?.code, "BUSINESS_REQUIRED");
  assert.deepEqual(calls, []);
});

test("authentication and organisation context are required", async () => {
  for (const [overrides, expectedCode] of [
    [{ auth: undefined }, "AUTHENTICATION_REQUIRED"],
    [{ auth: null }, "AUTHENTICATION_REQUIRED"],
    [{ auth: {} }, "AUTHENTICATION_REQUIRED"],
    [{ tenant: undefined }, "ORGANISATION_REQUIRED"],
    [{ tenant: null }, "ORGANISATION_REQUIRED"],
    [{ tenant: {} }, "ORGANISATION_REQUIRED"],
    [
      { tenant: { organisationId: "caller-controlled-invalid" } },
      "ORGANISATION_REQUIRED",
    ],
  ]) {
    const { calls, middleware } = createFixture();
    const request = createRequest(BUSINESS_ID, overrides);
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls[0]?.code, expectedCode);
    assert.deepEqual(calls, []);
    assert.equal(request.business, undefined);
  }
});

test("missing and cross-organisation businesses deny access identically", async () => {
  const responses = [];
  for (const business of [
    null,
    { ...BUSINESS, organisationId: OTHER_ORGANISATION_ID },
    { ...BUSINESS, id: "e0000000-0000-4000-8000-000000000009" },
  ]) {
    let repositoryCalls = 0;
    const { middleware } = createFixture({
      businessRepository: {
        async findByIdForOrganisation(organisationId, businessId) {
          repositoryCalls += 1;
          assert.equal(organisationId, ORGANISATION_ID);
          assert.equal(businessId, BUSINESS_ID);
          return business;
        },
      },
    });
    const request = createRequest(BUSINESS_ID);
    const nextCalls = await invoke(middleware, request);
    assert.equal(repositoryCalls, 1);
    assert.equal(request.business, undefined);
    responses.push({
      code: nextCalls[0]?.code,
      message: nextCalls[0]?.message,
    });
  }
  assert.deepEqual(responses[0], responses[1]);
  assert.deepEqual(responses[1], responses[2]);
  assert.equal(responses[0].code, "BUSINESS_ACCESS_DENIED");
});

test("repository failures map to business context unavailable", async () => {
  let repositoryCalls = 0;
  const { middleware } = createFixture({
    businessRepository: {
      async findByIdForOrganisation() {
        repositoryCalls += 1;
        throw new Error("sensitive PostgreSQL business query");
      },
    },
  });
  const request = createRequest(BUSINESS_ID);
  const nextCalls = await invoke(middleware, request);

  assert.equal(repositoryCalls, 1);
  assert.equal(nextCalls[0]?.code, "BUSINESS_CONTEXT_UNAVAILABLE");
  assert.equal(nextCalls[0]?.message.includes("PostgreSQL"), false);
  assert.equal(request.business, undefined);
});

test("unexpected middleware failures remain available to safe error mapping", async () => {
  const business = { ...BUSINESS };
  Object.defineProperty(business, "name", {
    get() {
      throw new Error("unexpected internal mapping failure");
    },
  });
  const { middleware } = createFixture({
    businessRepository: {
      async findByIdForOrganisation() {
        return business;
      },
    },
  });
  const request = createRequest(BUSINESS_ID);
  const nextCalls = await invoke(middleware, request);

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0]?.message, "unexpected internal mapping failure");
  assert.equal(request.business, undefined);
});

test("business context middleware validates repository dependency", () => {
  assert.throws(
    () => createBusinessContextMiddleware({}),
    /organisation-scoped repository/,
  );
});
