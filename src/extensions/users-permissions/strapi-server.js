const { sanitize } = require('@strapi/utils');

module.exports = (plugin) => {
  plugin.controllers.user.find = async (ctx) => {
    const { page = 1, pageSize = 25 } = ctx.query.pagination || {};
    const { sort, filters } = ctx.query || {};

    // Construct the query options
    const queryOptions = {
      limit: parseInt(pageSize, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
      orderBy: sort ? { [sort.split(':')[0]]: sort.split(':')[1] } : {},
      where: filters || {},
      populate: ['role'],
    };

    // Fetch users with pagination, sorting, and filtering
    const users = await strapi
      .query('plugin::users-permissions.user')
      .findMany(queryOptions);

    // Fetch total count of users
    const totalUsers = await strapi
      .query('plugin::users-permissions.user')
      .count(queryOptions.where);

    // Calculate pagination details
    const pageCount = Math.ceil(totalUsers / parseInt(pageSize, 10));

    // Sanitize user data and transform format
    const sanitizedUsers = await Promise.all(
      users.map(async (user) => {
        const sanitizedUser = await sanitize.contentAPI.output(
          user,
          strapi.getModel('plugin::users-permissions.user')
        );
        return {
          id: sanitizedUser.id,
          attributes: {
            username: sanitizedUser.username,
            email: sanitizedUser.email,
            provider: sanitizedUser.provider,
            confirmed: sanitizedUser.confirmed,
            blocked: sanitizedUser.blocked,
            createdAt: sanitizedUser.createdAt,
            updatedAt: sanitizedUser.updatedAt,
            name: sanitizedUser.name,
            role: sanitizedUser.role, // Include role if needed
          },
        };
      })
    );

    // Prepare the response
    const response = {
      data: sanitizedUsers,
      meta: {
        pagination: {
          page: parseInt(page, 10),
          pageSize: parseInt(pageSize, 10),
          pageCount,
          total: totalUsers,
        },
      },
    };

    // Send the response
    ctx.send(response);
  };

  return plugin;
};
