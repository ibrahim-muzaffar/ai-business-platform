const AUTHENTICATION_ERROR_MESSAGES = Object.freeze({
  AUTHENTICATION_REQUIRED: "Authentication is required.",
  AUTHENTICATION_UNAVAILABLE: "Authentication could not be completed.",
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  INVALID_TOKEN: "The access token is invalid.",
  TOKEN_EXPIRED: "The access token has expired.",
  USER_DISABLED: "This user account is disabled.",
  VALIDATION_ERROR: "The supplied authentication details are invalid.",
});

class AuthenticationError extends Error {
  constructor(code, message = AUTHENTICATION_ERROR_MESSAGES[code]) {
    super(message ?? AUTHENTICATION_ERROR_MESSAGES.VALIDATION_ERROR);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

module.exports = {
  AuthenticationError,
  AUTHENTICATION_ERROR_MESSAGES,
};
