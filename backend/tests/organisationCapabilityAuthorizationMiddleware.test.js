const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CAPABILITY_SCOPES,
  ORGANISATION_CAPABILITIES,
  ORGANISATION_CAPABILITY_POLICY,
} = require("../authorization/organisationCapabilityPolicy");
const {
  createRequireOrganisationCapabilityMiddleware,
} = require("../middleware/organisationCapabilityAuthorizationMiddleware");

const USER_ID = "c0000000-0000-4000-8000-000000000002";
const ORGANISATION_ID = "d0000000-0000-4000-8000-000000000001";
const BUSINESS_ID = "e0000000-0000-4000-8000-000000000001";

function createRequest(role = "owner", extras = {}) {
  return {
    originalUrl: "/api/auth/management-context",
    auth: {
      userId: USER_ID,
      role: "untrusted-auth-role",
      capability: "untrusted-auth-capability",
      user: {
        id: USER_ID,
        role: "untrusted-user-role",
      },
    },
    tenant: {
      organisationId: ORGANISATION_ID,
      membership: {
        id: "d0000000-0000-4000-8000-000000000002",
        userId: USER_ID,
        organisationId: ORGANISATION_ID,
        role,
        status: "active",
      },
    },
    business: {
      id: BUSINESS_ID,
      organisationId: ORGANISATION_ID,
      name: "Northside Barbers",
      capability: "untrusted-business-capability",
    },
    headers: {
      "x-role": "owner",
      "x-capability": "organisation.ownership.manage",
    },
    query: { role: "owner", capability: "organisation.ownership.manage" },
    body: { role: "owner", capability: "organisation.ownership.manage" },
    cookies: { role: "owner", capability: "organisation.ownership.manage" },
    ...extras,
  };
}

function createResponse() {
  const writes = [];
  return {
    writes,
    status(status) {
      this.selectedStatus = status;
      return this;
    },
    json(body) {
      writes.push({ status: this.selectedStatus, body });
      return this;
    },
  };
}

function invoke(middleware, request) {
  const response = createResponse();
  let nextCalls = 0;
  middleware(request, response, () => {
    nextCalls += 1;
  });
  return { nextCalls, response };
}

test("every locked capability composes once through the central policy", () => {
  for (const capability of Object.values(ORGANISATION_CAPABILITIES)) {
    assert.equal(
      typeof createRequireOrganisationCapabilityMiddleware({
        capability,
      }),
      "function",
    );
  }
});

test("missing, malformed and unknown capabilities fail at composition", () => {
  for (const capability of [undefined, null, 123, "", "unknown"]) {
    assert.throws(
      () =>
        createRequireOrganisationCapabilityMiddleware({ capability }),
      /Unknown organisation capability/,
    );
  }
});

test("capability and role policy resolve only during composition", () => {
  let resolutionCalls = 0;
  let roleFactoryCalls = 0;
  const roles = ["owner"];
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: "test.capability",
    authorizationPolicy: {
      getCapabilityDefinition(capability) {
        resolutionCalls += 1;
        assert.equal(capability, "test.capability");
        return {
          capability,
          scope: CAPABILITY_SCOPES.ORGANISATION,
          allowedRoles: roles,
        };
      },
    },
    createRoleMiddleware({ allowedRoles }) {
      roleFactoryCalls += 1;
      const copiedRoles = [...allowedRoles];
      return (_request, _response, next) => {
        assert.deepEqual(copiedRoles, ["owner"]);
        next();
      };
    },
  });
  roles.splice(0, 1, "viewer");

  assert.equal(invoke(middleware, createRequest("owner")).nextCalls, 1);
  assert.equal(invoke(middleware, createRequest("owner")).nextCalls, 1);
  assert.equal(resolutionCalls, 1);
  assert.equal(roleFactoryCalls, 1);
});

test("organisation capability does not require business context", () => {
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.SETTINGS_MANAGE,
  });
  const request = createRequest("admin", { business: undefined });
  const before = structuredClone(request);
  const result = invoke(middleware, request);

  assert.equal(result.nextCalls, 1);
  assert.deepEqual(result.response.writes, []);
  assert.deepEqual(request, before);
});

test("organisation capability denies roles not explicitly listed", () => {
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.OWNERSHIP_MANAGE,
  });
  const result = invoke(middleware, createRequest("admin"));

  assert.equal(result.nextCalls, 0);
  assert.deepEqual(result.response.writes, [
    {
      status: 403,
      body: {
        error: {
          code: "AUTHORIZATION_DENIED",
          message: "You are not authorised to perform this action.",
        },
      },
    },
  ]);
});

test("business capability validates scope before role decision", () => {
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.BUSINESS_SETTINGS_MANAGE,
    logger: { error() {} },
  });
  const invalidBusinesses = [
    undefined,
    null,
    {},
    { id: "invalid", organisationId: ORGANISATION_ID },
    { id: BUSINESS_ID, organisationId: "invalid" },
    {
      id: BUSINESS_ID,
      organisationId: "d0000000-0000-4000-8000-000000000009",
    },
  ];

  for (const business of invalidBusinesses) {
    const result = invoke(
      middleware,
      createRequest("owner", { business }),
    );
    assert.equal(result.nextCalls, 0);
    assert.deepEqual(result.response.writes, [
      {
        status: 500,
        body: {
          error: {
            code: "INTERNAL_ERROR",
            message: "The request could not be completed.",
          },
        },
      },
    ]);
  }
});

test("business capability succeeds and denies by explicit role", () => {
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.BUSINESS_OPERATIONS_WRITE,
  });
  const allowedRequest = createRequest("staff");
  const before = structuredClone(allowedRequest);
  const allowed = invoke(middleware, allowedRequest);
  assert.equal(allowed.nextCalls, 1);
  assert.deepEqual(allowed.response.writes, []);
  assert.deepEqual(allowedRequest, before);

  const denied = invoke(middleware, createRequest("viewer"));
  assert.equal(denied.nextCalls, 0);
  assert.equal(denied.response.writes[0].status, 403);
  const observable = JSON.stringify(denied.response.writes);
  assert.equal(observable.includes("business.operations.write"), false);
  assert.equal(observable.includes("viewer"), false);
  assert.equal(observable.includes("staff"), false);
});

test("malformed trusted authentication and tenant context returns 500", () => {
  const logs = [];
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.SETTINGS_MANAGE,
    logger: {
      error(...values) {
        logs.push(values);
      },
    },
  });
  const requests = [
    createRequest("owner", { auth: undefined }),
    createRequest("owner", { auth: {} }),
    createRequest("owner", {
      auth: { userId: "invalid" },
    }),
    createRequest("owner", { tenant: undefined }),
    createRequest("owner", { tenant: {} }),
    createRequest("owner", {
      tenant: { organisationId: "invalid", membership: {} },
    }),
    createRequest("owner", {
      tenant: { organisationId: ORGANISATION_ID },
    }),
    createRequest("owner", {
      tenant: {
        organisationId: ORGANISATION_ID,
        membership: {
          userId: "c0000000-0000-4000-8000-000000000009",
          organisationId: ORGANISATION_ID,
          role: "owner",
          status: "active",
        },
      },
    }),
    createRequest("owner", {
      tenant: {
        organisationId: ORGANISATION_ID,
        membership: {
          userId: USER_ID,
          organisationId:
            "d0000000-0000-4000-8000-000000000009",
          role: "owner",
          status: "active",
        },
      },
    }),
  ];

  for (const request of requests) {
    const result = invoke(middleware, request);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.response.writes[0].status, 500);
    assert.equal(
      result.response.writes[0].body.error.code,
      "INTERNAL_ERROR",
    );
  }
  const observable = JSON.stringify(logs);
  assert.equal(observable.includes(USER_ID), false);
  assert.equal(observable.includes(ORGANISATION_ID), false);
  assert.equal(observable.includes("owner"), false);
});

test("inactive membership fails closed through role foundation", () => {
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.BUSINESS_DATA_READ,
  });
  for (const status of ["invited", "suspended", undefined]) {
    const request = createRequest("owner");
    request.tenant.membership.status = status;
    const result = invoke(middleware, request);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.response.writes[0].status, 403);
  }
});

test("request-supplied capabilities and roles cannot change decision", () => {
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.OWNERSHIP_MANAGE,
  });
  const request = createRequest("viewer");
  const result = invoke(middleware, request);

  assert.equal(result.nextCalls, 0);
  assert.equal(result.response.writes[0].status, 403);
});

test("invalid injected policy definitions fail during composition", () => {
  for (const definition of [
    null,
    { scope: "unknown", allowedRoles: ["owner"] },
    { scope: "organisation", allowedRoles: [] },
  ]) {
    assert.throws(
      () =>
        createRequireOrganisationCapabilityMiddleware({
          capability: "test",
          authorizationPolicy: {
            getCapabilityDefinition() {
              return definition;
            },
          },
        }),
      /invalid definition/,
    );
  }
});

test("central policy decisions remain unchanged after failed mutation", () => {
  const resolved =
    ORGANISATION_CAPABILITY_POLICY.getCapabilityDefinition(
      ORGANISATION_CAPABILITIES.BUSINESS_SETTINGS_MANAGE,
    );
  assert.throws(() => resolved.allowedRoles.push("viewer"), TypeError);
  const middleware = createRequireOrganisationCapabilityMiddleware({
    capability: ORGANISATION_CAPABILITIES.BUSINESS_SETTINGS_MANAGE,
  });
  assert.equal(invoke(middleware, createRequest("viewer")).nextCalls, 0);
});
