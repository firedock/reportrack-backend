'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    const cronEnabled = strapi.config.get('server.cron.enabled');
    console.log('=== Reportrack Configuration ===');
    console.log(`  Cron enabled: ${cronEnabled}`);
    console.log(`  SEND_EMAIL_ALERTS: ${process.env.SEND_EMAIL_ALERTS || 'NOT SET'}`);
    if (!cronEnabled) {
      console.warn('  WARNING: Cron is DISABLED - alarms will NOT trigger');
    }
    console.log('================================');
  },
};
