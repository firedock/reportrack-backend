'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::property.property', ({ strapi }) => ({
  async findPropertiesByUser(user, queryParams) {
    const page = queryParams?.pagination?.page || 1;
    const pageSize = queryParams?.pagination?.pageSize || 10;
    const filters = queryParams?.filters || {};
    const doAssociatedFilter = queryParams?.showAssociatedOnly === 'true';
    const searchTerm = queryParams?.search || ''; // Extract search term

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
        console.error('Error fetching user role in findPropertiesByUser:', err);
      }
    }

    let userFilters = {};

    if (userRole === 'Customer') {
      // MANDATORY: Customers can ONLY see properties they are associated with
      userFilters = {
        $or: [
          { users: { id: user.id } },
          { customer: { users: { id: user.id } } },
        ],
      };
    } else if (userRole === 'Service Person') {
      // MANDATORY: Service Persons only see their assigned properties
      userFilters = { users: { id: user.id } };
    } else if (doAssociatedFilter) {
      // OPTIONAL: For Subscriber/Admin - toggle-based filtering
      userFilters = {
        $or: [
          { users: { id: user.id } },
          { customer: { users: { id: user.id } } },
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
