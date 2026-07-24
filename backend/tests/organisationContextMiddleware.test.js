const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createOrganisationContextMiddleware,
  parseOrganisationId,
} = require("../middleware/organisationContextMiddleware");

const USER_ID = "c0000000-0000-4000-8000-000000000002";
const OTHER_USER_ID = "c0000000-0000-4000-8000-000000000003";
const ORGANISATION_ID = "d0000000-0000-4000-8000-000000000001";
const MEMBERSHIP_ID = "d0000000-0000-4000-8000-000000000002";

const ACTIVE_MEMBERSHIP = Object.freeze({
  id: MEMBERSHIP_ID,
  organisationId: ORGANISATION_ID,
  userId: USER_ID,
  role: "owner",
  status: "active",
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24T10:00:00.000Z",
  permissions: ["must-not-be-attached"],
  businessIds: ["must-not-be-attached"],
});
const ORGANISATION = Object.freeze({
  id: ORGANISATION_ID,
  name: "Northside Barbers",
  subscriptionStatus: "active",
  billingReference: "must-not-be-attached",
  createdAt: "2026-07-24T10:00:00.000Z",
  updatedAt: "2026-07-24T10:00:00.000Z",
});

function createRequest(header, extras = {}) {
  return {
    auth: {
      userId: USER_ID,
      user: {
        id: USER_ID,
        organisationId: "untrusted-token-organisation",
        role: "untrusted-token-role",
      },
    },
    rawHeaders:
      header === undefined
        ? []
        : ["X-Organisation-Id", header],
    get(name) {
      return name.toLowerCase() === "x-organisation-id"
        ? header
        : undefined;
    },
    ...extras,
  };
}

function createFixture(overrides = {}) {
  const calls = { membership: [], organisation: [] };
  const organisationMembershipRepository = {
    async findActiveByOrganisationAndUser(organisationId, userId) {
      calls.membership.push({ organisationId, userId });
      return { ...ACTIVE_MEMBERSHIP };
    },
    ...overrides.organisationMembershipRepository,
  };
  const organisationRepository = {
    async findById(organisationId) {
      calls.organisation.push(organisationId);
      return { ...ORGANISATION };
    },
    ...overrides.organisationRepository,
  };
  return {
    calls,
    middleware: createOrganisationContextMiddleware({
      organisationMembershipRepository,
      organisationRepository,
    }),
  };
}

async function invoke(middleware, request) {
  const nextCalls = [];
  await middleware(request, {}, (error) => nextCalls.push(error));
  return nextCalls;
}

test("active membership resolves a frozen allowlisted tenant context", async () => {
  const { calls, middleware } = createFixture();
  const request = createRequest(ORGANISATION_ID, {
    query: {
      userId: OTHER_USER_ID,
      organisationId: "query-organisation",
    },
    body: {
      userId: OTHER_USER_ID,
      organisationId: "body-organisation",
    },
    cookies: { organisationId: "cookie-organisation" },
  });
  const nextCalls = await invoke(middleware, request);

  assert.deepEqual(nextCalls, [undefined]);
  assert.deepEqual(calls.membership, [
    { organisationId: ORGANISATION_ID, userId: USER_ID },
  ]);
  assert.deepEqual(calls.organisation, [ORGANISATION_ID]);
  assert.deepEqual(request.tenant, {
    organisationId: ORGANISATION_ID,
    organisation: {
      id: ORGANISATION_ID,
      name: "Northside Barbers",
    },
    membership: {
      id: MEMBERSHIP_ID,
      userId: USER_ID,
      organisationId: ORGANISATION_ID,
      role: "owner",
      status: "active",
    },
  });
  assert.equal(Object.isFrozen(request.tenant), true);
  assert.equal(Object.isFrozen(request.tenant.organisation), true);
  assert.equal(Object.isFrozen(request.tenant.membership), true);
  assert.equal("subscriptionStatus" in request.tenant.organisation, false);
  assert.equal("billingReference" in request.tenant.organisation, false);
  assert.equal("permissions" in request.tenant.membership, false);
  assert.equal("businessIds" in request.tenant.membership, false);
});

test("invalid organisation headers are rejected before repository access", async () => {
  const invalidHeaders = [
    undefined,
    "",
    "   ",
    "not-a-uuid",
    ` ${ORGANISATION_ID}`,
    `${ORGANISATION_ID} `,
    `${ORGANISATION_ID},${ORGANISATION_ID}`,
    [ORGANISATION_ID],
    123,
  ];

  for (const header of invalidHeaders) {
    const { calls, middleware } = createFixture();
    const request = createRequest(header);
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls.length, 1);
    assert.equal(nextCalls[0]?.code, "ORGANISATION_REQUIRED");
    assert.equal(request.tenant, undefined);
    assert.deepEqual(calls, { membership: [], organisation: [] });
  }

  const duplicate = createRequest(ORGANISATION_ID);
  duplicate.rawHeaders = [
    "X-Organisation-Id",
    ORGANISATION_ID,
    "x-organisation-id",
    ORGANISATION_ID,
  ];
  assert.throws(
    () => parseOrganisationId(duplicate),
    (error) => error?.code === "ORGANISATION_REQUIRED",
  );
});

test("query, body, cookie and token organisation values are ignored", async () => {
  const { calls, middleware } = createFixture();
  const request = createRequest(undefined, {
    auth: {
      userId: USER_ID,
      organisationId: ORGANISATION_ID,
      user: { id: USER_ID, organisationId: ORGANISATION_ID },
    },
    query: { organisationId: ORGANISATION_ID },
    body: { organisationId: ORGANISATION_ID },
    cookies: { organisationId: ORGANISATION_ID },
  });
  const nextCalls = await invoke(middleware, request);

  assert.equal(nextCalls[0]?.code, "ORGANISATION_REQUIRED");
  assert.deepEqual(calls, { membership: [], organisation: [] });
});

test("missing authenticated identity is rejected before tenant lookup", async () => {
  for (const auth of [undefined, null, {}, { userId: 123 }]) {
    const { calls, middleware } = createFixture();
    const request = createRequest(ORGANISATION_ID, { auth });
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls[0]?.code, "AUTHENTICATION_REQUIRED");
    assert.deepEqual(calls, { membership: [], organisation: [] });
    assert.equal(request.tenant, undefined);
  }
});

test("missing, invited, suspended and mismatched memberships deny access", async () => {
  const membershipResults = [
    null,
    { ...ACTIVE_MEMBERSHIP, status: "invited" },
    { ...ACTIVE_MEMBERSHIP, status: "suspended" },
    { ...ACTIVE_MEMBERSHIP, userId: OTHER_USER_ID },
    {
      ...ACTIVE_MEMBERSHIP,
      organisationId: "d0000000-0000-4000-8000-000000000009",
    },
  ];

  for (const membership of membershipResults) {
    const { calls, middleware } = createFixture({
      organisationMembershipRepository: {
        async findActiveByOrganisationAndUser(organisationId, userId) {
          calls.membership.push({ organisationId, userId });
          return membership;
        },
      },
    });
    const request = createRequest(ORGANISATION_ID);
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls[0]?.code, "ORGANISATION_ACCESS_DENIED");
    assert.equal(request.tenant, undefined);
    assert.equal(calls.membership.length, 1);
    assert.deepEqual(calls.organisation, []);
  }
});

test("missing or mismatched organisations deny access generically", async () => {
  for (const organisation of [
    null,
    {
      ...ORGANISATION,
      id: "d0000000-0000-4000-8000-000000000009",
    },
  ]) {
    const { calls, middleware } = createFixture({
      organisationRepository: {
        async findById(organisationId) {
          calls.organisation.push(organisationId);
          return organisation;
        },
      },
    });
    const request = createRequest(ORGANISATION_ID);
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls[0]?.code, "ORGANISATION_ACCESS_DENIED");
    assert.equal(calls.membership.length, 1);
    assert.equal(calls.organisation.length, 1);
    assert.equal(request.tenant, undefined);
  }
});

test("membership and organisation repository failures map to unavailable", async () => {
  for (const failingRepository of ["membership", "organisation"]) {
    let failureCalls = 0;
    const overrides =
      failingRepository === "membership"
        ? {
            organisationMembershipRepository: {
              async findActiveByOrganisationAndUser() {
                failureCalls += 1;
                throw new Error("sensitive membership SQL");
              },
            },
          }
        : {
            organisationRepository: {
              async findById() {
                failureCalls += 1;
                throw new Error("sensitive organisation SQL");
              },
            },
          };
    const { calls, middleware } = createFixture(overrides);
    const request = createRequest(ORGANISATION_ID);
    const nextCalls = await invoke(middleware, request);
    assert.equal(nextCalls[0]?.code, "TENANT_CONTEXT_UNAVAILABLE");
    assert.equal(nextCalls[0]?.message.includes("SQL"), false);
    assert.equal(request.tenant, undefined);
    assert.equal(failureCalls, 1);
    assert.equal(
      calls.membership.length,
      failingRepository === "membership" ? 0 : 1,
    );
  }
});

test("organisation context middleware validates dependencies", () => {
  assert.throws(
    () => createOrganisationContextMiddleware({}),
    /membership and organisation repositories/,
  );
});
