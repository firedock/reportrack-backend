'use strict';

/**
 * work-order router
 */

// const { createCoreRouter } = require('@strapi/strapi').factories;

// module.exports = createCoreRouter('api::work-order.work-order');

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::work-order.work-order', {
  config: {
    find: {
      middlewares: [],
    },
    findOne: {
      middlewares: [],
    },
    create: {
      middlewares: [],
    },
    update: {
      middlewares: [],
    },
    delete: {
      middlewares: [],
    },
  },
  routes: [
    {
      method: 'GET',
      path: '/work-orders',
      handler: 'work-order.find',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/work-orders/:id',
      handler: 'work-order.findOne',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/work-orders',
      handler: 'work-order.create',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/work-orders/:id',
      handler: 'work-order.update',
      config: {
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/work-orders/:id',
      handler: 'work-order.delete',
      config: {
        policies: [],
      },
    },
  ],
});
