'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
// const { sanitize } = require('@strapi/utils');

module.exports = createCoreController(
  'api::work-order.work-order',
  ({ strapi }) => ({
    async count(ctx) {
      try {
        // Extract filters from the context if provided
        const { filters } = ctx.query || {};

        // Fetch total count of work orders with optional filters
        const totalWorkOrders = await strapi
          .query('api::work-order.work-order')
          .count({ where: filters });

        // Prepare the response
        const response = { count: totalWorkOrders };

        // Send the response
        ctx.send(response);
      } catch (error) {
        // Send the error response
        ctx.send({ error: error.message });
      }
    },
    async find(ctx) {
      const user = ctx.state.user; // Get the authenticated user

      // Use the service to fetch the records based on user filters
      const records = await strapi
        .service('api::work-order.work-order')
        .findRecordsByUser(user, ctx.query);

      return ctx.send(records); // Return the filtered records
    },
  })
);
