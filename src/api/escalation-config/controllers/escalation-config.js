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

module.exports = createCoreController(
  'api::escalation-config.escalation-config',
  ({ strapi }) => ({
    async find(ctx) {
      if (!requireRole(ctx)) return ctx.body;
      ctx.query = {
        ...ctx.query,
        populate: { ...(ctx.query.populate || {}), targetUsers: { fields: ['id', 'username', 'name'] }, account: true },
      };
      return super.find(ctx);
    },
    async findOne(ctx) {
      if (!requireRole(ctx)) return ctx.body;
      ctx.query = {
        ...ctx.query,
        populate: { ...(ctx.query.populate || {}), targetUsers: { fields: ['id', 'username', 'name'] }, account: true },
      };
      return super.findOne(ctx);
    },
    async create(ctx) {
      if (!requireRole(ctx)) return ctx.body;
      return super.create(ctx);
    },
    async update(ctx) {
      if (!requireRole(ctx)) return ctx.body;
      return super.update(ctx);
    },
    async delete(ctx) {
      if (!requireRole(ctx)) return ctx.body;
      return super.delete(ctx);
    },
  })
);
