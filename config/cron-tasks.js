module.exports = {
  // Existing job
  twoMinuteJob: {
    task: ({ strapi }) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp}: Cron job executed every 2 minutes`);
    },
    options: {
      rule: '*/2 * * * *',
      tz: 'America/Los_Angeles',
    },
  },

  // New job that runs every minute
  oneMinuteJob: {
    task: ({ strapi }) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp}: Cron job executed every minute`);
    },
    options: {
      rule: '* * * * *', // Every minute
      // Optionally, you can set a timezone as well
      // tz: 'Your_Timezone',
    },
  },
};
