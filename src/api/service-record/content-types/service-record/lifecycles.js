// Strapi lifecycle hooks are functions that get triggered when Strapi queries are called.

module.exports = {
  async beforeCreate(event) {
    console.log('beforeCreate service-record');
  },
  async beforeUpdate(event) {
    console.log('beforeUpdate service-record');
  },
  async beforeFindMany(event) {
    console.log('beforeFindMany service-record');
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
