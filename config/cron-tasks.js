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
};
