const knex = require("knex");
const { createKnexConfig, getDatabaseEnvironment } = require("./config");

const connections = new Map();

function getDatabaseConnection(environment = process.env.NODE_ENV) {
  const selectedEnvironment = getDatabaseEnvironment(environment);

  if (!connections.has(selectedEnvironment)) {
    connections.set(
      selectedEnvironment,
      knex(createKnexConfig(selectedEnvironment)),
    );
  }

  return connections.get(selectedEnvironment);
}

async function closeDatabaseConnection(environment = process.env.NODE_ENV) {
  const selectedEnvironment = getDatabaseEnvironment(environment);
  const connection = connections.get(selectedEnvironment);

  if (!connection) return;

  connections.delete(selectedEnvironment);
  await connection.destroy();
}

async function closeAllDatabaseConnections() {
  const activeConnections = [...connections.values()];
  connections.clear();
  await Promise.all(activeConnections.map((connection) => connection.destroy()));
}

module.exports = {
  closeAllDatabaseConnections,
  closeDatabaseConnection,
  getDatabaseConnection,
};
