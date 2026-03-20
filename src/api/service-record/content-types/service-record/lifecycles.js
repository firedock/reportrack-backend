// Strapi lifecycle hooks are functions that get triggered when Strapi queries are called.

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    if (data.users_permissions_user) {
      const userId = data.users_permissions_user;
      try {
        console.log('📝 beforeCreate: Checking for active service records for user:', userId);

        // Use a PostgreSQL advisory lock to prevent race conditions.
        // Without this, concurrent requests can all pass the check before any record is committed.
        // The lock key is derived from the user ID to serialize per-user creation.
        const knex = strapi.db.connection;
        const lockKey = 100000 + Number(userId); // Offset to avoid collisions with other advisory locks
        await knex.raw('SELECT pg_advisory_lock(?)', [lockKey]);
        console.log('📝 beforeCreate: Acquired advisory lock for user:', userId);

        // Store lock info on event so afterCreate can release it
        event.state = { advisoryLockKey: lockKey };

        const existingRecords = await strapi.db.query('api::service-record.service-record').findMany({
          where: {
            users_permissions_user: userId,
            end_date_time: null, // No end time means still active
          },
          select: ['id', 'start_date_time'],
          limit: 1,
        });

        console.log('📝 beforeCreate: Found existing records:', existingRecords?.length || 0);

        if (existingRecords && existingRecords.length > 0) {
          const activeRecord = existingRecords[0];
          console.log('❌ beforeCreate: User has active service record:', activeRecord.id);

          // Release the lock before throwing
          await knex.raw('SELECT pg_advisory_unlock(?)', [lockKey]);
          console.log('📝 beforeCreate: Released advisory lock (duplicate found) for user:', userId);
          event.state.advisoryLockKey = null;

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

        console.log('✅ beforeCreate: No active service records found, proceeding with creation');
        // Lock remains held until afterCreate releases it (ensures the INSERT commits first)
      } catch (error) {
        // Re-throw validation errors
        if (error.name === 'ValidationError') {
          throw error;
        }
        // Log but don't block creation for other errors (like DB connection issues)
        console.error('⚠️ beforeCreate: Error checking for active records:', error.message);
        console.error('⚠️ beforeCreate: Stack:', error.stack);
        // Release lock on unexpected errors
        try {
          const knex = strapi.db.connection;
          const lockKey = 100000 + Number(userId);
          await knex.raw('SELECT pg_advisory_unlock(?)', [lockKey]);
        } catch (unlockErr) {
          console.error('⚠️ beforeCreate: Error releasing advisory lock:', unlockErr.message);
        }
      }
    }
  },
  async beforeUpdate(event) {
    // console.log('beforeUpdate service-record');
  },
  async beforeFindMany(event) {
    // console.log('beforeFindMany service-record');
  },
  async afterCreate(event) {
    const { result, params, action } = event;

    // Release the advisory lock acquired in beforeCreate
    if (event.state?.advisoryLockKey) {
      try {
        const knex = strapi.db.connection;
        await knex.raw('SELECT pg_advisory_unlock(?)', [event.state.advisoryLockKey]);
        console.log('📝 afterCreate: Released advisory lock for key:', event.state.advisoryLockKey);
      } catch (unlockErr) {
        console.error('⚠️ afterCreate: Error releasing advisory lock:', unlockErr.message);
      }
    }

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
