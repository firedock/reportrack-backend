'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::property.property', ({ strapi }) => ({
  async findPropertiesByUser(user, queryParams) {
    const page = queryParams?.pagination?.page || 1;
    const pageSize = queryParams?.pagination?.pageSize || 10;
    const filters = queryParams?.filters || {};
    const doAssociatedFilter = queryParams?.showAssociatedOnly === 'true';
    const searchTerm = queryParams?.search || ''; // Extract search term

    let userFilters = {};

    if (doAssociatedFilter) {
      userFilters = {
        $or: [
          { users: { id: user.id } }, // For Subscribers
          { customer: { users: { id: user.id } } }, // For Customers
        ],
      };
    }

    let searchFilters = {};
    if (searchTerm) {
      searchFilters = {
        $or: [
          { name: { $containsi: searchTerm } }, // Search by property name
          { customer: { name: { $containsi: searchTerm } } }, // Search by customer name
        ],
      };
    }

    const queryOptions = {
      filters: { ...userFilters, ...filters, ...searchFilters },
      populate: {
        users: true,
        customer: true,
      },
      pagination: {
        page,
        pageSize,
      },
    };

    const result = await strapi.entityService.findMany(
      'api::property.property',
      queryOptions
    );

    const totalCount = await strapi.entityService.count(
      'api::property.property',
      { filters: { ...userFilters, ...filters, ...searchFilters } }
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
