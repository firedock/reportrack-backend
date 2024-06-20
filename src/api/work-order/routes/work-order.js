'use strict';

/**
 * work-order router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::work-order.work-order', {
  config: {
    find: {
      middlewares: ['api::work-order.populate-creator-fields'],
    },
    findOne: {
      middlewares: ['api::work-order.populate-creator-fields'],
    },
  },
});
