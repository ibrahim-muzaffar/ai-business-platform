const assert = require("node:assert/strict");
const test = require("node:test");
const knex = require("knex");

require("dotenv").config({ quiet: true });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required for identity and membership integration tests.",
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
  organisation: "a0000000-0000-0000-0000-000000000001",
  cascadeOrganisation: "a0000000-0000-0000-0000-000000000002",
  user: "a0000000-0000-0000-0000-000000000011",
  cascadeUser: "a0000000-0000-0000-0000-000000000012",
  organisationCascadeUser: "a0000000-0000-0000-0000-000000000013",
  membership: "a0000000-0000-0000-0000-000000000021",
  userCascadeMembership: "a0000000-0000-0000-0000-000000000022",
  organisationCascadeMembership: "a0000000-0000-0000-0000-000000000023",
  missingOrganisation: "a0000000-0000-0000-0000-000000000099",
  missingUser: "a0000000-0000-0000-0000-000000000098",
};

async function expectInsertError(trx, tableName, values, expectedCode) {
  await assert.rejects(
    trx.transaction(async (savepoint) => {
      await savepoint(tableName).insert(values);
    }),
    (error) => error?.code === expectedCode,
  );
}

test("users and organisation memberships enforce identity foundations", async () => {
  const rollbackSignal = new Error("rollback identity fixtures");

  await assert.rejects(
    db.transaction(async (trx) => {
      await trx("organisations").insert([
        { id: IDS.organisation, name: "Identity Organisation" },
        {
          id: IDS.cascadeOrganisation,
          name: "Organisation Cascade Fixture",
        },
      ]);

      const [user] = await trx("users")
        .insert({
          id: IDS.user,
          email: "Owner@Example.test",
          normalised_email: "owner@example.test",
          display_name: "Test Owner",
        })
        .returning("*");
      assert.equal(user.id, IDS.user);
      assert.equal(user.email, "Owner@Example.test");
      assert.equal(user.normalised_email, "owner@example.test");
      assert.equal(user.password_hash, null);
      assert.equal(user.status, "active");
      assert.ok(user.created_at instanceof Date);
      assert.ok(user.updated_at instanceof Date);

      await expectInsertError(
        trx,
        "users",
        {
          email: "OWNER@example.test",
          normalised_email: "owner@example.test",
        },
        "23505",
      );

      const [membership] = await trx("organisation_memberships")
        .insert({
          id: IDS.membership,
          organisation_id: IDS.organisation,
          user_id: IDS.user,
          role: "owner",
          status: "active",
        })
        .returning("*");
      assert.equal(membership.organisation_id, IDS.organisation);
      assert.equal(membership.user_id, IDS.user);
      assert.equal(membership.role, "owner");
      assert.equal(membership.status, "active");

      await expectInsertError(
        trx,
        "organisation_memberships",
        {
          organisation_id: IDS.organisation,
          user_id: IDS.user,
          role: "admin",
          status: "active",
        },
        "23505",
      );
      await expectInsertError(
        trx,
        "organisation_memberships",
        {
          organisation_id: IDS.cascadeOrganisation,
          user_id: IDS.user,
          role: "super_admin",
          status: "active",
        },
        "23514",
      );
      await expectInsertError(
        trx,
        "organisation_memberships",
        {
          organisation_id: IDS.cascadeOrganisation,
          user_id: IDS.user,
          role: "viewer",
          status: "pending",
        },
        "23514",
      );
      await expectInsertError(
        trx,
        "organisation_memberships",
        {
          organisation_id: IDS.missingOrganisation,
          user_id: IDS.user,
          role: "viewer",
          status: "active",
        },
        "23503",
      );
      await expectInsertError(
        trx,
        "organisation_memberships",
        {
          organisation_id: IDS.organisation,
          user_id: IDS.missingUser,
          role: "viewer",
          status: "active",
        },
        "23503",
      );

      await trx("users").insert([
        {
          id: IDS.cascadeUser,
          email: "cascade-user@example.test",
          normalised_email: "cascade-user@example.test",
        },
        {
          id: IDS.organisationCascadeUser,
          email: "cascade-org@example.test",
          normalised_email: "cascade-org@example.test",
        },
      ]);
      await trx("organisation_memberships").insert([
        {
          id: IDS.userCascadeMembership,
          organisation_id: IDS.organisation,
          user_id: IDS.cascadeUser,
          role: "staff",
          status: "active",
        },
        {
          id: IDS.organisationCascadeMembership,
          organisation_id: IDS.cascadeOrganisation,
          user_id: IDS.organisationCascadeUser,
          role: "viewer",
          status: "invited",
        },
      ]);

      await trx("users").where({ id: IDS.cascadeUser }).delete();
      assert.equal(
        await trx("organisation_memberships")
          .where({ id: IDS.userCascadeMembership })
          .first(),
        undefined,
      );
      assert.ok(
        await trx("organisations")
          .where({ id: IDS.organisation })
          .first(),
      );

      await trx("organisations")
        .where({ id: IDS.cascadeOrganisation })
        .delete();
      assert.equal(
        await trx("organisation_memberships")
          .where({ id: IDS.organisationCascadeMembership })
          .first(),
        undefined,
      );
      assert.ok(
        await trx("users")
          .where({ id: IDS.organisationCascadeUser })
          .first(),
      );

      throw rollbackSignal;
    }),
    (error) => error === rollbackSignal,
  );

  for (const tableName of ["users", "organisation_memberships"]) {
    const [{ count }] = await db(tableName)
      .whereIn("id", Object.values(IDS))
      .count("* as count");
    assert.equal(Number(count), 0);
  }
  const [{ count: organisationCount }] = await db("organisations")
    .whereIn("id", [IDS.organisation, IDS.cascadeOrganisation])
    .count("* as count");
  assert.equal(Number(organisationCount), 0);
});
