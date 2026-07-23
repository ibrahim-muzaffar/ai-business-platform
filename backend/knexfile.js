require("dotenv").config({ quiet: true });

const { createKnexConfig } = require("./db/config");

// Connection presence is validated when Knex performs the selected command.
// Keeping both environments here allows `--env development` and `--env test`.
module.exports = {
  development: createKnexConfig("development", { requireConnection: false }),
  test: createKnexConfig("test", { requireConnection: false }),
};
