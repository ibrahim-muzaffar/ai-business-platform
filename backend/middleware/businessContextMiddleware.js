const { AuthenticationError } = require("../errors/authenticationError");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBusinessId(request) {
  const matchingHeaders = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === "x-business-id") {
      matchingHeaders.push(request.rawHeaders[index + 1]);
    }
  }

  const header = request.get("x-business-id");
  if (
    matchingHeaders.length > 1 ||
    typeof header !== "string" ||
    header !== header.trim() ||
    !UUID_PATTERN.test(header) ||
    header.includes(",")
  ) {
    throw new AuthenticationError("BUSINESS_REQUIRED");
  }
  return header;
}

function safeBusiness(business) {
  return Object.freeze({
    id: business.id,
    organisationId: business.organisationId,
    name: business.name,
  });
}

function createBusinessContextMiddleware({ businessRepository }) {
  if (
    typeof businessRepository?.findByIdForOrganisation !== "function"
  ) {
    throw new Error(
      "Business context organisation-scoped repository is required.",
    );
  }

  return async function resolveBusinessContext(
    request,
    _response,
    next,
  ) {
    try {
      if (typeof request.auth?.userId !== "string") {
        throw new AuthenticationError("AUTHENTICATION_REQUIRED");
      }
      if (
        typeof request.tenant?.organisationId !== "string" ||
        !UUID_PATTERN.test(request.tenant.organisationId)
      ) {
        throw new AuthenticationError("ORGANISATION_REQUIRED");
      }

      const businessId = parseBusinessId(request);
      const organisationId = request.tenant.organisationId;
      let business;
      try {
        business =
          await businessRepository.findByIdForOrganisation(
            organisationId,
            businessId,
          );
      } catch {
        throw new AuthenticationError("BUSINESS_CONTEXT_UNAVAILABLE");
      }

      if (
        !business ||
        business.id !== businessId ||
        business.organisationId !== organisationId
      ) {
        throw new AuthenticationError("BUSINESS_ACCESS_DENIED");
      }

      request.business = safeBusiness(business);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  createBusinessContextMiddleware,
  parseBusinessId,
  safeBusiness,
};
