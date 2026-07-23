exports.up = async function up(knex) {
  await knex.schema.alterTable("leads", (table) => {
    table.text("requested_date_text").nullable();
    table.text("requested_time_text").nullable();
  });

  await knex.raw(
    'ALTER TABLE "leads" ADD CONSTRAINT "leads_requested_date_text_not_blank_check" CHECK ("requested_date_text" IS NULL OR btrim("requested_date_text") <> \'\')',
  );
  await knex.raw(
    'ALTER TABLE "leads" ADD CONSTRAINT "leads_requested_time_text_not_blank_check" CHECK ("requested_time_text" IS NULL OR btrim("requested_time_text") <> \'\')',
  );
};

exports.down = async function down(knex) {
  await knex.raw(
    'ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_requested_date_text_not_blank_check"',
  );
  await knex.raw(
    'ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_requested_time_text_not_blank_check"',
  );

  await knex.schema.alterTable("leads", (table) => {
    table.dropColumn("requested_date_text");
    table.dropColumn("requested_time_text");
  });
};
