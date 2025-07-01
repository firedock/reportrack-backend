'use strict';

/**
 * Add upload metadata columns to files table
 */
async function up(knex) {
  // Check if columns exist before adding them
  const hasUploadTime = await knex.schema.hasColumn('files', 'upload_time');
  const hasLatitude = await knex.schema.hasColumn('files', 'gps_latitude');
  const hasLongitude = await knex.schema.hasColumn('files', 'gps_longitude');

  if (!hasUploadTime || !hasLatitude || !hasLongitude) {
    await knex.schema.alterTable('files', (table) => {
      if (!hasUploadTime) {
        table.timestamp('upload_time').nullable();
      }
      if (!hasLatitude) {
        table.decimal('gps_latitude', 10, 8).nullable();
      }
      if (!hasLongitude) {
        table.decimal('gps_longitude', 11, 8).nullable();
      }
    });
  }
}

async function down(knex) {
  await knex.schema.alterTable('files', (table) => {
    table.dropColumn('upload_time');
    table.dropColumn('gps_latitude');
    table.dropColumn('gps_longitude');
  });
}

module.exports = { up, down };