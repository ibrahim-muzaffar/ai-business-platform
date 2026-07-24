const { AuthenticationError } = require("../errors/authenticationError");

function parseBearerToken(request) {
  const authorizationHeaders = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === "authorization") {
      authorizationHeaders.push(request.rawHeaders[index + 1]);
    }
  }

  const header = request.get("authorization");
  if (
    authorizationHeaders.length > 1 ||
    typeof header !== "string" ||
    !header.trim()
  ) {
    throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  }

  const segments = header.trim().split(/\s+/);
  if (
    segments.length !== 2 ||
    segments[0].toLowerCase() !== "bearer" ||
    !segments[1]
  ) {
    throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  }
  return segments[1];
}

function safeAuthenticatedUser(user) {
  return Object.freeze({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
  });
}

function createAuthenticationMiddleware({
  tokenAdapter,
  userRepository,
}) {
  if (
    typeof tokenAdapter?.verifyAccessToken !== "function" ||
    typeof userRepository?.findById !== "function"
  ) {
    throw new Error(
      "Authentication middleware token adapter and user repository are required.",
    );
  }

  return async function authenticate(request, _response, next) {
    try {
      const token = parseBearerToken(request);
      let identity;
      try {
        identity = tokenAdapter.verifyAccessToken(token);
      } catch (error) {
        if (
          error instanceof AuthenticationError &&
          ["INVALID_TOKEN", "TOKEN_EXPIRED"].includes(error.code)
        ) {
          throw error;
        }
        throw new AuthenticationError("AUTHENTICATION_UNAVAILABLE");
      }

      let user;
      try {
        user = await userRepository.findById(identity.userId);
      } catch {
        throw new AuthenticationError("AUTHENTICATION_UNAVAILABLE");
      }
      if (!user) throw new AuthenticationError("INVALID_TOKEN");
      if (user.status !== "active") {
        throw new AuthenticationError("USER_DISABLED");
      }

      const authenticatedUser = safeAuthenticatedUser(user);
      request.auth = Object.freeze({
        userId: authenticatedUser.id,
        user: authenticatedUser,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  createAuthenticationMiddleware,
  parseBearerToken,
  safeAuthenticatedUser,
};
