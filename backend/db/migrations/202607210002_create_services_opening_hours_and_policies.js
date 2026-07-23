exports.up = async function up(knex) {
  await knex.schema.createTable("services", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("business_id")
      .notNullable()
      .references("id")
      .inTable("businesses")
      .onDelete("RESTRICT");
    table.text("name").notNullable();
    table.text("description").nullable();
    table.decimal("price", 12, 2).nullable();
    table.integer("duration_minutes").nullable();
    table.boolean("active").notNullable().defaultTo(true);
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
      "services_name_not_blank_check",
    );
    table.check(
      "price IS NULL OR price >= 0",
      [],
      "services_price_non_negative_check",
    );
    table.check(
      "duration_minutes IS NULL OR duration_minutes > 0",
      [],
      "services_duration_positive_check",
    );

    table.index(["business_id"], "services_business_id_index");
    table.index(["active"], "services_active_index");
  });

  await knex.schema.createTable("opening_hours", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("business_id")
      .notNullable()
      .references("id")
      .inTable("businesses")
      .onDelete("RESTRICT");
    table.text("day_of_week").notNullable();
    table.time("opening_time").nullable();
    table.time("closing_time").nullable();
    table.boolean("closed").notNullable().defaultTo(false);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.check(
      "day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')",
      [],
      "opening_hours_day_of_week_check",
    );
    table.check(
      "(closed AND opening_time IS NULL AND closing_time IS NULL) OR (NOT closed AND opening_time IS NOT NULL AND closing_time IS NOT NULL AND opening_time <> closing_time)",
      [],
      "opening_hours_time_consistency_check",
    );

    table.unique(
      ["business_id", "day_of_week"],
      "opening_hours_business_day_unique",
    );
  });

  await knex.schema.createTable("policies", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("business_id")
      .notNullable()
      .references("id")
      .inTable("businesses")
      .onDelete("RESTRICT");
    table.text("category").notNullable();
    table.text("title").notNullable();
    table.text("content").notNullable();
    table.boolean("active").notNullable().defaultTo(true);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.check(
      "btrim(category) <> ''",
      [],
      "policies_category_not_blank_check",
    );
    table.check(
      "btrim(title) <> ''",
      [],
      "policies_title_not_blank_check",
    );
    table.check(
      "btrim(content) <> ''",
      [],
      "policies_content_not_blank_check",
    );

    table.index(["business_id"], "policies_business_id_index");
    table.index(["category"], "policies_category_index");
    table.index(["active"], "policies_active_index");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("policies");
  await knex.schema.dropTableIfExists("opening_hours");
  await knex.schema.dropTableIfExists("services");
};
