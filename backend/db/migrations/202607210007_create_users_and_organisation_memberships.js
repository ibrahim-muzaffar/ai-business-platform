exports.up = async function up(knex) {
  await knex.schema.createTable("users", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("email").notNullable();
    table.text("normalised_email").notNullable();
    table.text("password_hash").nullable();
    table.text("display_name").nullable();
    table.text("status").notNullable().defaultTo("active");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(["normalised_email"], "users_normalised_email_unique");
    table.check("btrim(email) <> ''", [], "users_email_not_blank_check");
    table.check(
      "btrim(normalised_email) <> ''",
      [],
      "users_normalised_email_not_blank_check",
    );
    table.check(
      "password_hash IS NULL OR btrim(password_hash) <> ''",
      [],
      "users_password_hash_not_blank_check",
    );
    table.check(
      "display_name IS NULL OR btrim(display_name) <> ''",
      [],
      "users_display_name_not_blank_check",
    );
    table.check(
      "status IN ('active', 'disabled')",
      [],
      "users_status_check",
    );
  });

  await knex.schema.createTable("organisation_memberships", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("organisation_id")
      .notNullable()
      .references("id")
      .inTable("organisations")
      .onDelete("CASCADE");
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.text("role").notNullable();
    table.text("status").notNullable();
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(
      ["organisation_id", "user_id"],
      "organisation_memberships_organisation_user_unique",
    );
    table.check(
      "role IN ('owner', 'admin', 'staff', 'viewer')",
      [],
      "organisation_memberships_role_check",
    );
    table.check(
      "status IN ('active', 'invited', 'suspended')",
      [],
      "organisation_memberships_status_check",
    );
    table.index(
      ["user_id"],
      "organisation_memberships_user_id_index",
    );
    table.index(
      ["organisation_id"],
      "organisation_memberships_organisation_id_index",
    );
    table.index(
      ["user_id", "status"],
      "organisation_memberships_user_status_index",
    );
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("organisation_memberships");
  await knex.schema.dropTableIfExists("users");
};
