module.exports = {
  // Cron job to check alarms every minute
  oneMinuteJob: {
    task: async ({ strapi }) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp}: Cron alarm check starting...`);
      try {
        const result = await strapi.service('api::alarm.alarm').checkAlarms();
        console.log(`${timestamp}: Alarm check complete. ${result.logs?.length || 0} log entries.`);
      } catch (error) {
        console.error(`${timestamp}: Error in alarm check cron:`, error.message);
      }
    },
    options: {
      rule: '* * * * *', // Every minute
      tz: 'America/Los_Angeles', // Set timezone if needed
    },
  },

  // SLA auto-escalation: every 5 minutes, auto-escalates Uncleared
  // alarm-notifications past their applicable escalation-config's slaMinutes.
  slaCheckJob: {
    task: async ({ strapi }) => {
      const ts = new Date().toISOString();
      try {
        const summary = await strapi
          .service('api::alarm-notification.alarm-notification')
          .checkSLA();
        console.log(`${ts}: SLA check complete.`, summary);
      } catch (err) {
        console.error(`${ts}: SLA check error:`, err.message);
      }
    },
    options: {
      rule: '*/5 * * * *',
      tz: 'America/Los_Angeles',
    },
  },
};
