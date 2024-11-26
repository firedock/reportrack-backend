'use strict';

/**
 * service-record controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::service-record.service-record',
  ({ strapi }) => ({
    async count(ctx) {
      try {
        // Extract filters from the context if provided
        const { filters } = ctx.query || {};

        // Fetch total count with optional filters
        const total = await strapi
          .query('api::service-record.service-record')
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
    async find(ctx) {
      const user = ctx.state.user; // Get the authenticated user
      // console.log('user', user);
      // Use the service to fetch the records based on user filters
      const records = await strapi
        .service('api::service-record.service-record')
        .findRecordsByUser(user, ctx.query);

      return ctx.send(records); // Return the filtered records
    },
    async create(ctx) {
      const { id } = ctx.state.user; // Get the current user ID
      const response = await super.create(ctx); // Create the record
      const updatedResponse = await strapi.entityService.update(
        'api::service-record.service-record',
        response.data.id,
        { data: { author: id } } // Set the author field
      );
      return updatedResponse;
    },

    async update(ctx) {
      const { id } = ctx.state.user; // Get the current user ID
      const response = await super.update(ctx); // Update the record
      const updatedResponse = await strapi.entityService.update(
        'api::service-record.service-record',
        response.data.id,
        { data: { editor: id } } // Set the editor field to current user
      );
      return updatedResponse;
    },
  })
);
