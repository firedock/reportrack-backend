// Strapi lifecycle hooks are functions that get triggered when Strapi queries are called.

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    
    if (data.users_permissions_user) {
      // Use database transaction with row-level locking to prevent race conditions
      const knex = strapi.db.connection;
      const result = await knex.transaction(async (trx) => {
        // Lock the user row to prevent concurrent service record creation
        await knex.raw(`
          SELECT 1 FROM up_users 
          WHERE id = ? 
          FOR UPDATE
        `, [data.users_permissions_user]).transacting(trx);

        // Check for existing active records with explicit join to ensure consistency
        const existingActiveRecords = await knex.raw(`
          SELECT sr.id, sr.start_date_time 
          FROM service_records sr
          JOIN service_records_users_permissions_user_links ul ON sr.id = ul.service_record_id
          WHERE ul.user_id = ? AND sr.end_date_time IS NULL
        `, [data.users_permissions_user]).transacting(trx);

        // Handle different database drivers - some return 'rows', others return the array directly
        const rows = existingActiveRecords.rows || existingActiveRecords;
        
        if (rows && rows.length > 0) {
          const activeRecord = rows[0];
          const error = new Error(`User already has an active service record (ID: ${activeRecord.id}) started at ${activeRecord.start_date_time}. Please complete the existing service record before starting a new one.`);
          error.name = 'ValidationError';
          Object.assign(error, {
            details: {
              code: 'ACTIVE_SERVICE_RECORD_EXISTS',
              activeRecordId: activeRecord.id,
              startDateTime: activeRecord.start_date_time
            }
          });
          throw error;
        }

        return true;
      });
    }
  },
  async beforeUpdate(event) {
    // console.log('beforeUpdate service-record');
  },
  async beforeFindMany(event) {
    // console.log('beforeFindMany service-record');
  },
  afterCreate(event) {
    const { result, params, action } = event;
    // Strapi uses a Node.js feature called AsyncLocalStorage to make the context available anywhere.
    const ctx = strapi.requestContext.get();

    strapi.entityService.create('api::audit-log.audit-log', {
      data: {
        type: 'Service Record',
        action,
        author: ctx.state.user.username,
        result,
        params,
      },
    });
  },
};
