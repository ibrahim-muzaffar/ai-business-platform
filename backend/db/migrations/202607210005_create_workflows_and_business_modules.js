exports.up = async function up(knex) {
  await knex.schema.createTable("workflows", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("business_id").nullable();
    table.text("business_type").nullable();
    table.text("name").notNullable();
    table.text("intent").notNullable();
    table
      .jsonb("required_fields")
      .notNullable()
      .defaultTo(knex.raw("'[]'::jsonb"));
    table
      .jsonb("rules")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table.boolean("enabled").notNullable().defaultTo(true);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .foreign("business_id", "workflows_business_id_foreign")
      .references("id")
      .inTable("businesses")
      .onDelete("RESTRICT");
    table.check(
      "(business_id IS NOT NULL) <> (business_type IS NOT NULL)",
      [],
      "workflows_exactly_one_scope_check",
    );
    table.check(
      "business_type IS NULL OR btrim(business_type) <> ''",
      [],
      "workflows_business_type_not_blank_check",
    );
    table.check(
      "btrim(name) <> ''",
      [],
      "workflows_name_not_blank_check",
    );
    table.check(
      "btrim(intent) <> ''",
      [],
      "workflows_intent_not_blank_check",
    );
    table.check(
      "jsonb_typeof(required_fields) = 'array'",
      [],
      "workflows_required_fields_array_check",
    );
    table.check(
      "jsonb_typeof(rules) = 'object'",
      [],
      "workflows_rules_object_check",
    );
  });

  await knex.raw(
    'CREATE UNIQUE INDEX "workflows_business_intent_name_unique" ON "workflows" ("business_id", "intent", "name") WHERE "business_id" IS NOT NULL',
  );
  await knex.raw(
    'CREATE UNIQUE INDEX "workflows_business_type_intent_name_unique" ON "workflows" ("business_type", "intent", "name") WHERE "business_type" IS NOT NULL',
  );

  await knex.schema.createTable("business_modules", (table) => {
    table.uuid("business_id").notNullable();
    table.text("module_key").notNullable();
    table.boolean("enabled").notNullable().defaultTo(false);
    table
      .jsonb("configuration")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.primary(
      ["business_id", "module_key"],
      "business_modules_pkey",
    );
    table
      .foreign("business_id", "business_modules_business_id_foreign")
      .references("id")
      .inTable("businesses")
      .onDelete("RESTRICT");
    table.check(
      "btrim(module_key) <> ''",
      [],
      "business_modules_module_key_not_blank_check",
    );
    table.check(
      "jsonb_typeof(configuration) = 'object'",
      [],
      "business_modules_configuration_object_check",
    );
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("business_modules");
  await knex.schema.dropTableIfExists("workflows");
};
