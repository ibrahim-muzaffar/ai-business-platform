const express = require("express");

const {
  AuthenticationError,
  AUTHENTICATION_ERROR_MESSAGES,
} = require("../errors/authenticationError");
const {
  getAuthenticationRuntime,
} = require("../runtime/authentication");

const AUTH_JSON_LIMIT = "16kb";
const AUTHENTICATION_HTTP_STATUS = Object.freeze({
  AUTHENTICATION_REQUIRED: 401,
  VALIDATION_ERROR: 400,
  EMAIL_ALREADY_REGISTERED: 409,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  ORGANISATION_ACCESS_DENIED: 403,
  ORGANISATION_REQUIRED: 400,
  TOKEN_EXPIRED: 401,
  TENANT_CONTEXT_UNAVAILABLE: 503,
  USER_DISABLED: 403,
  AUTHENTICATION_UNAVAILABLE: 503,
});
const INTERNAL_ERROR = Object.freeze({
  code: "INTERNAL_ERROR",
  message: "Authentication could not be completed.",
});
const UNSUPPORTED_MEDIA_TYPE = Object.freeze({
  code: "UNSUPPORTED_MEDIA_TYPE",
  message: "Content-Type must be application/json.",
});

function sendError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function publicUser(user) {
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

function isObjectBody(body) {
  return (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body)
  );
}

function validateDisplayName(body) {
  if (!Object.hasOwn(body, "displayName") || body.displayName === null) {
    return body.displayName;
  }
  if (
    typeof body.displayName !== "string" ||
    !body.displayName.trim()
  ) {
    throw new AuthenticationError("VALIDATION_ERROR");
  }
  return body.displayName.trim();
}

function registrationInput(body) {
  if (
    !isObjectBody(body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    throw new AuthenticationError("VALIDATION_ERROR");
  }
  return {
    email: body.email,
    password: body.password,
    displayName: validateDisplayName(body),
  };
}

function loginInput(body) {
  if (
    !isObjectBody(body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    throw new AuthenticationError("VALIDATION_ERROR");
  }
  return { email: body.email, password: body.password };
}

function createAuthRouter({
  getRuntime = getAuthenticationRuntime,
  logger = console,
} = {}) {
  if (typeof getRuntime !== "function") {
    throw new Error("Authentication runtime getter is required.");
  }

  const router = express.Router();
  const requireJson = (request, response, next) => {
    if (!request.is("application/json")) {
      sendError(
        response,
        415,
        UNSUPPORTED_MEDIA_TYPE.code,
        UNSUPPORTED_MEDIA_TYPE.message,
      );
      return;
    }
    next();
  };
  const parseJson = express.json({
    limit: AUTH_JSON_LIMIT,
    strict: true,
  });

  router.post(
    "/register",
    requireJson,
    parseJson,
    async (request, response, next) => {
      try {
        const input = registrationInput(request.body);
        const { authenticationService, jwtExpirySeconds } =
          getRuntime();
        const result = await authenticationService.registerUser(input);
        response.status(201).json({
          user: publicUser(result.user),
          accessToken: result.accessToken,
          tokenType: "Bearer",
          expiresIn: jwtExpirySeconds,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/login",
    requireJson,
    parseJson,
    async (request, response, next) => {
      try {
        const input = loginInput(request.body);
        const { authenticationService, jwtExpirySeconds } =
          getRuntime();
        const result =
          await authenticationService.loginWithPassword(input);
        response.status(200).json({
          user: publicUser(result.user),
          accessToken: result.accessToken,
          tokenType: "Bearer",
          expiresIn: jwtExpirySeconds,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/me",
    (request, response, next) => {
      try {
        const { authenticationMiddleware } = getRuntime();
        return authenticationMiddleware(request, response, next);
      } catch (error) {
        next(error);
      }
    },
    (request, response) => {
      response.status(200).json({ user: request.auth.user });
    },
  );

  router.get(
    "/context",
    (request, response, next) => {
      try {
        const { authenticationMiddleware } = getRuntime();
        return authenticationMiddleware(request, response, next);
      } catch (error) {
        next(error);
      }
    },
    (request, response, next) => {
      try {
        const { organisationContextMiddleware } = getRuntime();
        return organisationContextMiddleware(
          request,
          response,
          next,
        );
      } catch (error) {
        next(error);
      }
    },
    (request, response) => {
      response.status(200).json({
        user: {
          id: request.auth.user.id,
          email: request.auth.user.email,
          displayName: request.auth.user.displayName,
          status: request.auth.user.status,
        },
        organisation: {
          id: request.tenant.organisation.id,
          name: request.tenant.organisation.name,
        },
        membership: {
          id: request.tenant.membership.id,
          role: request.tenant.membership.role,
          status: request.tenant.membership.status,
        },
      });
    },
  );

  router.use((error, request, response, _next) => {
    let status;
    let code;
    let message;

    if (error?.type === "entity.too.large") {
      status = 413;
      code = "VALIDATION_ERROR";
      message = AUTHENTICATION_ERROR_MESSAGES.VALIDATION_ERROR;
    } else if (
      error instanceof SyntaxError &&
      error?.status === 400 &&
      Object.hasOwn(error, "body")
    ) {
      status = 400;
      code = "VALIDATION_ERROR";
      message = AUTHENTICATION_ERROR_MESSAGES.VALIDATION_ERROR;
    } else if (
      error instanceof AuthenticationError &&
      AUTHENTICATION_HTTP_STATUS[error.code]
    ) {
      status = AUTHENTICATION_HTTP_STATUS[error.code];
      code = error.code;
      message = AUTHENTICATION_ERROR_MESSAGES[error.code];
    } else {
      status = 500;
      code = INTERNAL_ERROR.code;
      message = INTERNAL_ERROR.message;
    }

    if (status >= 500) {
      logger.error("Authentication request failed", {
        route: request.originalUrl,
        code,
        status,
      });
    }
    sendError(response, status, code, message);
  });

  return router;
}

const router = createAuthRouter();

module.exports = router;
module.exports.AUTHENTICATION_HTTP_STATUS = AUTHENTICATION_HTTP_STATUS;
module.exports.AUTH_JSON_LIMIT = AUTH_JSON_LIMIT;
module.exports.createAuthRouter = createAuthRouter;
module.exports.loginInput = loginInput;
module.exports.publicUser = publicUser;
module.exports.registrationInput = registrationInput;
