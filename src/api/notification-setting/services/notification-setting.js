'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::notification-setting.notification-setting',
  ({ strapi }) => ({
    /**
     * Read the current value of `emailsEnabled`. Defaults to `false` if the
     * singleton row hasn't been created yet (safe default — no surprise sends).
     */
    async areEmailsEnabled() {
      try {
        const setting = await strapi.entityService.findMany(
          'api::notification-setting.notification-setting'
        );
        return Boolean(setting?.emailsEnabled);
      } catch (e) {
        strapi.log.warn(
          `[notification-setting] Failed to read setting, defaulting to disabled: ${e.message}`
        );
        return false;
      }
    },

    /** Idempotent: ensure the singleton row exists with default values. */
    async ensureSingleton() {
      const existing = await strapi.entityService.findMany(
        'api::notification-setting.notification-setting'
      );
      if (!existing) {
        await strapi.entityService.create(
          'api::notification-setting.notification-setting',
          { data: { emailsEnabled: false } }
        );
        strapi.log.info('[notification-setting] Created default singleton');
      }
    },
  })
);
