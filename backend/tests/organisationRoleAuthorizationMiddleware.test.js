const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createRequireOrganisationRolesMiddleware,
  ORGANISATION_ROLES,
} = require("../middleware/organisationRoleAuthorizationMiddleware");

const USER_ID = "c0000000-0000-4000-8000-000000000002";
const ORGANISATION_ID = "d0000000-0000-4000-8000-000000000001";

function createRequest(role = "owner", status = "active", extras = {}) {
  return {
    originalUrl: "/api/auth/management-context",
    auth: {
      userId: USER_ID,
      role: "untrusted-auth-role",
      user: { id: USER_ID, role: "untrusted-user-role" },
    },
    tenant: {
      organisationId: ORGANISATION_ID,
      membership: {
        id: "d0000000-0000-4000-8000-000000000002",
        organisationId: ORGANISATION_ID,
        userId: USER_ID,
        role,
        status,
      },
    },
    headers: { "x-role": "untrusted-header-role" },
    query: { role: "untrusted-query-role" },
    body: { role: "untrusted-body-role" },
    cookies: { role: "untrusted-cookie-role" },
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

test("factory accepts explicit valid role policies", () => {
  assert.equal(
    typeof createRequireOrganisationRolesMiddleware({
      allowedRoles: ["owner"],
    }),
    "function",
  );
  assert.equal(
    typeof createRequireOrganisationRolesMiddleware({
      allowedRoles: ["owner", "admin"],
    }),
    "function",
  );
  assert.equal(
    typeof createRequireOrganisationRolesMiddleware({
      allowedRoles: ["owner", "owner", "admin"],
    }),
    "function",
  );
});

test("factory rejects missing, empty, malformed and unknown policies", () => {
  for (const allowedRoles of [
    undefined,
    null,
    "owner",
    [],
    ["superadmin"],
    [""],
    [null],
    [123],
    [{}],
  ]) {
    assert.throws(
      () =>
        createRequireOrganisationRolesMiddleware({ allowedRoles }),
      /allowedRoles/,
    );
  }
});

test("configured roles are copied and cannot be changed by the caller", () => {
  const allowedRoles = ["owner"];
  const middleware = createRequireOrganisationRolesMiddleware({
    allowedRoles,
  });
  allowedRoles.splice(0, 1, "viewer");

  assert.equal(invoke(middleware, createRequest("owner")).nextCalls, 1);
  const denied = invoke(middleware, createRequest("viewer"));
  assert.equal(denied.nextCalls, 0);
  assert.equal(denied.response.writes[0].status, 403);
});

test("each configured organisation role succeeds only when explicit", () => {
  for (const role of ORGANISATION_ROLES) {
    const middleware = createRequireOrganisationRolesMiddleware({
      allowedRoles: [role],
    });
    const request = createRequest(role);
    const before = structuredClone(request);
    const result = invoke(middleware, request);

    assert.equal(result.nextCalls, 1);
    assert.deepEqual(result.response.writes, []);
    assert.deepEqual(request, before);
  }
});

test("owner and admin are not implicitly allowed by other policies", () => {
  for (const [role, allowedRoles] of [
    ["owner", ["admin"]],
    ["admin", ["owner"]],
    ["staff", ["owner", "admin"]],
    ["viewer", ["owner", "admin"]],
  ]) {
    const result = invoke(
      createRequireOrganisationRolesMiddleware({ allowedRoles }),
      createRequest(role),
    );
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
    const serialized = JSON.stringify(result.response.writes);
    assert.equal(serialized.includes(role), false);
    assert.equal(serialized.includes("owner"), false);
    assert.equal(serialized.includes("admin"), false);
  }
});

test("inactive, unknown and missing role state never grants access", () => {
  const middleware = createRequireOrganisationRolesMiddleware({
    allowedRoles: ["owner", "admin"],
  });
  const contexts = [
    createRequest("owner", "invited"),
    createRequest("owner", "suspended"),
    createRequest("unknown", "active"),
    createRequest(null, "active"),
  ];
  const missingRole = createRequest("owner", "active");
  delete missingRole.tenant.membership.role;
  contexts.push(missingRole);

  for (const request of contexts) {
    const result = invoke(middleware, request);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.response.writes.length, 1);
    assert.equal(
      result.response.writes[0].body.error.code,
      "AUTHORIZATION_DENIED",
    );
  }
});

test("only the trusted tenant membership role is used", () => {
  const middleware = createRequireOrganisationRolesMiddleware({
    allowedRoles: ["owner"],
  });
  const denied = invoke(
    middleware,
    createRequest("viewer", "active", {
      auth: {
        userId: USER_ID,
        role: "owner",
        user: { id: USER_ID, role: "owner" },
      },
      headers: { role: "owner" },
      query: { role: "owner" },
      body: { role: "owner" },
      cookies: { role: "owner" },
    }),
  );

  assert.equal(denied.nextCalls, 0);
  assert.equal(denied.response.writes[0].status, 403);
});

test("missing trusted middleware context returns controlled internal failure", () => {
  const logs = [];
  const middleware = createRequireOrganisationRolesMiddleware({
    allowedRoles: ["owner"],
    logger: {
      error(...values) {
        logs.push(values);
      },
    },
  });
  const malformedRequests = [
    createRequest("owner", "active", { auth: undefined }),
    createRequest("owner", "active", { auth: null }),
    createRequest("owner", "active", { auth: {} }),
    createRequest("owner", "active", { tenant: undefined }),
    createRequest("owner", "active", { tenant: null }),
    createRequest("owner", "active", {
      tenant: { organisationId: ORGANISATION_ID },
    }),
    createRequest("owner", "active", {
      tenant: { organisationId: 123, membership: {} },
    }),
  ];

  for (const request of malformedRequests) {
    const result = invoke(middleware, request);
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
  const observable = JSON.stringify(logs);
  assert.equal(observable.includes(USER_ID), false);
  assert.equal(observable.includes(ORGANISATION_ID), false);
  assert.equal(observable.includes("owner"), false);
});

test("role middleware has no repository or database dependency", () => {
  const middleware = createRequireOrganisationRolesMiddleware({
    allowedRoles: ["owner"],
    repository: {
      find() {
        throw new Error("must not be used");
      },
    },
    database: {
      query() {
        throw new Error("must not be used");
      },
    },
  });
  assert.equal(invoke(middleware, createRequest("owner")).nextCalls, 1);
});
