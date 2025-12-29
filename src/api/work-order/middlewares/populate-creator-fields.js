'use strict';

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    if (!ctx.query.populate) {
      // Populate 'author' (the user who created the work order)
      // Note: createdBy/updatedBy are admin users, author is the regular user
      ctx.query.populate = ['author'];
    }
    await next();
  };
};
