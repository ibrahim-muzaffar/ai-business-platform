const path = require("node:path");

const DATABASE_ENVIRONMENT_VARIABLES = {
  development: "DATABASE_URL",
  test: "TEST_DATABASE_URL",
};

function getDatabaseEnvironment(environment = process.env.NODE_ENV) {
  return environment === "test" ? "test" : "development";
}

function createKnexConfig(environment, { requireConnection = true } = {}) {
  const selectedEnvironment = getDatabaseEnvironment(environment);
  const variableName = DATABASE_ENVIRONMENT_VARIABLES[selectedEnvironment];
  const connection = process.env[variableName];

  if (requireConnection && !connection) {
    throw new Error(`${variableName} is required for database operations.`);
  }

  return {
    client: "pg",
    connection,
    migrations: {
      directory: path.join(__dirname, "migrations"),
      extension: "js",
    },
    seeds: {
      directory: path.join(__dirname, "seeds"),
      extension: "js",
    },
  };
}

module.exports = {
  createKnexConfig,
  getDatabaseEnvironment,
};
