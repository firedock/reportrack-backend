// @ts-nocheck
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::service-record.service-record',
  ({ strapi }) => ({
    async findRecordsByUser(user, queryParams) {
      // console.log('findRecordsByUser', user);
      const page = queryParams?.pagination?.page || 1;
      const pageSize = queryParams?.pagination?.pageSize || 10;
      const sort = queryParams?.sort || 'startDateTime:desc';
      const filters = queryParams?.filters || {};
      const doAssociatedFilter =
        queryParams?.showAssociatedOnly === 'true' && user?.id;

      const userRole = user?.role?.name;

      let userFilters = {};

      if (userRole === 'Customer') {
        userFilters = {
          property: {
            users: {
              id: { $eq: user.id },
            },
          },
        };
        // console.log('Customer Filters', userFilters);
      } else if (userRole === 'Service Person') {
        userFilters = { users_permissions_user: user.id };
        // console.log('Service Person Filters', userFilters);
      }

      // Determine if we need to filter by associated users
      else if (doAssociatedFilter) {
        userFilters = {
          $or: [
            {
              property: {
                users: {
                  id: { $eq: user.id },
                },
              },
            },
            {
              customer: {
                users: {
                  id: { $eq: user.id },
                },
              },
            },
          ],
        };
        // console.log('Show Associated', doAssociatedFilter);
      }

      // Set up query options with pagination, sorting, and user filters
      const queryOptions = {
        where: { ...userFilters, ...filters },
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
        },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: {
          startDateTime: sort.split(':')[1] === 'asc' ? 'asc' : 'desc',
        },
      };

      // console.log('\nqueryOptions', JSON.stringify(queryOptions, 2, null));

      // Execute the query
      const result = await strapi.db
        .query('api::service-record.service-record')
        .findMany(queryOptions);

      // Count total records for pagination meta
      const totalCount = await strapi.db
        .query('api::service-record.service-record')
        .count({ where: { ...userFilters, ...filters } });

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
