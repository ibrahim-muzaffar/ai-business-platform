const { createAuthenticationConfig } = require("../config/authentication");
const { getDatabaseConnection } = require("../db/connection");
const {
  createAuthenticationMiddleware,
} = require("../middleware/authenticationMiddleware");
const { createUserRepository } = require("../repositories/postgres/userRepository");
const { createPasswordAdapter } = require("../security/passwordAdapter");
const { createTokenAdapter } = require("../security/tokenAdapter");
const {
  createAuthenticationService,
} = require("../services/authenticationService");

function createAuthenticationRuntime({
  db,
  env = process.env,
  getConnection = getDatabaseConnection,
} = {}) {
  const config = createAuthenticationConfig(env);
  const database = db ?? getConnection("development");
  const userRepository = createUserRepository(database);
  const passwordAdapter = createPasswordAdapter({
    cost: config.passwordHashCost,
  });
  const tokenAdapter = createTokenAdapter(config);

  return Object.freeze({
    authenticationMiddleware: createAuthenticationMiddleware({
      tokenAdapter,
      userRepository,
    }),
    authenticationService: createAuthenticationService({
      passwordAdapter,
      tokenAdapter,
      userRepository,
    }),
    jwtExpirySeconds: config.jwtExpirySeconds,
  });
}

let defaultRuntime;

function getAuthenticationRuntime() {
  defaultRuntime ??= createAuthenticationRuntime();
  return defaultRuntime;
}

module.exports = {
  createAuthenticationRuntime,
  getAuthenticationRuntime,
};
