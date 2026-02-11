'use strict';

/**
 * customer controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::customer.customer',
  ({ strapi }) => ({
    async find(ctx) {
      if (!ctx.state.user) {
        return ctx.badRequest('User is not authenticated.');
      }

      const user = ctx.state.user;

      // Fetch user role if not populated
      let userRole = user?.role?.name;
      if (user?.id && !userRole) {
        try {
          const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: user.id },
            populate: ['role']
          });
          userRole = fullUser?.role?.name;
        } catch (err) {
          console.error('Error fetching user role in customer find:', err);
        }
      }

      // Inject role-based filters into the query before calling super.find()
      // This preserves the standard Strapi v4 response format (with attributes wrapper)
      if (userRole === 'Customer') {
        ctx.query.filters = {
          ...(ctx.query.filters || {}),
          users: { id: user.id },
        };
      } else if (userRole === 'Service Person') {
        ctx.query.filters = {
          ...(ctx.query.filters || {}),
          properties: { users: { id: user.id } },
        };
      }

      return await super.find(ctx);
    },

    async count(ctx) {
      try {
        if (!ctx.state.user) {
          return ctx.unauthorized('Authentication required');
        }

        const user = ctx.state.user;
        const roleFilters = await strapi
          .service('api::customer.customer')
          .getRoleFilters(user);

        const { filters } = ctx.query || {};

        const total = await strapi
          .query('api::customer.customer')
          .count({ where: { ...roleFilters, ...filters } });

        ctx.send({ count: total });
      } catch (error) {
        ctx.send({ error: error.message });
      }
    },

    async countPost(ctx) {
      try {
        if (!ctx.state.user) {
          return ctx.unauthorized('Authentication required');
        }

        const user = ctx.state.user;
        const roleFilters = await strapi
          .service('api::customer.customer')
          .getRoleFilters(user);

        const { filters } = ctx.request.body || {};

        const total = await strapi
          .query('api::customer.customer')
          .count({ where: { ...roleFilters, ...filters } });

        ctx.send({ count: total });
      } catch (error) {
        ctx.send({ error: error.message });
      }
    },

    async getCustomerUsersWithoutProperties(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized('Authentication required');
      }

      // Restrict to Subscriber/Admin only - this returns system-wide data
      let userRole = ctx.state.user?.role?.name;
      if (!userRole) {
        const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: ctx.state.user.id },
          populate: ['role']
        });
        userRole = fullUser?.role?.name;
      }
      if (userRole === 'Customer' || userRole === 'Service Person') {
        return ctx.forbidden('Access denied');
      }

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
      if (!ctx.state.user) {
        return ctx.unauthorized('Authentication required');
      }

      // Restrict to Subscriber/Admin only - this returns system-wide data
      let userRole = ctx.state.user?.role?.name;
      if (!userRole) {
        const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: ctx.state.user.id },
          populate: ['role']
        });
        userRole = fullUser?.role?.name;
      }
      if (userRole === 'Customer' || userRole === 'Service Person') {
        return ctx.forbidden('Access denied');
      }

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
