/**
 * Cleanup script: Delete 15 duplicate service records for Kyle Allison at Foothill Marketplace
 * Created: 2026-03-19
 *
 * All 16 records were created at ~9:10AM on 03/19/2026 due to a race condition.
 * This keeps the FIRST record (lowest ID) and deletes the other 15.
 *
 * Usage: node scripts/cleanup-duplicate-service-records.js [--dry-run]
 */

const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'reportrack-db-1.c6mzqt23cxdm.us-west-1.rds.amazonaws.com',
    port: process.env.DATABASE_PORT || 5432,
    database: process.env.DATABASE_NAME || 'reportrack',
    user: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'rfacc355',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Find Kyle Allison's duplicate service records from today at Foothill Marketplace
    // All 16 have the same start time (~9:10AM) and no end time
    const findQuery = `
      SELECT sr.id, sr.start_date_time, sr.end_date_time, sr.created_at,
             u.username, u.email
      FROM service_records sr
      LEFT JOIN service_records_users_permissions_user_links ul ON ul.service_record_id = sr.id
      LEFT JOIN up_users u ON u.id = ul.user_id
      WHERE u.username = 'Kyle Allison'
        AND sr.end_date_time IS NULL
        AND sr.start_date_time >= '2026-03-19 00:00:00'
        AND sr.start_date_time < '2026-03-20 00:00:00'
      ORDER BY sr.id ASC;
    `;

    const result = await client.query(findQuery);
    console.log(`\nFound ${result.rows.length} active service records for Kyle Allison on 03/19/2026:\n`);

    if (result.rows.length === 0) {
      // Try a broader search - username might be different
      console.log('No results with username "Kyle Allison". Trying broader search...\n');
      const broadQuery = `
        SELECT sr.id, sr.start_date_time, sr.end_date_time, sr.created_at,
               u.username, u.email, u.id as user_id
        FROM service_records sr
        LEFT JOIN service_records_users_permissions_user_links ul ON ul.service_record_id = sr.id
        LEFT JOIN up_users u ON u.id = ul.user_id
        WHERE u.username ILIKE '%kyle%'
          AND sr.end_date_time IS NULL
          AND sr.start_date_time >= '2026-03-19 00:00:00'
          AND sr.start_date_time < '2026-03-20 00:00:00'
        ORDER BY sr.id ASC;
      `;
      const broadResult = await client.query(broadQuery);
      console.log(`Found ${broadResult.rows.length} records with username containing 'kyle':\n`);

      if (broadResult.rows.length === 0) {
        console.log('No matching records found. Please check the username manually.');
        return;
      }

      broadResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ID: ${row.id} | User: ${row.username} (ID: ${row.user_id}) | Start: ${row.start_date_time} | Created: ${row.created_at}`);
      });

      if (broadResult.rows.length <= 1) {
        console.log('\nOnly 1 or fewer records found - nothing to clean up.');
        return;
      }

      const keepId = broadResult.rows[0].id;
      const deleteIds = broadResult.rows.slice(1).map(r => r.id);

      console.log(`\nKeeping record ID: ${keepId}`);
      console.log(`Deleting ${deleteIds.length} duplicate records: ${deleteIds.join(', ')}`);

      if (DRY_RUN) {
        console.log('\n[DRY RUN] No records were deleted. Remove --dry-run to execute.');
        return;
      }

      await deleteRecords(client, deleteIds);
      return;
    }

    result.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ID: ${row.id} | User: ${row.username} | Start: ${row.start_date_time} | Created: ${row.created_at}`);
    });

    if (result.rows.length <= 1) {
      console.log('\nOnly 1 record found - nothing to clean up.');
      return;
    }

    // Keep the first record (lowest ID), delete the rest
    const keepId = result.rows[0].id;
    const deleteIds = result.rows.slice(1).map(r => r.id);

    console.log(`\nKeeping record ID: ${keepId}`);
    console.log(`Deleting ${deleteIds.length} duplicate records: ${deleteIds.join(', ')}`);

    if (DRY_RUN) {
      console.log('\n[DRY RUN] No records were deleted. Remove --dry-run to execute.');
      return;
    }

    await deleteRecords(client, deleteIds);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

async function deleteRecords(client, deleteIds) {
  // Delete related link table entries first (foreign keys)
  const linkTables = [
    'service_records_users_permissions_user_links',
    'service_records_property_links',
    'service_records_customer_links',
    'service_records_service_type_links',
    'service_records_account_links',
    'service_records_author_links',
    'service_records_editor_links',
  ];

  for (const table of linkTables) {
    try {
      const res = await client.query(
        `DELETE FROM ${table} WHERE service_record_id = ANY($1::int[])`,
        [deleteIds]
      );
      if (res.rowCount > 0) {
        console.log(`  Deleted ${res.rowCount} rows from ${table}`);
      }
    } catch (err) {
      // Table might not exist, that's OK
      if (!err.message.includes('does not exist')) {
        console.error(`  Warning: Error cleaning ${table}:`, err.message);
      }
    }
  }

  // Delete the service records themselves
  const deleteResult = await client.query(
    'DELETE FROM service_records WHERE id = ANY($1::int[])',
    [deleteIds]
  );

  console.log(`\nSuccessfully deleted ${deleteResult.rowCount} duplicate service records.`);
}

main();
