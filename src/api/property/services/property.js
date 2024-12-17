'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::property.property', ({ strapi }) => ({
  async findPropertiesByUser(user, queryParams) {
    const page = queryParams?.pagination?.page || 1;
    const pageSize = queryParams?.pagination?.pageSize || 10;
    const filters = queryParams?.filters || {};
    const doAssociatedFilter = queryParams?.showAssociatedOnly === 'true';

    // const userRole = user?.role?.name;

    let userFilters = {};

    // If "Show Associated" is toggled, combine filters for both roles
    if (doAssociatedFilter) {
      userFilters = {
        $or: [
          { users: { id: user.id } }, // For Subscribers
          {
            customer: {
              users: {
                id: { $eq: user.id },
              },
            },
          }, // For Customers
        ],
      };
    }

    // Build query options
    const queryOptions = {
      filters: { ...userFilters, ...filters },
      populate: {
        users: true,
        customer: true, // customer refers to a singular relationship field on the Property content type.
        customers: { populate: ['users'] }, // customers implies a plural relationship or nested population, which includes users related to those customers
      },
      pagination: {
        page,
        pageSize,
      },
    };

    // console.log('Query Options:', JSON.stringify(queryOptions, null, 2));

    // Fetch properties and total count
    const result = await strapi.entityService.findMany(
      'api::property.property',
      queryOptions
    );

    const totalCount = await strapi.entityService.count(
      'api::property.property',
      {
        filters: { ...userFilters, ...filters },
      }
    );

    return {
      data: result,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(totalCount / pageSize),
          total: totalCount,
        },
      },
    };
  },
}));
