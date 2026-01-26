// Strapi lifecycle hooks are functions that get triggered when Strapi queries are called.

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    if (data.users_permissions_user) {
      try {
        console.log('📝 beforeCreate: Checking for active service records for user:', data.users_permissions_user);

        // Use Strapi's entity service for compatibility across environments
        // This avoids raw SQL issues that may differ between local and staging
        const existingRecords = await strapi.db.query('api::service-record.service-record').findMany({
          where: {
            users_permissions_user: data.users_permissions_user,
            end_date_time: null, // No end time means still active
          },
          select: ['id', 'start_date_time'],
          limit: 1,
        });

        console.log('📝 beforeCreate: Found existing records:', existingRecords?.length || 0);

        if (existingRecords && existingRecords.length > 0) {
          const activeRecord = existingRecords[0];
          console.log('❌ beforeCreate: User has active service record:', activeRecord.id);

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
      } catch (error) {
        // Re-throw validation errors
        if (error.name === 'ValidationError') {
          throw error;
        }
        // Log but don't block creation for other errors (like DB connection issues)
        console.error('⚠️ beforeCreate: Error checking for active records:', error.message);
        console.error('⚠️ beforeCreate: Stack:', error.stack);
        // Don't throw - allow creation to proceed and handle any issues downstream
      }
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
