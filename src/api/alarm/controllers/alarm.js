'use strict';

/**
 * alarm controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::alarm.alarm', ({ strapi }) => ({
  async count(ctx) {
    try {
      // Extract filters from the context if provided
      const { filters } = ctx.query || {};

      // Fetch total count of with optional filters
      const total = await strapi
        .query('api::alarm.alarm')
        .count({ where: filters });

      // Prepare the response
      const response = { count: total };

      // Send the response
      ctx.send(response);
    } catch (error) {
      // Send the error response
      ctx.send({ error: error.message });
    }
  },
}));
