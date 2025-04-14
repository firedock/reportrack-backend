'use strict';

/**
 * customer controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::customer.customer',
  ({ strapi }) => ({
    async count(ctx) {
      try {
        // Extract filters from the context if provided
        const { filters } = ctx.query || {};

        // Fetch total count of with optional filters
        const total = await strapi
          .query('api::customer.customer')
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
    async getCustomerUsersWithoutProperties(ctx) {
      try {
        const result = await strapi.db.connection.raw(`
          SELECT * FROM customer_users_without_properties
        `);
        ctx.send(result.rows);
      } catch (error) {
        console.error('Error:', error);
        ctx.send({ error: 'Failed to fetch customers without properties' });
      }
    },
    async getCustomersWithoutProperties(ctx) {
      try {
        const result = await strapi.db.connection.raw(`
          SELECT * FROM customers_without_properties
        `);
        ctx.send(result.rows);
      } catch (error) {
        console.error('Error:', error);
        ctx.send({ error: 'Failed to fetch customers without properties' });
      }
    },
  })
);
