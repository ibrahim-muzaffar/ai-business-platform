const {
  mapAuthenticationRecord,
  mapUser,
} = require("./mappers");

function normaliseEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : email;
}

function createUserRepository(db) {
  async function createUser(input) {
    const values = {
      email: typeof input.email === "string" ? input.email.trim() : input.email,
      normalised_email: normaliseEmail(input.email),
    };

    if (input.passwordHash !== undefined) {
      values.password_hash = input.passwordHash;
    }
    if (input.displayName !== undefined) {
      values.display_name = input.displayName;
    }
    if (input.status !== undefined) values.status = input.status;

    const [row] = await db("users").insert(values).returning("*");
    return mapUser(row);
  }

  async function findById(userId) {
    const row = await db("users").where({ id: userId }).first();
    return mapUser(row);
  }

  async function findByNormalisedEmail(email) {
    const row = await db("users")
      .where({ normalised_email: normaliseEmail(email) })
      .first();
    return mapUser(row);
  }

  async function findAuthenticationRecordByNormalisedEmail(email) {
    const row = await db("users")
      .where({ normalised_email: normaliseEmail(email) })
      .first();
    return mapAuthenticationRecord(row);
  }

  async function updateStatus(userId, status) {
    const [row] = await db("users")
      .where({ id: userId })
      .update({ status, updated_at: db.fn.now() })
      .returning("*");
    return mapUser(row);
  }

  async function updatePasswordHash(userId, passwordHash) {
    const [row] = await db("users")
      .where({ id: userId })
      .update({
        password_hash: passwordHash,
        updated_at: db.fn.now(),
      })
      .returning("*");
    return mapUser(row);
  }

  async function updateDisplayName(userId, displayName) {
    const [row] = await db("users")
      .where({ id: userId })
      .update({
        display_name: displayName,
        updated_at: db.fn.now(),
      })
      .returning("*");
    return mapUser(row);
  }

  return {
    createUser,
    findAuthenticationRecordByNormalisedEmail,
    findById,
    findByNormalisedEmail,
    updateDisplayName,
    updatePasswordHash,
    updateStatus,
  };
}

module.exports = {
  createUserRepository,
  normaliseEmail,
};
