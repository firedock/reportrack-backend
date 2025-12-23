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

    async countPost(ctx) {
      try {
        // Extract filters from the request body
        const { filters } = ctx.request.body || {};

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

      // Only Admin and Subscriber can delete work orders
      // Note: Customer deletion was removed because the work-order schema doesn't have
      // a proper 'author' relation to track which user created it. To re-enable this,
      // add an 'author' relation (oneToOne to users-permissions.user) to the schema.
      if (userRole !== 'Admin' && userRole !== 'Subscriber') {
        return ctx.forbidden('You do not have permission to delete work orders');
      }

      // Use default delete behavior for authorized users
      return await super.delete(ctx);
    },
  })
);
