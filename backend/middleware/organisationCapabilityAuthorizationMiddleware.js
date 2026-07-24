const {
  CAPABILITY_SCOPES,
  ORGANISATION_CAPABILITY_POLICY,
} = require("../authorization/organisationCapabilityPolicy");
const {
  createRequireOrganisationRolesMiddleware,
  INTERNAL_ERROR,
} = require("./organisationRoleAuthorizationMiddleware");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendInternalError(request, response, logger) {
  logger.error("Organisation capability authorization failed", {
    route: request.originalUrl,
    code: INTERNAL_ERROR.code,
    status: 500,
  });
  response.status(500).json({ error: INTERNAL_ERROR });
}

function createRequireOrganisationCapabilityMiddleware({
  capability,
  authorizationPolicy = ORGANISATION_CAPABILITY_POLICY,
  createRoleMiddleware = createRequireOrganisationRolesMiddleware,
  logger = console,
} = {}) {
  if (
    typeof authorizationPolicy?.getCapabilityDefinition !== "function" ||
    typeof createRoleMiddleware !== "function"
  ) {
    throw new Error(
      "Capability authorization policy and role middleware factory are required.",
    );
  }

  const definition =
    authorizationPolicy.getCapabilityDefinition(capability);
  if (
    !definition ||
    !Object.values(CAPABILITY_SCOPES).includes(definition.scope) ||
    !Array.isArray(definition.allowedRoles) ||
    definition.allowedRoles.length === 0
  ) {
    throw new Error("Capability policy returned an invalid definition.");
  }
  const scope = definition.scope;
  const requireRole = createRoleMiddleware({
    allowedRoles: [...definition.allowedRoles],
    logger,
  });

  return function requireOrganisationCapability(
    request,
    response,
    next,
  ) {
    if (
      typeof request.auth?.userId !== "string" ||
      !UUID_PATTERN.test(request.auth.userId) ||
      !request.tenant ||
      !UUID_PATTERN.test(request.tenant.organisationId) ||
      !request.tenant.membership ||
      typeof request.tenant.membership !== "object" ||
      !UUID_PATTERN.test(request.tenant.membership.userId) ||
      !UUID_PATTERN.test(
        request.tenant.membership.organisationId,
      ) ||
      request.tenant.membership.userId !== request.auth.userId ||
      request.tenant.membership.organisationId !==
        request.tenant.organisationId
    ) {
      sendInternalError(request, response, logger);
      return;
    }

    if (
      scope === CAPABILITY_SCOPES.BUSINESS &&
      (!request.business ||
        !UUID_PATTERN.test(request.business.id) ||
        !UUID_PATTERN.test(request.business.organisationId) ||
        request.business.organisationId !==
          request.tenant.organisationId)
    ) {
      sendInternalError(request, response, logger);
      return;
    }

    requireRole(request, response, next);
  };
}

module.exports = {
  createRequireOrganisationCapabilityMiddleware,
};
