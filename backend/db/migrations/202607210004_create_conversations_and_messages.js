exports.up = async function up(knex) {
  await knex.schema.createTable("conversations", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("business_id").notNullable();
    table.uuid("customer_id").nullable();
    table.text("channel").notNullable().defaultTo("website");
    table.text("status").notNullable().defaultTo("open");
    table
      .timestamp("started_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp("last_message_at", { useTz: true }).nullable();
    table.timestamp("closed_at", { useTz: true }).nullable();
    table
      .jsonb("metadata")
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

    table
      .foreign("business_id", "conversations_business_id_foreign")
      .references("id")
      .inTable("businesses")
      .onDelete("RESTRICT");
    table.check(
      "channel IN ('website', 'email', 'whatsapp', 'instagram', 'phone', 'manual', 'other')",
      [],
      "conversations_channel_check",
    );
    table.check(
      "status IN ('open', 'closed', 'archived')",
      [],
      "conversations_status_check",
    );
    table.check(
      "last_message_at IS NULL OR last_message_at >= started_at",
      [],
      "conversations_last_message_not_before_start_check",
    );
    table.check(
      "closed_at IS NULL OR closed_at >= started_at",
      [],
      "conversations_closed_not_before_start_check",
    );
    table.unique(
      ["business_id", "id"],
      "conversations_business_id_id_unique",
    );

    table.index(
      ["business_id", "status"],
      "conversations_business_status_index",
    );
    table.index(
      ["business_id", "customer_id"],
      "conversations_business_customer_index",
    );
    table.index(
      ["business_id", "channel"],
      "conversations_business_channel_index",
    );
  });

  await knex.raw(
    'ALTER TABLE "conversations" ADD CONSTRAINT "conversations_business_customer_foreign" FOREIGN KEY ("business_id", "customer_id") REFERENCES "customers" ("business_id", "id") ON DELETE SET NULL ("customer_id")',
  );
  await knex.raw(
    'CREATE INDEX "conversations_business_last_message_desc_index" ON "conversations" ("business_id", "last_message_at" DESC)',
  );

  await knex.schema.alterTable("leads", (table) => {
    table.uuid("conversation_id").nullable();
    table.index(
      ["business_id", "conversation_id"],
      "leads_business_conversation_index",
    );
  });
  await knex.raw(
    'ALTER TABLE "leads" ADD CONSTRAINT "leads_business_conversation_foreign" FOREIGN KEY ("business_id", "conversation_id") REFERENCES "conversations" ("business_id", "id") ON DELETE SET NULL ("conversation_id")',
  );

  await knex.schema.createTable("messages", (table) => {
    table
      .uuid("id")
      .primary()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("business_id").notNullable();
    table.uuid("conversation_id").notNullable();
    table.text("sender_type").notNullable();
    table.text("content").notNullable();
    table
      .jsonb("metadata")
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

    table
      .foreign("business_id", "messages_business_id_foreign")
      .references("id")
      .inTable("businesses")
      .onDelete("RESTRICT");
    table
      .foreign(
        ["business_id", "conversation_id"],
        "messages_business_conversation_foreign",
      )
      .references(["business_id", "id"])
      .inTable("conversations")
      .onDelete("CASCADE");
    table.check(
      "sender_type IN ('customer', 'ai', 'staff', 'system', 'tool')",
      [],
      "messages_sender_type_check",
    );
    table.check(
      "btrim(content) <> ''",
      [],
      "messages_content_not_blank_check",
    );

    table.index(
      ["business_id", "conversation_id", "created_at"],
      "messages_business_conversation_created_index",
    );
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("messages");
  await knex.raw(
    'ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_business_conversation_foreign"',
  );
  await knex.schema.alterTable("leads", (table) => {
    table.dropIndex(
      ["business_id", "conversation_id"],
      "leads_business_conversation_index",
    );
  });
  await knex.schema.alterTable("leads", (table) => {
    table.dropColumn("conversation_id");
  });
  await knex.schema.dropTableIfExists("conversations");
};
