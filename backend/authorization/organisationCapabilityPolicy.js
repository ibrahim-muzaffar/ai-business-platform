const {
  ORGANISATION_ROLES,
} = require("../middleware/organisationRoleAuthorizationMiddleware");

const CAPABILITY_SCOPES = Object.freeze({
  ORGANISATION: "organisation",
  BUSINESS: "business",
});

const ORGANISATION_CAPABILITIES = Object.freeze({
  OWNERSHIP_MANAGE: "organisation.ownership.manage",
  SETTINGS_MANAGE: "organisation.settings.manage",
  BUSINESS_SETTINGS_MANAGE: "business.settings.manage",
  BUSINESS_OPERATIONS_WRITE: "business.operations.write",
  BUSINESS_DATA_READ: "business.data.read",
});

const VALID_SCOPES = new Set(Object.values(CAPABILITY_SCOPES));
const VALID_ROLES = new Set(ORGANISATION_ROLES);

function createCapabilityPolicy(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new Error(
      "Capability policy definitions must be a non-empty array.",
    );
  }

  const definitionsByCapability = new Map();
  for (const definition of definitions) {
    if (
      !definition ||
      typeof definition.capability !== "string" ||
      !definition.capability ||
      definition.capability !== definition.capability.trim() ||
      definitionsByCapability.has(definition.capability) ||
      !VALID_SCOPES.has(definition.scope) ||
      !Array.isArray(definition.allowedRoles) ||
      definition.allowedRoles.length === 0 ||
      definition.allowedRoles.some(
        (role) => typeof role !== "string" || !VALID_ROLES.has(role),
      )
    ) {
      throw new Error("Capability policy contains an invalid definition.");
    }

    const safeDefinition = Object.freeze({
      capability: definition.capability,
      scope: definition.scope,
      allowedRoles: Object.freeze([...new Set(definition.allowedRoles)]),
    });
    definitionsByCapability.set(
      safeDefinition.capability,
      safeDefinition,
    );
  }

  function getCapabilityDefinition(capability) {
    if (
      typeof capability !== "string" ||
      !definitionsByCapability.has(capability)
    ) {
      throw new Error("Unknown organisation capability.");
    }
    return definitionsByCapability.get(capability);
  }

  function isOrganisationRoleAllowed({ capability, role }) {
    if (typeof role !== "string" || !VALID_ROLES.has(role)) {
      return false;
    }
    return getCapabilityDefinition(capability).allowedRoles.includes(role);
  }

  function listCapabilityDefinitions() {
    return Object.freeze([...definitionsByCapability.values()]);
  }

  return Object.freeze({
    getCapabilityDefinition,
    isOrganisationRoleAllowed,
    listCapabilityDefinitions,
  });
}

const ORGANISATION_CAPABILITY_POLICY = createCapabilityPolicy([
  {
    capability: ORGANISATION_CAPABILITIES.OWNERSHIP_MANAGE,
    scope: CAPABILITY_SCOPES.ORGANISATION,
    allowedRoles: ["owner"],
  },
  {
    capability: ORGANISATION_CAPABILITIES.SETTINGS_MANAGE,
    scope: CAPABILITY_SCOPES.ORGANISATION,
    allowedRoles: ["owner", "admin"],
  },
  {
    capability: ORGANISATION_CAPABILITIES.BUSINESS_SETTINGS_MANAGE,
    scope: CAPABILITY_SCOPES.BUSINESS,
    allowedRoles: ["owner", "admin"],
  },
  {
    capability: ORGANISATION_CAPABILITIES.BUSINESS_OPERATIONS_WRITE,
    scope: CAPABILITY_SCOPES.BUSINESS,
    allowedRoles: ["owner", "admin", "staff"],
  },
  {
    capability: ORGANISATION_CAPABILITIES.BUSINESS_DATA_READ,
    scope: CAPABILITY_SCOPES.BUSINESS,
    allowedRoles: ["owner", "admin", "staff", "viewer"],
  },
]);

module.exports = {
  CAPABILITY_SCOPES,
  createCapabilityPolicy,
  ORGANISATION_CAPABILITIES,
  ORGANISATION_CAPABILITY_POLICY,
};
