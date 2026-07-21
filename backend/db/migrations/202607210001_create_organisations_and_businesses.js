exports.up = async function up(knex) {
  await knex.schema.createTable("organisations", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.text("name").notNullable();
    table.text("subscription_status").notNullable().defaultTo("trial");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.check(
      "btrim(name) <> ''",
      [],
      "organisations_name_not_blank_check",
    );
    table.check(
      "subscription_status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')",
      [],
      "organisations_subscription_status_check",
    );
  });

  await knex.schema.createTable("businesses", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("organisation_id")
      .notNullable()
      .references("id")
      .inTable("organisations")
      .onDelete("RESTRICT");
    table.text("business_type").notNullable();
    table.text("name").notNullable();
    table.text("description").nullable();
    table.text("phone").nullable();
    table.text("email").nullable();
    table.text("website").nullable();
    table.jsonb("address").nullable();
    table.text("timezone").notNullable();
    table.text("status").notNullable().defaultTo("active");
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.check(
      "btrim(business_type) <> ''",
      [],
      "businesses_business_type_not_blank_check",
    );
    table.check(
      "btrim(name) <> ''",
      [],
      "businesses_name_not_blank_check",
    );
    table.check(
      "btrim(timezone) <> ''",
      [],
      "businesses_timezone_not_blank_check",
    );
    table.check(
      "status IN ('draft', 'active', 'inactive', 'suspended')",
      [],
      "businesses_status_check",
    );

    table.index(
      ["organisation_id"],
      "businesses_organisation_id_index",
    );
    table.index(["business_type"], "businesses_business_type_index");
    table.index(["status"], "businesses_status_index");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("businesses");
  await knex.schema.dropTableIfExists("organisations");
};
