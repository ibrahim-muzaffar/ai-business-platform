const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CAPABILITY_SCOPES,
  createCapabilityPolicy,
  ORGANISATION_CAPABILITIES,
  ORGANISATION_CAPABILITY_POLICY,
} = require("../authorization/organisationCapabilityPolicy");

const EXPECTED_DEFINITIONS = [
  {
    capability: "organisation.ownership.manage",
    scope: "organisation",
    allowedRoles: ["owner"],
  },
  {
    capability: "organisation.settings.manage",
    scope: "organisation",
    allowedRoles: ["owner", "admin"],
  },
  {
    capability: "business.settings.manage",
    scope: "business",
    allowedRoles: ["owner", "admin"],
  },
  {
    capability: "business.operations.write",
    scope: "business",
    allowedRoles: ["owner", "admin", "staff"],
  },
  {
    capability: "business.data.read",
    scope: "business",
    allowedRoles: ["owner", "admin", "staff", "viewer"],
  },
];

test("locked policy exposes exactly five immutable MVP capabilities", () => {
  assert.deepEqual(
    ORGANISATION_CAPABILITY_POLICY.listCapabilityDefinitions(),
    EXPECTED_DEFINITIONS,
  );
  assert.deepEqual(ORGANISATION_CAPABILITIES, {
    OWNERSHIP_MANAGE: "organisation.ownership.manage",
    SETTINGS_MANAGE: "organisation.settings.manage",
    BUSINESS_SETTINGS_MANAGE: "business.settings.manage",
    BUSINESS_OPERATIONS_WRITE: "business.operations.write",
    BUSINESS_DATA_READ: "business.data.read",
  });

  for (const expected of EXPECTED_DEFINITIONS) {
    const resolved =
      ORGANISATION_CAPABILITY_POLICY.getCapabilityDefinition(
        expected.capability,
      );
    assert.deepEqual(resolved, expected);
    assert.equal(Object.isFrozen(resolved), true);
    assert.equal(Object.isFrozen(resolved.allowedRoles), true);
    assert.throws(() => resolved.allowedRoles.push("viewer"), TypeError);
  }
});

test("role decisions use explicit mappings without hierarchy", () => {
  const allowed = (capability, role) =>
    ORGANISATION_CAPABILITY_POLICY.isOrganisationRoleAllowed({
      capability,
      role,
    });

  assert.equal(
    allowed(ORGANISATION_CAPABILITIES.OWNERSHIP_MANAGE, "owner"),
    true,
  );
  for (const role of ["admin", "staff", "viewer"]) {
    assert.equal(
      allowed(ORGANISATION_CAPABILITIES.OWNERSHIP_MANAGE, role),
      false,
    );
  }

  for (const capability of [
    ORGANISATION_CAPABILITIES.SETTINGS_MANAGE,
    ORGANISATION_CAPABILITIES.BUSINESS_SETTINGS_MANAGE,
  ]) {
    assert.equal(allowed(capability, "owner"), true);
    assert.equal(allowed(capability, "admin"), true);
    assert.equal(allowed(capability, "staff"), false);
    assert.equal(allowed(capability, "viewer"), false);
  }

  for (const role of ["owner", "admin", "staff"]) {
    assert.equal(
      allowed(
        ORGANISATION_CAPABILITIES.BUSINESS_OPERATIONS_WRITE,
        role,
      ),
      true,
    );
  }
  assert.equal(
    allowed(
      ORGANISATION_CAPABILITIES.BUSINESS_OPERATIONS_WRITE,
      "viewer",
    ),
    false,
  );

  for (const role of ["owner", "admin", "staff", "viewer"]) {
    assert.equal(
      allowed(ORGANISATION_CAPABILITIES.BUSINESS_DATA_READ, role),
      true,
    );
  }
  assert.equal(
    allowed(
      ORGANISATION_CAPABILITIES.BUSINESS_DATA_READ,
      "unknown",
    ),
    false,
  );
});

test("policy validation rejects invalid definitions clearly", () => {
  const valid = {
    capability: "test.capability",
    scope: CAPABILITY_SCOPES.ORGANISATION,
    allowedRoles: ["owner"],
  };
  for (const definitions of [
    undefined,
    null,
    [],
    [{}],
    [{ ...valid, capability: "" }],
    [{ ...valid, capability: " test.capability" }],
    [{ ...valid, scope: "unknown" }],
    [{ ...valid, allowedRoles: [] }],
    [{ ...valid, allowedRoles: ["superadmin"] }],
    [{ ...valid, allowedRoles: [null] }],
    [valid, { ...valid }],
  ]) {
    assert.throws(
      () => createCapabilityPolicy(definitions),
      /Capability policy/,
    );
  }
});

test("duplicate roles are removed and input mutation cannot change policy", () => {
  const input = {
    capability: "test.capability",
    scope: CAPABILITY_SCOPES.ORGANISATION,
    allowedRoles: ["owner", "owner", "admin"],
  };
  const policy = createCapabilityPolicy([input]);
  input.scope = CAPABILITY_SCOPES.BUSINESS;
  input.allowedRoles.splice(0, input.allowedRoles.length, "viewer");

  assert.deepEqual(policy.getCapabilityDefinition("test.capability"), {
    capability: "test.capability",
    scope: "organisation",
    allowedRoles: ["owner", "admin"],
  });
  assert.equal(
    policy.isOrganisationRoleAllowed({
      capability: "test.capability",
      role: "viewer",
    }),
    false,
  );
});

test("unknown capability resolution fails as configuration error", () => {
  for (const capability of [undefined, null, 123, "", "unknown"]) {
    assert.throws(
      () =>
        ORGANISATION_CAPABILITY_POLICY.getCapabilityDefinition(
          capability,
        ),
      /Unknown organisation capability/,
    );
  }
  assert.deepEqual(
    ORGANISATION_CAPABILITY_POLICY.getCapabilityDefinition(
      ORGANISATION_CAPABILITIES.BUSINESS_SETTINGS_MANAGE,
    ),
    ORGANISATION_CAPABILITY_POLICY.getCapabilityDefinition(
      ORGANISATION_CAPABILITIES.BUSINESS_SETTINGS_MANAGE,
    ),
  );
});
