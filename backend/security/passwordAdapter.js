const bcrypt = require("bcryptjs");

const { createAuthenticationConfig } = require("../config/authentication");
const { AuthenticationError } = require("../errors/authenticationError");

const MINIMUM_PASSWORD_LENGTH = 10;
const TEST_MINIMUM_PASSWORD_HASH_COST = 4;
const MAXIMUM_PASSWORD_HASH_COST = 14;

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    !password.trim() ||
    password !== password.trim() ||
    password.length < MINIMUM_PASSWORD_LENGTH ||
    bcrypt.truncates(password)
  ) {
    throw new AuthenticationError(
      "VALIDATION_ERROR",
      "The password does not meet the password policy.",
    );
  }
}

function validateAdapterCost(cost, allowWeakCostForTests) {
  const minimumCost = allowWeakCostForTests
    ? TEST_MINIMUM_PASSWORD_HASH_COST
    : 10;
  if (
    !Number.isInteger(cost) ||
    cost < minimumCost ||
    cost > MAXIMUM_PASSWORD_HASH_COST
  ) {
    throw new Error(
      `Password hash cost must be an integer between ${minimumCost} and ${MAXIMUM_PASSWORD_HASH_COST}.`,
    );
  }
  return cost;
}

function createPasswordAdapter({
  cost,
  allowWeakCostForTests = false,
} = {}) {
  const selectedCost =
    cost ?? createAuthenticationConfig().passwordHashCost;
  validateAdapterCost(selectedCost, allowWeakCostForTests);

  async function hashPassword(password) {
    validatePassword(password);
    return bcrypt.hash(password, selectedCost);
  }

  async function verifyPassword(password, passwordHash) {
    if (
      typeof password !== "string" ||
      !password ||
      typeof passwordHash !== "string" ||
      !passwordHash ||
      bcrypt.truncates(password)
    ) {
      return false;
    }
    return bcrypt.compare(password, passwordHash);
  }

  return { hashPassword, verifyPassword };
}

let defaultAdapter;

function getDefaultAdapter() {
  defaultAdapter ??= createPasswordAdapter();
  return defaultAdapter;
}

async function hashPassword(password) {
  return getDefaultAdapter().hashPassword(password);
}

async function verifyPassword(password, passwordHash) {
  return getDefaultAdapter().verifyPassword(password, passwordHash);
}

module.exports = {
  createPasswordAdapter,
  hashPassword,
  MINIMUM_PASSWORD_LENGTH,
  MAXIMUM_PASSWORD_HASH_COST,
  TEST_MINIMUM_PASSWORD_HASH_COST,
  validatePassword,
  validateAdapterCost,
  verifyPassword,
};
