const DEFAULT_JWT_EXPIRY_SECONDS = 900;
const DEFAULT_PASSWORD_HASH_COST = 12;
const JWT_SECRET_MINIMUM_BYTES = 32;
const JWT_SECRET_PLACEHOLDER = "replace-with-a-long-random-secret";

function requireNonBlank(env, variableName) {
  const value = env[variableName];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${variableName} is required for authentication.`);
  }
  return value.trim();
}

function parsePasswordHashCost(value) {
  if (value === undefined || value === "") {
    return DEFAULT_PASSWORD_HASH_COST;
  }

  const cost = Number(value);
  if (!Number.isInteger(cost) || cost < 10 || cost > 14) {
    throw new Error(
      "PASSWORD_HASH_COST must be an integer between 10 and 14.",
    );
  }
  return cost;
}

function parseJwtExpirySeconds(value) {
  if (value === undefined || value === "") {
    return DEFAULT_JWT_EXPIRY_SECONDS;
  }

  const expirySeconds = Number(value);
  if (
    !Number.isInteger(expirySeconds) ||
    expirySeconds < 300 ||
    expirySeconds > 86400
  ) {
    throw new Error(
      "JWT_EXPIRY_SECONDS must be an integer between 300 and 86400.",
    );
  }
  return expirySeconds;
}

function parseJwtSecret(env) {
  const secret = requireNonBlank(env, "JWT_SECRET");
  if (
    secret === JWT_SECRET_PLACEHOLDER ||
    Buffer.byteLength(secret, "utf8") < JWT_SECRET_MINIMUM_BYTES
  ) {
    throw new Error(
      `JWT_SECRET must contain at least ${JWT_SECRET_MINIMUM_BYTES} UTF-8 bytes and must not use the example placeholder.`,
    );
  }
  return secret;
}

function createAuthenticationConfig(env = process.env) {
  return Object.freeze({
    jwtSecret: parseJwtSecret(env),
    jwtIssuer: requireNonBlank(env, "JWT_ISSUER"),
    jwtAudience: requireNonBlank(env, "JWT_AUDIENCE"),
    jwtExpirySeconds: parseJwtExpirySeconds(env.JWT_EXPIRY_SECONDS),
    passwordHashCost: parsePasswordHashCost(env.PASSWORD_HASH_COST),
  });
}

module.exports = {
  createAuthenticationConfig,
  DEFAULT_JWT_EXPIRY_SECONDS,
  DEFAULT_PASSWORD_HASH_COST,
  JWT_SECRET_MINIMUM_BYTES,
  JWT_SECRET_PLACEHOLDER,
  parseJwtExpirySeconds,
  parsePasswordHashCost,
};
