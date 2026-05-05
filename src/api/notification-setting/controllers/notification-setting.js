// @ts-nocheck
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const ALLOWED_ROLES = ['Subscriber'];

const errorResponse = (ctx, status, message) => {
  ctx.status = status;
  ctx.body = { error: { status, message } };
  return ctx.body;
};

module.exports = createCoreController(
  'api::notification-setting.notification-setting',
  ({ strapi }) => ({
    async find(ctx) {
      const role = ctx.state.user?.role?.name;
      if (!ALLOWED_ROLES.includes(role)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }
      // Ensure singleton exists before returning it.
      await strapi
        .service('api::notification-setting.notification-setting')
        .ensureSingleton();
      return super.find(ctx);
    },

    async update(ctx) {
      const role = ctx.state.user?.role?.name;
      if (!ALLOWED_ROLES.includes(role)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }
      const incoming = ctx.request.body?.data || ctx.request.body || {};
      // Whitelist allowed fields — never let callers set other attributes
      const data = {};
      if (typeof incoming.emailsEnabled === 'boolean') {
        data.emailsEnabled = incoming.emailsEnabled;
      }
      ctx.request.body = { data };
      return super.update(ctx);
    },

    async delete(ctx) {
      return errorResponse(
        ctx,
        403,
        'Notification settings cannot be deleted.'
      );
    },
  })
);
