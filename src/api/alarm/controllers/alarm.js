// @ts-nocheck
'use strict';

/**
 * alarm controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::alarm.alarm', ({ strapi }) => ({
  async count(ctx) {
    try {
      const { filters = {} } = ctx.query;
      const user = ctx.state.user;
      const userRole = user?.role?.name;

      if (userRole === 'Customer') {
        const userProperties = await strapi.db
          .query('api::property.property')
          .findMany({
            where: { users: { id: user.id } }, // Fetch properties associated with the user
            select: ['id'],
          });

        const allowedPropertyIds = userProperties.map((p) => p.id);

        filters.property = {
          id: { $in: allowedPropertyIds },
        };
      }

      const total = await strapi
        .query('api::alarm.alarm')
        .count({ where: filters });

      ctx.send({ count: total });
    } catch (error) {
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
  async getAlarmsWithoutUsers(ctx) {
    try {
      const result = await strapi.db.connection.raw(`
        SELECT *
        FROM alarms_without_users
      `);

      ctx.send(result.rows);
    } catch (error) {
      console.error('Error fetching alarms without users:', error);
      ctx.send({ error: 'Failed to fetch alarms without users' });
    }
  },

  // This method is used to fetch all alarms with pagination and filtering
  async getAllAlarms(ctx) {
    try {
      const {
        filters = {},
        sort,
        page = 1,
        pageSize = 10,
        populate = '*',
      } = ctx.query;

      const user = ctx.state.user;
      const userRole = user?.role?.name;

      // If the user is a customer, restrict to associated properties
      if (userRole === 'Customer') {
        // First, fetch property IDs associated with this user
        const userProperties = await strapi.db
          .query('api::property.property')
          .findMany({
            where: { users: { id: user.id } },
            select: ['id'],
          });

        const allowedPropertyIds = userProperties.map((p) => p.id);

        // Apply a filter to only return alarms for those properties
        filters.property = {
          id: { $in: allowedPropertyIds },
        };
      }

      const populateOption =
        populate === '*'
          ? {
              property: {
                populate: ['users'],
              },
              customer: true,
              service_type: true,
              expected_service_person: true,
            }
          : populate;

      const alarms = await strapi.db.query('api::alarm.alarm').findMany({
        where: filters,
        orderBy: sort || { createdAt: 'desc' },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        populate: populateOption,
      });

      // Attach users to top-level "users" key for frontend convenience
      const alarmsWithUsers = alarms.map((alarm) => ({
        ...alarm,
        users: alarm.property?.users || [],
      }));

      // console.log('Fetched alarms:', alarms);

      const total = await strapi.db.query('api::alarm.alarm').count({
        where: filters,
      });

      return ctx.send({
        data: alarmsWithUsers, // ✅ Send the modified version that includes top-level users
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
