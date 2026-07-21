require("dotenv").config({ quiet: true });

const {
  closeDatabaseConnection,
  getDatabaseConnection,
} = require("../db/connection");
const { getDatabaseEnvironment } = require("../db/config");

const environment = getDatabaseEnvironment(process.argv[2]);

async function checkDatabaseConnection() {
  try {
    const database = getDatabaseConnection(environment);
    await database.raw("SELECT 1 AS connection_check");
    console.log(`Database connection successful (${environment}).`);
  } catch (error) {
    const errorCode = error?.code ? ` Error code: ${error.code}.` : "";
    console.error(`Database connection failed (${environment}).${errorCode}`);
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnection(environment);
  }
}

checkDatabaseConnection();
