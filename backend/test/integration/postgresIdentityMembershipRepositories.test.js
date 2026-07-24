const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

const {
  createOrganisationMembershipRepository,
} = require("../../repositories/postgres/organisationMembershipRepository");
const {
  createUserRepository,
} = require("../../repositories/postgres/userRepository");

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for identity repository integration tests.",
  );
}

const db = knex({
  client: "pg",
  connection: process.env.TEST_DATABASE_URL,
});

test.after(async () => {
  await db.destroy();
});

const IDS = {
  organisationA: "b0000000-0000-0000-0000-000000000001",
  organisationB: "b0000000-0000-0000-0000-000000000002",
  missingOrganisation: "b0000000-0000-0000-0000-000000000099",
};

async function expectDatabaseError(trx, callback, expectedCode) {
  await assert.rejects(
    trx.transaction(async (savepoint) => callback(savepoint)),
    (error) => error?.code === expectedCode,
  );
}

test("PostgreSQL identity repositories map, scope and update records", async () => {
  const rollbackSignal = new Error("rollback identity repository fixtures");
  const createdUserIds = [];
  const createdMembershipIds = [];

  await assert.rejects(
    db.transaction(async (trx) => {
      await trx("organisations").insert([
        { id: IDS.organisationA, name: "Repository Organisation A" },
        { id: IDS.organisationB, name: "Repository Organisation B" },
      ]);

      const users = createUserRepository(trx);
      const memberships = createOrganisationMembershipRepository(trx);

      const owner = await users.createUser({
        email: "  Owner@Example.TEST ",
        passwordHash: "hash-owner-v1",
        displayName: "Owner",
      });
      createdUserIds.push(owner.id);
      assert.equal(owner.email, "Owner@Example.TEST");
      assert.equal(owner.normalisedEmail, "owner@example.test");
      assert.equal(owner.displayName, "Owner");
      assert.equal(owner.status, "active");
      assert.equal(Object.hasOwn(owner, "passwordHash"), false);
      assert.equal(Object.hasOwn(owner, "password_hash"), false);
      assert.ok(owner.createdAt instanceof Date);
      assert.ok(owner.updatedAt instanceof Date);

      assert.deepEqual(await users.findById(owner.id), owner);
      assert.equal(
        (await users.findByNormalisedEmail(" OWNER@example.test ")).id,
        owner.id,
      );
      assert.equal(
        Object.hasOwn(
          await users.findByNormalisedEmail("owner@example.test"),
          "passwordHash",
        ),
        false,
      );
      const authenticationRecord =
        await users.findAuthenticationRecordByNormalisedEmail(
          "OWNER@EXAMPLE.TEST",
        );
      assert.equal(authenticationRecord.id, owner.id);
      assert.equal(authenticationRecord.passwordHash, "hash-owner-v1");
      assert.equal(await users.findById(IDS.missingOrganisation), null);
      assert.equal(
        await users.findByNormalisedEmail("missing@example.test"),
        null,
      );

      await expectDatabaseError(
        trx,
        (savepoint) =>
          createUserRepository(savepoint).createUser({
            email: "owner@EXAMPLE.test",
          }),
        "23505",
      );

      await trx("users")
        .where({ id: owner.id })
        .update({ updated_at: "2000-01-01T00:00:00.000Z" });
      const disabledOwner = await users.updateStatus(owner.id, "disabled");
      assert.equal(disabledOwner.status, "disabled");
      assert.ok(
        disabledOwner.updatedAt.getTime() >
          Date.parse("2000-01-01T00:00:00.000Z"),
      );

      const renamedOwner = await users.updateDisplayName(
        owner.id,
        "Updated Owner",
      );
      assert.equal(renamedOwner.displayName, "Updated Owner");
      assert.equal(Object.hasOwn(renamedOwner, "passwordHash"), false);

      const passwordUpdatedOwner = await users.updatePasswordHash(
        owner.id,
        "hash-owner-v2",
      );
      assert.equal(Object.hasOwn(passwordUpdatedOwner, "passwordHash"), false);
      assert.equal(
        (
          await users.findAuthenticationRecordByNormalisedEmail(
            owner.normalisedEmail,
          )
        ).passwordHash,
        "hash-owner-v2",
      );
      assert.equal(
        await users.updateStatus(IDS.missingOrganisation, "active"),
        null,
      );
      assert.equal(
        await users.updateDisplayName(IDS.missingOrganisation, "Missing"),
        null,
      );
      assert.equal(
        await users.updatePasswordHash(
          IDS.missingOrganisation,
          "missing-hash",
        ),
        null,
      );

      const staff = await users.createUser({
        email: "staff@example.test",
      });
      const invited = await users.createUser({
        email: "invited@example.test",
      });
      createdUserIds.push(staff.id, invited.id);

      const ownerMembership = await memberships.createMembership({
        organisationId: IDS.organisationA,
        userId: owner.id,
        role: "owner",
        status: "active",
      });
      const staffMembershipA = await memberships.createMembership({
        organisationId: IDS.organisationA,
        userId: staff.id,
        role: "staff",
        status: "active",
      });
      const staffMembershipB = await memberships.createMembership({
        organisationId: IDS.organisationB,
        userId: staff.id,
        role: "viewer",
        status: "invited",
      });
      const invitedMembership = await memberships.createMembership({
        organisationId: IDS.organisationA,
        userId: invited.id,
        role: "viewer",
        status: "suspended",
      });
      createdMembershipIds.push(
        ownerMembership.id,
        staffMembershipA.id,
        staffMembershipB.id,
        invitedMembership.id,
      );
      await trx("organisation_memberships")
        .where({ id: ownerMembership.id })
        .update({ created_at: "2000-01-01T00:00:00.000Z" });
      await trx("organisation_memberships")
        .where({ id: staffMembershipA.id })
        .update({ created_at: "2000-01-01T00:01:00.000Z" });
      await trx("organisation_memberships")
        .where({ id: staffMembershipB.id })
        .update({ created_at: "2000-01-01T00:02:00.000Z" });
      await trx("organisation_memberships")
        .where({ id: invitedMembership.id })
        .update({ created_at: "2000-01-01T00:03:00.000Z" });

      assert.equal(ownerMembership.organisationId, IDS.organisationA);
      assert.equal(ownerMembership.userId, owner.id);
      assert.equal(ownerMembership.role, "owner");
      assert.equal(ownerMembership.status, "active");
      assert.ok(ownerMembership.createdAt instanceof Date);
      assert.ok(ownerMembership.updatedAt instanceof Date);
      assert.equal(
        (
          await memberships.findById(
            IDS.organisationA,
            ownerMembership.id,
          )
        ).id,
        ownerMembership.id,
      );
      assert.equal(
        await memberships.findById(
          IDS.organisationB,
          ownerMembership.id,
        ),
        null,
      );
      assert.equal(
        (
          await memberships.findByOrganisationAndUser(
            IDS.organisationA,
            staff.id,
          )
        ).id,
        staffMembershipA.id,
      );
      assert.equal(
        await memberships.findByOrganisationAndUser(
          IDS.missingOrganisation,
          staff.id,
        ),
        null,
      );
      assert.equal(
        (
          await memberships.findActiveByOrganisationAndUser(
            IDS.organisationA,
            staff.id,
          )
        ).id,
        staffMembershipA.id,
      );
      assert.equal(
        await memberships.findActiveByOrganisationAndUser(
          IDS.organisationB,
          staff.id,
        ),
        null,
      );
      assert.equal(
        await memberships.findActiveByOrganisationAndUser(
          IDS.organisationA,
          invited.id,
        ),
        null,
      );

      assert.deepEqual(
        (await memberships.listByUserId(staff.id)).map(
          ({ organisationId }) => organisationId,
        ),
        [IDS.organisationA, IDS.organisationB],
      );
      assert.deepEqual(
        (await memberships.listActiveByUserId(staff.id)).map(
          ({ organisationId }) => organisationId,
        ),
        [IDS.organisationA],
      );
      assert.deepEqual(
        (await memberships.listByOrganisationId(IDS.organisationA)).map(
          ({ id }) => id,
        ),
        [
          ownerMembership.id,
          staffMembershipA.id,
          invitedMembership.id,
        ],
      );

      await trx("organisation_memberships")
        .where({ id: staffMembershipA.id })
        .update({ updated_at: "2000-01-01T00:00:00.000Z" });
      const promoted = await memberships.updateRole(
        IDS.organisationA,
        staffMembershipA.id,
        "admin",
      );
      assert.equal(promoted.role, "admin");
      assert.ok(
        promoted.updatedAt.getTime() >
          Date.parse("2000-01-01T00:00:00.000Z"),
      );
      assert.equal(
        await memberships.updateRole(
          IDS.organisationB,
          staffMembershipA.id,
          "viewer",
        ),
        null,
      );

      const suspended = await memberships.updateStatus(
        IDS.organisationA,
        staffMembershipA.id,
        "suspended",
      );
      assert.equal(suspended.status, "suspended");
      assert.equal(
        await memberships.findActiveByOrganisationAndUser(
          IDS.organisationA,
          staff.id,
        ),
        null,
      );
      assert.equal(
        await memberships.updateStatus(
          IDS.organisationB,
          staffMembershipA.id,
          "active",
        ),
        null,
      );

      await expectDatabaseError(
        trx,
        (savepoint) =>
          createOrganisationMembershipRepository(
            savepoint,
          ).createMembership({
            organisationId: IDS.organisationA,
            userId: owner.id,
            role: "admin",
            status: "active",
          }),
        "23505",
      );

      let rolledBackUserId;
      await assert.rejects(
        trx.transaction(async (savepoint) => {
          const savepointUsers = createUserRepository(savepoint);
          const savepointMemberships =
            createOrganisationMembershipRepository(savepoint);
          const transientUser = await savepointUsers.createUser({
            email: "transaction-bound@example.test",
          });
          rolledBackUserId = transientUser.id;
          const transientMembership =
            await savepointMemberships.createMembership({
              organisationId: IDS.organisationB,
              userId: transientUser.id,
              role: "viewer",
              status: "active",
            });
          createdMembershipIds.push(transientMembership.id);
          throw rollbackSignal;
        }),
        (error) => error === rollbackSignal,
      );
      assert.equal(await users.findById(rolledBackUserId), null);
      assert.deepEqual(
        await memberships.listByUserId(rolledBackUserId),
        [],
      );

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  for (const [tableName, ids] of [
    ["users", createdUserIds],
    ["organisation_memberships", createdMembershipIds],
    ["organisations", [IDS.organisationA, IDS.organisationB]],
  ]) {
    const [{ count }] = await db(tableName)
      .whereIn("id", ids)
      .count("* as count");
    assert.equal(Number(count), 0);
  }
});
