'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::alarm-log.alarm-log',
  ({ strapi }) => ({
    async latest(ctx) {
      const latest = await strapi.entityService.findMany(
        'api::alarm-log.alarm-log',
        {
          sort: { runAt: 'desc' },
          limit: 1,
        }
      );

      return ctx.send(latest[0] || {});
    },
  })
);
