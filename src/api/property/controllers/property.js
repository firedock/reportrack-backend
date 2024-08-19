'use strict';

/**
 * property controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::property.property',
  ({ strapi }) => ({
    async count(ctx) {
      try {
        // Extract filters from the context if provided
        const { filters } = ctx.query || {};

        // Fetch total count of with optional filters
        const total = await strapi
          .query('api::property.property')
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
    async locationScans(ctx) {
      try {
        const { code } = ctx.query;

        if (!code) {
          ctx.throw(400, 'Code query parameter is required');
        }

        const knex = strapi.db.connection; // Accessing knex directly

        // Build the query using knex to match the JSONB structure
        const record = await knex('properties')
          .whereRaw('location_scans @> ?', [`[{"code": "${code}"}]`])
          .first();

        if (!record) {
          ctx.throw(404, 'No property found with the given code');
        }

        // Manually populate related data if necessary
        if (ctx.query.populate) {
          const populatedRecord = await strapi.entityService.findOne(
            'api::property.property',
            record.id,
            // @ts-ignore
            { populate: ctx.query.populate }
          );
          ctx.send({ ...populatedRecord });
        } else {
          ctx.send({ ...record });
        }
      } catch (error) {
        ctx.throw(500, error.message);
      }
    },
  })
);
