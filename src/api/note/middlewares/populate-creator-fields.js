'use strict';

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Always ensure createdByUser is populated
    if (!ctx.query.populate) {
      ctx.query.populate = ['createdByUser'];
    } else if (typeof ctx.query.populate === 'string') {
      ctx.query.populate = ctx.query.populate + ',createdByUser';
    } else if (Array.isArray(ctx.query.populate) && !ctx.query.populate.includes('createdByUser')) {
      ctx.query.populate.push('createdByUser');
    }
    await next();
  };
};