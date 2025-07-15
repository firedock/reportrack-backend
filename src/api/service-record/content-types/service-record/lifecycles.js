// Strapi lifecycle hooks are functions that get triggered when Strapi queries are called.

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    
    if (data.users_permissions_user) {
      const existingActiveRecords = await strapi.entityService.findMany('api::service-record.service-record', {
        filters: {
          users_permissions_user: data.users_permissions_user,
          endDateTime: { $null: true }
        },
        populate: ['users_permissions_user']
      });

      if (existingActiveRecords && existingActiveRecords.length > 0) {
        const activeRecord = existingActiveRecords[0];
        const error = new Error(`User already has an active service record (ID: ${activeRecord.id}) started at ${activeRecord.startDateTime}. Please complete the existing service record before starting a new one.`);
        error.name = 'ValidationError';
        Object.assign(error, {
          details: {
            code: 'ACTIVE_SERVICE_RECORD_EXISTS',
            activeRecordId: activeRecord.id,
            startDateTime: activeRecord.startDateTime
          }
        });
        throw error;
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
