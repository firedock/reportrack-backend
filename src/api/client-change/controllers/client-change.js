// @ts-nocheck
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const ALLOWED_ROLES = ['Subscriber'];

const errorResponse = (ctx, status, message) => {
  ctx.status = status;
  ctx.body = { error: { status, message } };
  return ctx.body;
};

const requireRole = (ctx) => {
  const role = ctx.state.user?.role?.name;
  if (!ALLOWED_ROLES.includes(role)) {
    errorResponse(ctx, 403, 'Forbidden');
    return false;
  }
  return true;
};

const POPULATE = {
  property: true,
  customer: true,
  account: true,
  changedByUser: { fields: ['id', 'username', 'name'] },
  viewedBy: { fields: ['id', 'username', 'name'] },
};

module.exports = createCoreController(
  'api::client-change.client-change',
  ({ strapi }) => ({
    async find(ctx) {
      if (!requireRole(ctx)) return ctx.body;
      ctx.query = {
        ...ctx.query,
        populate: { ...(ctx.query.populate || {}), ...POPULATE },
      };
      return super.find(ctx);
    },

    async findOne(ctx) {
      if (ctx.params.id === 'count') {
        return this.count(ctx);
      }
      if (!requireRole(ctx)) return ctx.body;
      ctx.query = {
        ...ctx.query,
        populate: { ...(ctx.query.populate || {}), ...POPULATE },
      };
      return super.findOne(ctx);
    },

    /** Audit record — never delete. */
    async delete(ctx) {
      return errorResponse(ctx, 403, 'Client changes cannot be deleted.');
    },

    async count(ctx) {
      if (!requireRole(ctx)) return ctx.body;
      const { filters = {} } = ctx.query || {};
      const total = await strapi.db
        .query('api::client-change.client-change')
        .count({ where: filters });
      return { count: total };
    },

    async markViewed(ctx) {
      const { id } = ctx.params;
      if (!requireRole(ctx)) return ctx.body;
      const user = ctx.state.user;
      const updated = await strapi.entityService.update(
        'api::client-change.client-change',
        id,
        {
          data: {
            status: 'Viewed',
            viewedBy: user.id,
            viewedAt: new Date().toISOString(),
          },
          populate: POPULATE,
        }
      );
      return { data: updated };
    },
  })
);
