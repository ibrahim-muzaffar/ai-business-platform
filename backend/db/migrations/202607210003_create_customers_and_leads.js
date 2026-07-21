exports.up = async function up(knex) {
  await knex.schema.createTable("customers", (table) => {
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
    table.text("phone").nullable();
    table.text("email").nullable();
    table
      .jsonb("preferences")
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

    table.check(
      "btrim(name) <> ''",
      [],
      "customers_name_not_blank_check",
    );
    table.check(
      "phone IS NULL OR btrim(phone) <> ''",
      [],
      "customers_phone_not_blank_check",
    );
    table.check(
      "email IS NULL OR btrim(email) <> ''",
      [],
      "customers_email_not_blank_check",
    );

    table.index(
      ["business_id", "phone"],
      "customers_business_phone_index",
    );
    table.index(
      ["business_id", "email"],
      "customers_business_email_index",
    );
    table.unique(
      ["business_id", "id"],
      "customers_business_id_id_unique",
    );
  });

  await knex.schema.alterTable("services", (table) => {
    table.unique(
      ["business_id", "id"],
      "services_business_id_id_unique",
    );
  });

  await knex.schema.createTable("leads", (table) => {
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
    table.uuid("customer_id").nullable();
    table.uuid("service_id").nullable();
    table.text("source_channel").notNullable().defaultTo("website");
    table.text("enquiry_type").notNullable().defaultTo("general");
    table.text("status").notNullable().defaultTo("new");
    table.text("requested_service").nullable();
    table.date("requested_date").nullable();
    table.time("requested_time").nullable();
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.check(
      "source_channel IN ('website', 'email', 'whatsapp', 'instagram', 'phone', 'manual', 'other')",
      [],
      "leads_source_channel_check",
    );
    table.check(
      "btrim(enquiry_type) <> ''",
      [],
      "leads_enquiry_type_not_blank_check",
    );
    table.check(
      "status IN ('new', 'contacted', 'qualified', 'converted', 'lost')",
      [],
      "leads_status_check",
    );
    table.check(
      "requested_service IS NULL OR btrim(requested_service) <> ''",
      [],
      "leads_requested_service_not_blank_check",
    );

    table.index(["business_id", "status"], "leads_business_status_index");
    table.index(
      ["business_id", "customer_id"],
      "leads_business_customer_index",
    );
    table.index(
      ["business_id", "service_id"],
      "leads_business_service_index",
    );
    table.index(
      ["business_id", "source_channel"],
      "leads_business_source_channel_index",
    );
  });

  await knex.raw(
    'CREATE INDEX "leads_business_created_at_desc_index" ON "leads" ("business_id", "created_at" DESC)',
  );
  await knex.raw(
    'ALTER TABLE "leads" ADD CONSTRAINT "leads_business_customer_foreign" FOREIGN KEY ("business_id", "customer_id") REFERENCES "customers" ("business_id", "id") ON DELETE SET NULL ("customer_id")',
  );
  await knex.raw(
    'ALTER TABLE "leads" ADD CONSTRAINT "leads_business_service_foreign" FOREIGN KEY ("business_id", "service_id") REFERENCES "services" ("business_id", "id") ON DELETE SET NULL ("service_id")',
  );
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("leads");
  await knex.schema.dropTableIfExists("customers");
  await knex.schema.alterTable("services", (table) => {
    table.dropUnique(
      ["business_id", "id"],
      "services_business_id_id_unique",
    );
  });
};
