'use strict';

const { sanitize } = require('@strapi/utils');

module.exports = {
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

  async findOne(ctx) {
    const { id } = ctx.params;

    const workOrder = await strapi.query('api::work-order.work-order').findOne({
      where: { id },
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

    if (!workOrder) {
      return ctx.notFound('Work Order not found');
    }

    const sanitizedWorkOrder = await sanitize.contentAPI.output(
      workOrder,
      strapi.getModel('api::work-order.work-order')
    );

    const response = {
      id: sanitizedWorkOrder.id,
      attributes: {
        ...sanitizedWorkOrder,
        createdBy: workOrder.createdBy
          ? {
              id: workOrder.createdBy.id,
              username: workOrder.createdBy.username,
            }
          : null,
        updatedBy: workOrder.updatedBy
          ? {
              id: workOrder.updatedBy.id,
              username: workOrder.updatedBy.username,
            }
          : null,
        customer: workOrder.customer
          ? {
              id: workOrder.customer.id,
              name: workOrder.customer.name,
              users: workOrder.customer.users
                ? workOrder.customer.users.map((user) => ({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                  }))
                : [],
            }
          : null,
        property: workOrder.property
          ? {
              id: workOrder.property.id,
              name: workOrder.property.name,
              address: workOrder.property.address,
            }
          : null,
      },
    };

    ctx.send(response);
  },

  async create(ctx) {
    const { body } = ctx.request;
    const user = ctx.state.user;

    body.data.createdBy = user.id;

    const newWorkOrder = await strapi.entityService.create(
      'api::work-order.work-order',
      {
        data: body.data,
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
      }
    );

    ctx.send(newWorkOrder);
  },

  async update(ctx) {
    const { id } = ctx.params;
    const { body } = ctx.request;
    const user = ctx.state.user;

    body.data.updatedBy = user.id;

    const updatedWorkOrder = await strapi.entityService.update(
      'api::work-order.work-order',
      id,
      {
        data: body.data,
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
      }
    );

    ctx.send(updatedWorkOrder);
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const deletedWorkOrder = await strapi.entityService.delete(
      'api::work-order.work-order',
      id,
      {
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
      }
    );

    ctx.send(deletedWorkOrder);
  },
};
