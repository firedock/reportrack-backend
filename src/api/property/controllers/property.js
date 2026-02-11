'use strict';

/**
 * property controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::property.property',
  ({ strapi }) => ({
    async find(ctx) {
      if (!ctx.state.user) {
        return ctx.badRequest('User is not authenticated.');
      }

      const user = ctx.state.user; // Get the authenticated user
      const records = await strapi
        .service('api::property.property')
        .findPropertiesByUser(user, ctx.query);

      return ctx.send(records); // Return the filtered properties
    },
    async getPropertiesWithoutUsers(ctx) {
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
      SELECT * FROM properties_without_users
    `);
        ctx.send(result.rows);
      } catch (error) {
        console.error('Error:', error);
        ctx.send({ error: 'Failed to fetch properties without users' });
      }
    },

    async findByCustomer(ctx) {
      const { id } = ctx.params;

      if (!ctx.state.user) {
        return ctx.unauthorized('Authentication required');
      }

      if (!id) {
        return ctx.badRequest('Customer ID is required');
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
          console.error('Error fetching user role in findByCustomer:', err);
        }
      }

      try {
        // For Customer role: verify they belong to the requested customer
        if (userRole === 'Customer') {
          const customer = await strapi.db.query('api::customer.customer').findOne({
            where: { id: id },
            populate: { users: true },
          });

          if (!customer) {
            return ctx.notFound('Customer not found');
          }

          const hasAccess = customer.users?.some(u => u.id === user.id);
          if (!hasAccess) {
            return ctx.forbidden('You do not have access to this customer\'s properties');
          }

          // Only return properties the Customer user is associated with
          const properties = await strapi.entityService.findMany(
            'api::property.property',
            {
              filters: {
                customer: { id: id },
                $or: [
                  { users: { id: user.id } },
                  { customer: { users: { id: user.id } } },
                ],
              },
              populate: ['customer'],
            }
          );
          return ctx.send({ data: properties });
        }

        // For Service Person: only return properties they're assigned to
        if (userRole === 'Service Person') {
          const properties = await strapi.entityService.findMany(
            'api::property.property',
            {
              filters: {
                customer: { id: id },
                users: { id: user.id },
              },
              populate: ['customer'],
            }
          );
          return ctx.send({ data: properties });
        }

        // For Subscriber/Admin: return all properties for the customer
        const properties = await strapi.entityService.findMany(
          'api::property.property',
          {
            filters: {
              customer: { id: id },
            },
            populate: ['customer'],
          }
        );
        ctx.send({ data: properties });
      } catch (error) {
        // @ts-ignore
        ctx.internalServerError('Failed to fetch properties', error);
      }
    },

    async count(ctx) {
      try {
        if (!ctx.state.user) {
          return ctx.unauthorized('Authentication required');
        }

        const user = ctx.state.user;
        let userRole = user?.role?.name;
        if (user?.id && !userRole) {
          const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: user.id },
            populate: ['role']
          });
          userRole = fullUser?.role?.name;
        }

        const { filters } = ctx.query || {};

        let roleFilters = {};
        if (userRole === 'Customer') {
          roleFilters = {
            $or: [
              { users: { id: user.id } },
              { customer: { users: { id: user.id } } },
            ],
          };
        } else if (userRole === 'Service Person') {
          roleFilters = { users: { id: user.id } };
        }

        const total = await strapi
          .query('api::property.property')
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
        let userRole = user?.role?.name;
        if (user?.id && !userRole) {
          const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: user.id },
            populate: ['role']
          });
          userRole = fullUser?.role?.name;
        }

        const { filters } = ctx.request.body || {};

        let roleFilters = {};
        if (userRole === 'Customer') {
          roleFilters = {
            $or: [
              { users: { id: user.id } },
              { customer: { users: { id: user.id } } },
            ],
          };
        } else if (userRole === 'Service Person') {
          roleFilters = { users: { id: user.id } };
        }

        const total = await strapi
          .query('api::property.property')
          .count({ where: { ...roleFilters, ...filters } });

        ctx.send({ count: total });
      } catch (error) {
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
