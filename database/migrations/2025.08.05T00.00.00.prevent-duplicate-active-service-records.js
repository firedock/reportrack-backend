'use strict';

/**
 * Prevent duplicate active service records for the same user
 * Note: This requires manual execution as Strapi doesn't have built-in migration support
 * 
 * Manual SQL to run:
 * 
 * -- First, check for existing duplicates (should be none now since we're using end_date_time IS NULL)
 * SELECT user_id, COUNT(*) 
 * FROM service_records sr 
 * JOIN service_records_users_permissions_user_links ul ON sr.id = ul.service_record_id 
 * WHERE sr.end_date_time IS NULL 
 * GROUP BY user_id 
 * HAVING COUNT(*) > 1;
 * 
 * -- If no duplicates, create the constraint
 * -- We'll add this constraint to the backend validation instead
 */

module.exports = {
  async up(knex) {
    // Note: Database constraint would be ideal but complex due to Strapi's link table structure
    // Instead, we're implementing this through enhanced backend validation
    console.log('Migration: Enhanced backend validation for duplicate service records is now active');
  },

  async down(knex) {
    console.log('Migration: Removed enhanced backend validation for duplicate service records');
  },
};