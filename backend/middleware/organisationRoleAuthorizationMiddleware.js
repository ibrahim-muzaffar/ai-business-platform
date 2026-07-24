const ORGANISATION_ROLES = Object.freeze([
  "owner",
  "admin",
  "staff",
  "viewer",
]);
const ORGANISATION_ROLE_SET = new Set(ORGANISATION_ROLES);

const AUTHORIZATION_DENIED = Object.freeze({
  code: "AUTHORIZATION_DENIED",
  message: "You are not authorised to perform this action.",
});
const INTERNAL_ERROR = Object.freeze({
  code: "INTERNAL_ERROR",
  message: "The request could not be completed.",
});

function sendError(response, status, error) {
  return response.status(status).json({ error });
}

function createRequireOrganisationRolesMiddleware({
  allowedRoles,
  logger = console,
} = {}) {
  if (
    !Array.isArray(allowedRoles) ||
    allowedRoles.length === 0 ||
    allowedRoles.some(
      (role) =>
        typeof role !== "string" ||
        !ORGANISATION_ROLE_SET.has(role),
    )
  ) {
    throw new Error(
      "allowedRoles must be a non-empty array of valid organisation roles.",
    );
  }
  const allowedRoleSet = new Set(allowedRoles);

  return function requireOrganisationRoles(request, response, next) {
    const membership = request.tenant?.membership;
    if (
      typeof request.auth?.userId !== "string" ||
      !request.tenant ||
      typeof request.tenant.organisationId !== "string" ||
      !membership ||
      typeof membership !== "object"
    ) {
      logger.error("Organisation role authorization failed", {
        route: request.originalUrl,
        code: INTERNAL_ERROR.code,
        status: 500,
      });
      sendError(response, 500, INTERNAL_ERROR);
      return;
    }

    if (
      membership.status !== "active" ||
      typeof membership.role !== "string" ||
      !ORGANISATION_ROLE_SET.has(membership.role) ||
      !allowedRoleSet.has(membership.role)
    ) {
      sendError(response, 403, AUTHORIZATION_DENIED);
      return;
    }

    next();
  };
}

module.exports = {
  AUTHORIZATION_DENIED,
  createRequireOrganisationRolesMiddleware,
  INTERNAL_ERROR,
  ORGANISATION_ROLES,
};
