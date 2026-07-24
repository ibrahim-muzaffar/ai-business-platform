const { AuthenticationError } = require("../errors/authenticationError");
const {
  normaliseEmail,
} = require("../repositories/postgres/userRepository");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_PASSWORD_HASH =
  "$2b$12$5Ck6PlD0Y8h2vLQmGQJpEOp3Te2Gf6THvKhPAEqKcQJprHqPqkCti";

function validateEmail(email) {
  const normalised = normaliseEmail(email);
  if (
    typeof normalised !== "string" ||
    !normalised ||
    !EMAIL_PATTERN.test(normalised)
  ) {
    throw new AuthenticationError(
      "VALIDATION_ERROR",
      "A valid email address is required.",
    );
  }
  return normalised;
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    normalisedEmail: user.normalisedEmail,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function safeInfrastructureError() {
  return new AuthenticationError("AUTHENTICATION_UNAVAILABLE");
}

function createAuthenticationService({
  userRepository,
  passwordAdapter,
  tokenAdapter,
}) {
  const requiredMethods = [
    [userRepository, "findByNormalisedEmail"],
    [userRepository, "findAuthenticationRecordByNormalisedEmail"],
    [userRepository, "createUser"],
    [passwordAdapter, "hashPassword"],
    [passwordAdapter, "verifyPassword"],
    [tokenAdapter, "createAccessToken"],
    [tokenAdapter, "verifyAccessToken"],
  ];
  if (
    requiredMethods.some(
      ([dependency, method]) => typeof dependency?.[method] !== "function",
    )
  ) {
    throw new Error(
      "Authentication service repositories and adapters are required.",
    );
  }

  function createTokenSafely(userId) {
    try {
      return tokenAdapter.createAccessToken({ userId });
    } catch {
      throw safeInfrastructureError();
    }
  }

  async function registerUser(input = {}) {
    const normalisedEmail = validateEmail(input.email);
    let existing;
    try {
      existing = await userRepository.findByNormalisedEmail(normalisedEmail);
    } catch {
      throw safeInfrastructureError();
    }
    if (existing) {
      throw new AuthenticationError("EMAIL_ALREADY_REGISTERED");
    }

    let passwordHash;
    try {
      passwordHash = await passwordAdapter.hashPassword(input.password);
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw safeInfrastructureError();
    }
    let user;
    try {
      user = await userRepository.createUser({
        email: normalisedEmail,
        passwordHash,
        displayName:
          typeof input.displayName === "string"
            ? input.displayName.trim()
            : input.displayName,
      });
    } catch (error) {
      if (
        error?.code === "23505" &&
        error?.constraint === "users_normalised_email_unique"
      ) {
        throw new AuthenticationError("EMAIL_ALREADY_REGISTERED");
      }
      throw safeInfrastructureError();
    }

    // User persistence and token signing are intentionally not transactionally
    // atomic in this step. Future route/application transaction design will
    // define atomic account onboarding.
    return {
      user: safeUser(user),
      accessToken: createTokenSafely(user.id),
    };
  }

  async function loginWithPassword(input = {}) {
    const normalisedEmail = validateEmail(input.email);
    let authenticationRecord;
    try {
      authenticationRecord =
        await userRepository.findAuthenticationRecordByNormalisedEmail(
          normalisedEmail,
        );
    } catch {
      throw safeInfrastructureError();
    }
    let validPassword;
    try {
      validPassword = await passwordAdapter.verifyPassword(
        input.password,
        authenticationRecord?.passwordHash ?? DUMMY_PASSWORD_HASH,
      );
    } catch {
      throw safeInfrastructureError();
    }
    if (!authenticationRecord || !validPassword) {
      throw new AuthenticationError("INVALID_CREDENTIALS");
    }
    if (authenticationRecord.status === "disabled") {
      throw new AuthenticationError("USER_DISABLED");
    }

    return {
      user: safeUser(authenticationRecord),
      accessToken: createTokenSafely(authenticationRecord.id),
    };
  }

  return { loginWithPassword, registerUser };
}

module.exports = {
  createAuthenticationService,
  DUMMY_PASSWORD_HASH,
  safeUser,
  validateEmail,
};
