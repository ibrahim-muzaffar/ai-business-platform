const jwt = require("jsonwebtoken");

const { createAuthenticationConfig } = require("../config/authentication");
const { AuthenticationError } = require("../errors/authenticationError");

const ACCESS_TOKEN_TYPE = "access";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validSubject(subject) {
  return typeof subject === "string" && UUID_PATTERN.test(subject);
}

function createTokenAdapter(config = createAuthenticationConfig()) {
  const {
    jwtAudience,
    jwtExpirySeconds,
    jwtIssuer,
    jwtSecret,
  } = config;

  function createAccessToken(identity) {
    if (!validSubject(identity?.userId)) {
      throw new AuthenticationError(
        "VALIDATION_ERROR",
        "A valid user ID is required to create an access token.",
      );
    }

    return jwt.sign(
      { type: ACCESS_TOKEN_TYPE },
      jwtSecret,
      {
        algorithm: "HS256",
        audience: jwtAudience,
        expiresIn: jwtExpirySeconds,
        issuer: jwtIssuer,
        subject: identity.userId,
      },
    );
  }

  function verifyAccessToken(token) {
    try {
      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ["HS256"],
        audience: jwtAudience,
        issuer: jwtIssuer,
      });
      if (
        typeof payload !== "object" ||
        payload.type !== ACCESS_TOKEN_TYPE ||
        !validSubject(payload.sub) ||
        typeof payload.iat !== "number" ||
        !Number.isFinite(payload.iat) ||
        typeof payload.exp !== "number" ||
        !Number.isFinite(payload.exp) ||
        payload.exp <= payload.iat ||
        payload.exp - payload.iat > jwtExpirySeconds
      ) {
        throw new AuthenticationError("INVALID_TOKEN");
      }
      return {
        userId: payload.sub,
        tokenType: payload.type,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      if (error?.name === "TokenExpiredError") {
        throw new AuthenticationError("TOKEN_EXPIRED");
      }
      throw new AuthenticationError("INVALID_TOKEN");
    }
  }

  return { createAccessToken, verifyAccessToken };
}

let defaultAdapter;

function getDefaultAdapter() {
  defaultAdapter ??= createTokenAdapter();
  return defaultAdapter;
}

function createAccessToken(identity) {
  return getDefaultAdapter().createAccessToken(identity);
}

function verifyAccessToken(token) {
  return getDefaultAdapter().verifyAccessToken(token);
}

module.exports = {
  ACCESS_TOKEN_TYPE,
  createAccessToken,
  createTokenAdapter,
  verifyAccessToken,
};
