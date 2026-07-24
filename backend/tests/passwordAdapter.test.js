const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPasswordAdapter,
} = require("../security/passwordAdapter");

const passwords = createPasswordAdapter({
  cost: 4,
  allowWeakCostForTests: true,
});

test("password adapter hashes and verifies valid passwords safely", async () => {
  const plaintext = "correct horse battery staple";
  const passwordHash = await passwords.hashPassword(plaintext);

  assert.notEqual(passwordHash, plaintext);
  assert.equal(passwordHash.includes(plaintext), false);
  assert.equal(await passwords.verifyPassword(plaintext, passwordHash), true);
  assert.equal(
    await passwords.verifyPassword("incorrect password", passwordHash),
    false,
  );
});

test("password adapter rejects short, blank and non-string passwords", async () => {
  for (const password of [
    "short",
    "",
    "         ",
    null,
    undefined,
    1234567890,
  ]) {
    await assert.rejects(
      passwords.hashPassword(password),
      (error) =>
        error?.code === "VALIDATION_ERROR" &&
        error?.message === "The password does not meet the password policy.",
    );
  }
});

test("password policy rejects whitespace padding and bcrypt truncation", async () => {
  for (const password of [
    `a${" ".repeat(9)}`,
    " leading whitespace",
    "trailing whitespace ",
    "a".repeat(73),
    "😀".repeat(19),
  ]) {
    await assert.rejects(
      passwords.hashPassword(password),
      (error) =>
        error?.code === "VALIDATION_ERROR" &&
        !error.message.includes(password),
    );
  }

  const boundaryPassword = "a".repeat(72);
  const boundaryHash = await passwords.hashPassword(boundaryPassword);
  assert.equal(
    await passwords.verifyPassword(boundaryPassword, boundaryHash),
    true,
  );
});

test("password adapter validates costs and verifies hashes from other costs", async () => {
  for (const cost of ["10", 10.5, 9, 15]) {
    assert.throws(
      () => createPasswordAdapter({ cost }),
      /Password hash cost/,
    );
  }
  const normalCost = createPasswordAdapter({ cost: 10 });
  assert.ok(normalCost);

  const costFour = createPasswordAdapter({
    cost: 4,
    allowWeakCostForTests: true,
  });
  const costFive = createPasswordAdapter({
    cost: 5,
    allowWeakCostForTests: true,
  });
  const existingHash = await costFour.hashPassword("existing password");
  assert.equal(
    await costFive.verifyPassword("existing password", existingHash),
    true,
  );
});

test("password verification fails safely for invalid inputs", async () => {
  assert.equal(await passwords.verifyPassword(null, "hash"), false);
  assert.equal(await passwords.verifyPassword("valid password", null), false);
});
