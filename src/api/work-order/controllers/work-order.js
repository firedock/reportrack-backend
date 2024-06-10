'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { sanitize } = require('@strapi/utils');

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

    async find(ctx) {
      const { page = 1, pageSize = 25 } = ctx.query.pagination || {};
      const { sort, filters } = ctx.query || {};

      // Prepare sorting
      const sortField = sort ? sort.split(':')[0] : 'createdAt';
      const sortOrder = sort ? sort.split(':')[1] : 'asc';

      // Fetch work orders with pagination, sorting, and filtering
      const workOrders = await strapi
        .query('api::work-order.work-order')
        .findMany({
          limit: parseInt(pageSize, 10),
          offset: (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
          orderBy: { [sortField]: sortOrder },
          where: filters,
          populate: {
            createdBy: {
              fields: ['id', 'username'],
            },
            updatedBy: {
              fields: ['id', 'username'],
            },
            customer: {
              populate: {
                users: {
                  fields: ['id', 'username', 'email'],
                },
              },
            },
            property: true,
          },
        });

      // Fetch total count of work orders
      const totalWorkOrders = await strapi
        .query('api::work-order.work-order')
        .count({ where: filters });

      // Calculate pagination details
      const pageCount = Math.ceil(totalWorkOrders / parseInt(pageSize, 10));

      // Sanitize work orders data and transform format
      const sanitizedWorkOrders = await Promise.all(
        workOrders.map(async (order) => {
          const sanitizedOrder = await sanitize.contentAPI.output(
            order,
            strapi.getModel('api::work-order.work-order')
          );
          return {
            id: sanitizedOrder.id,
            attributes: {
              ...sanitizedOrder,
              createdBy: order.createdBy
                ? { id: order.createdBy.id, username: order.createdBy.username }
                : null,
              updatedBy: order.updatedBy
                ? { id: order.updatedBy.id, username: order.updatedBy.username }
                : null,
              customer: order.customer
                ? {
                    id: order.customer.id,
                    name: order.customer.name,
                    users: order.customer.users
                      ? order.customer.users.map((user) => ({
                          id: user.id,
                          username: user.username,
                          email: user.email,
                        }))
                      : [],
                  }
                : null,
              property: order.property
                ? {
                    id: order.property.id,
                    name: order.property.name,
                    address: order.property.address,
                  }
                : null,
            },
          };
        })
      );

      // Prepare the response
      const response = {
        data: sanitizedWorkOrders,
        meta: {
          pagination: {
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
            pageCount,
            total: totalWorkOrders,
          },
        },
      };

      // Send the response
      ctx.send(response);
    },
  })
);
