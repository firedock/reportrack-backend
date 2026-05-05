'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::escalation-config.escalation-config',
  ({ strapi }) => ({
    /**
     * Find the active escalation config that should govern auto-escalation
     * for a given alarm-notification. Strategy:
     *   1. account-scoped active config matching the notification's account
     *   2. any active config (first one found)
     *   3. null  → caller falls back to default 60min Subscriber-broadcast
     */
    async findApplicable({ accountId }) {
      if (accountId) {
        const scoped = await strapi.db
          .query('api::escalation-config.escalation-config')
          .findOne({
            where: { active: true, account: accountId },
            populate: ['account', 'targetUsers'],
          });
        if (scoped) return scoped;
      }
      const anyActive = await strapi.db
        .query('api::escalation-config.escalation-config')
        .findOne({
          where: { active: true },
          populate: ['account', 'targetUsers'],
        });
      return anyActive || null;
    },
  })
);
