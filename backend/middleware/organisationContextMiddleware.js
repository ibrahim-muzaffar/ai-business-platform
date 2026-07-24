const { AuthenticationError } = require("../errors/authenticationError");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseOrganisationId(request) {
  const matchingHeaders = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === "x-organisation-id") {
      matchingHeaders.push(request.rawHeaders[index + 1]);
    }
  }

  const header = request.get("x-organisation-id");
  if (
    matchingHeaders.length > 1 ||
    typeof header !== "string" ||
    header !== header.trim() ||
    !UUID_PATTERN.test(header) ||
    header.includes(",")
  ) {
    throw new AuthenticationError("ORGANISATION_REQUIRED");
  }
  return header;
}

function safeOrganisation(organisation) {
  return Object.freeze({
    id: organisation.id,
    name: organisation.name,
  });
}

function safeMembership(membership) {
  return Object.freeze({
    id: membership.id,
    userId: membership.userId,
    organisationId: membership.organisationId,
    role: membership.role,
    status: membership.status,
  });
}

function createOrganisationContextMiddleware({
  organisationMembershipRepository,
  organisationRepository,
}) {
  if (
    typeof organisationMembershipRepository
      ?.findActiveByOrganisationAndUser !== "function" ||
    typeof organisationRepository?.findById !== "function"
  ) {
    throw new Error(
      "Organisation context membership and organisation repositories are required.",
    );
  }

  return async function resolveOrganisationContext(
    request,
    _response,
    next,
  ) {
    try {
      if (typeof request.auth?.userId !== "string") {
        throw new AuthenticationError("AUTHENTICATION_REQUIRED");
      }
      const organisationId = parseOrganisationId(request);

      let membership;
      try {
        membership =
          await organisationMembershipRepository
            .findActiveByOrganisationAndUser(
              organisationId,
              request.auth.userId,
            );
      } catch {
        throw new AuthenticationError("TENANT_CONTEXT_UNAVAILABLE");
      }
      if (
        !membership ||
        membership.status !== "active" ||
        membership.organisationId !== organisationId ||
        membership.userId !== request.auth.userId
      ) {
        throw new AuthenticationError("ORGANISATION_ACCESS_DENIED");
      }

      let organisation;
      try {
        organisation = await organisationRepository.findById(
          organisationId,
        );
      } catch {
        throw new AuthenticationError("TENANT_CONTEXT_UNAVAILABLE");
      }
      if (!organisation || organisation.id !== organisationId) {
        throw new AuthenticationError("ORGANISATION_ACCESS_DENIED");
      }

      const safeOrganisationValue = safeOrganisation(organisation);
      const safeMembershipValue = safeMembership(membership);
      request.tenant = Object.freeze({
        organisationId: safeOrganisationValue.id,
        organisation: safeOrganisationValue,
        membership: safeMembershipValue,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  createOrganisationContextMiddleware,
  parseOrganisationId,
  safeMembership,
  safeOrganisation,
};
