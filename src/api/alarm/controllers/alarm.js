// @ts-nocheck
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
  async triggerAlarms(ctx) {
    try {
      // Call the custom service logic to check and trigger alarms
      const logs = await strapi.service('api::alarm.alarm').checkAlarms();

      // Respond to the client with logs
      return ctx.send({
        message: 'Alarms checked and triggered successfully',
        logs, // Include the logs in the response
      });
    } catch (error) {
      // Respond with error message if something goes wrong
      return ctx.badRequest('Error triggering alarms', { error });
    }
  },
  async resetNotifications(ctx) {
    try {
      const { ids } = ctx.request.body; // Expecting an array of alarm IDs

      // Reset the notified field for the specified alarms
      await strapi.db.query('api::alarm.alarm').updateMany({
        where: { id: { $in: ids } },
        data: { notified: null },
      });

      ctx.send({ message: 'Notifications reset successfully' });
    } catch (error) {
      ctx.badRequest('Error resetting notifications', { error });
    }
  },
  async getAllAlarms(ctx) {
    try {
      // Extract optional query parameters for filtering, sorting, and pagination
      const {
        filters,
        sort,
        page = 1,
        pageSize = 10,
        populate = '*',
      } = ctx.query;

      // Convert 'populate=*' to an object for all relations
      const populateOption =
        populate === '*' ? { property: true, customer: true } : populate;

      // Fetch alarms with pagination and populate relations
      const alarms = await strapi.db.query('api::alarm.alarm').findMany({
        where: filters || {}, // Apply filters if provided
        orderBy: sort || { createdAt: 'desc' }, // Default sorting by creation date descending
        limit: pageSize,
        offset: (page - 1) * pageSize,
        populate: populateOption, // Populate relations (converted object)
      });

      // Count total alarms for pagination metadata
      const total = await strapi.db.query('api::alarm.alarm').count({
        where: filters || {},
      });

      // Send response with alarms and pagination metadata
      return ctx.send({
        data: alarms,
        meta: {
          pagination: {
            page: Number(page),
            pageSize: Number(pageSize),
            total,
            pageCount: Math.ceil(total / pageSize),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching alarms:', error);
      return ctx.badRequest('Error fetching alarms', { error });
    }
  },
}));
