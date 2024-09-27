'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::service-record.service-record',
  ({ strapi }) => ({
    async findRecordsByUser(user, queryParams) {
      // Set up default pagination or use provided query params
      const page = queryParams?.pagination?.page || 1;
      const pageSize = queryParams?.pagination?.pageSize || 10;

      // Extract sort and filters parameters from queryParams
      const sort = queryParams?.sort;
      const filters = queryParams?.filters || {}; // Extract filters from queryParams

      // Custom logic to filter by user role or specific fields
      let userFilters = {};

      if (['Admin', 'Subscriber'].includes(user.role.name)) {
        userFilters = {};
      } else if (user.role.name === 'Customer') {
        userFilters = { customer: user.id };
      } else {
        userFilters = { users_permissions_user: user.id };
      }

      // Prepare the query object with pagination, filters, and sort
      const queryOptions = {
        where: { ...userFilters, ...filters }, // Merge user filters and search filters
        populate: {
          property: true,
          customer: true,
          service_type: true,
          users_permissions_user: true,
          author: true,
        },
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      // Add sorting if provided
      if (sort) {
        const [sortField, sortOrder] = sort.split(':');

        // Handle sorting for nested fields
        if (sortField.includes('.')) {
          const [relation, field] = sortField.split('.');
          queryOptions.orderBy = {
            [relation]: {
              [field]: sortOrder,
            },
          };
        } else {
          queryOptions.orderBy = { [sortField]: sortOrder };
        }
      }

      // Log the query options for debugging
      console.log('queryOptions:', queryOptions);

      // Execute the query
      const result = await strapi.db
        .query('api::service-record.service-record')
        .findMany(queryOptions);

      // Get the total count for pagination
      const totalCount = await strapi.db
        .query('api::service-record.service-record')
        .count({
          where: { ...userFilters, ...filters },
        });

      // Return the data along with pagination meta information
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
  })
);
