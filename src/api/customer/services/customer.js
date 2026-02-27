'use strict';

/**
 * customer service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::customer.customer', ({ strapi }) => ({
  async findCustomersByUser(user, queryParams) {
    const page = queryParams?.pagination?.page || 1;
    const pageSize = queryParams?.pagination?.pageSize || 10;
    const filters = queryParams?.filters || {};
    const doAssociatedFilter = queryParams?.showAssociatedOnly === 'true';

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
        console.error('Error fetching user role in findCustomersByUser:', err);
      }
    }

    let userFilters = {};

    if (userRole === 'Customer') {
      // MANDATORY: Customers can ONLY see their own customer(s)
      // Uses property-based path since associations are managed through properties
      userFilters = {
        properties: { users: { id: user.id } },
      };
    } else if (userRole === 'Service Person') {
      // MANDATORY: Service Persons see customers for properties they're assigned to
      userFilters = {
        properties: { users: { id: user.id } },
      };
    } else if (doAssociatedFilter) {
      // OPTIONAL: For Subscriber/Admin
      userFilters = {
        $or: [
          { users: { id: user.id } },
          { properties: { users: { id: user.id } } },
        ],
      };
    }

    const queryOptions = {
      filters: { ...userFilters, ...filters },
      populate: {
        users: true,
        properties: true,
      },
      pagination: {
        page,
        pageSize,
      },
    };

    const result = await strapi.entityService.findMany(
      'api::customer.customer',
      queryOptions
    );

    const totalCount = await strapi.entityService.count(
      'api::customer.customer',
      { filters: { ...userFilters, ...filters } }
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

  /**
   * Get role-based filters for count queries
   */
  async getRoleFilters(user) {
    let userRole = user?.role?.name;
    if (user?.id && !userRole) {
      try {
        const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: user.id },
          populate: ['role']
        });
        userRole = fullUser?.role?.name;
      } catch (err) {
        console.error('Error fetching user role in getRoleFilters:', err);
      }
    }

    if (userRole === 'Customer') {
      return { properties: { users: { id: user.id } } };
    } else if (userRole === 'Service Person') {
      return { properties: { users: { id: user.id } } };
    }
    return {};
  },
}));
