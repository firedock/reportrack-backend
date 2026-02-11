'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
// const { sanitize } = require('@strapi/utils');

module.exports = createCoreController(
  'api::work-order.work-order',
  ({ strapi }) => ({
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
            $and: [
              { property: { users: { id: { $eq: user.id } } } },
              { $or: [{ private: { $eq: false } }, { private: { $null: true } }] }
            ]
          };
        } else if (userRole === 'Service Person') {
          roleFilters = { users_permissions_user: user.id };
        }

        const combinedWhere = Object.keys(roleFilters).length > 0 && Object.keys(filters || {}).length > 0
          ? { $and: [roleFilters, filters] }
          : { ...roleFilters, ...filters };

        const totalWorkOrders = await strapi
          .query('api::work-order.work-order')
          .count({ where: combinedWhere });

        ctx.send({ count: totalWorkOrders });
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
            $and: [
              { property: { users: { id: { $eq: user.id } } } },
              { $or: [{ private: { $eq: false } }, { private: { $null: true } }] }
            ]
          };
        } else if (userRole === 'Service Person') {
          roleFilters = { users_permissions_user: user.id };
        }

        const combinedWhere = Object.keys(roleFilters).length > 0 && Object.keys(filters || {}).length > 0
          ? { $and: [roleFilters, filters] }
          : { ...roleFilters, ...filters };

        const totalWorkOrders = await strapi
          .query('api::work-order.work-order')
          .count({ where: combinedWhere });

        ctx.send({ count: totalWorkOrders });
      } catch (error) {
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

    async findOne(ctx) {
      const user = ctx.state.user;
      const userRole = user?.role?.name;
      const workOrderId = ctx.params.id;

      // Fetch the work order with full details
      const workOrder = await strapi.db.query('api::work-order.work-order').findOne({
        where: { id: workOrderId },
        populate: {
          property: {
            populate: ['users'],
          },
          customer: {
            populate: ['users'],
          },
          service_type: true,
          users_permissions_user: true,
          author: true,
          notes: true,
          media: true,
        },
      });

      if (!workOrder) {
        return ctx.notFound('Work order not found');
      }

      // Check if customer is trying to access a private work order
      if (userRole === 'Customer' && workOrder.private === true) {
        return ctx.forbidden('You do not have permission to access this work order');
      }

      // For customers, verify they have access through property association
      if (userRole === 'Customer') {
        const hasAccess = workOrder.property?.users?.some(u => u.id === user.id);
        if (!hasAccess) {
          return ctx.forbidden('You do not have permission to access this work order');
        }
      }

      return ctx.send({ data: workOrder });
    },

    async update(ctx) {
      const user = ctx.state.user;
      const userRole = user?.role?.name;
      const workOrderId = ctx.params.id;

      // Customers can update work orders but not the status field
      if (userRole === 'Customer' && ctx.request.body.data?.status) {
        return ctx.forbidden('Customers cannot modify work order status');
      }

      // Check if customer is trying to update a private work order
      if (userRole === 'Customer') {
        const workOrder = await strapi.db.query('api::work-order.work-order').findOne({
          where: { id: workOrderId },
          populate: {
            property: {
              populate: ['users'],
            },
          },
        });

        if (!workOrder) {
          return ctx.notFound('Work order not found');
        }

        // Prevent customers from updating private work orders
        if (workOrder.private === true) {
          return ctx.forbidden('You do not have permission to update this work order');
        }

        // Verify they have access through property association
        const hasAccess = workOrder.property?.users?.some((u) => u.id === user.id);
        if (!hasAccess) {
          return ctx.forbidden('You do not have permission to update this work order');
        }
      }

      // Use default update behavior for authorized users
      return await super.update(ctx);
    },

    async delete(ctx) {
      const user = ctx.state.user;
      const userRole = user?.role?.name;
      const workOrderId = ctx.params.id;

      // Check if user has permission to delete
      if (userRole !== 'Admin' && userRole !== 'Subscriber' && userRole !== 'Customer') {
        return ctx.forbidden('You do not have permission to delete work orders');
      }

      // If customer, check if they created the work order
      if (userRole === 'Customer') {
        const workOrder = await strapi.db.query('api::work-order.work-order').findOne({
          where: { id: workOrderId },
          populate: ['author']
        });

        if (!workOrder) {
          return ctx.notFound('Work order not found');
        }

        // Check if the customer created this work order (using author relation)
        if (workOrder.author?.id !== user.id) {
          return ctx.forbidden('Customers can only delete work orders they created');
        }
      }

      // Use default delete behavior for authorized users
      return await super.delete(ctx);
    },
  })
);
