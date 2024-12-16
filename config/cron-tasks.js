const axios = require('axios');

module.exports = {
  // Cron job to trigger alarms every minute
  oneMinuteJob: {
    task: async ({ strapi }) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp}: Cron job executed every minute`);
      const alarmTriggerUrl = `${process.env.PUBLIC_URL}/api/alarms/trigger`;

      try {
        const response = await axios.post(
          alarmTriggerUrl,
          {}, // No payload
          {
            headers: {
              Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}`,
            },
          }
        );
        console.log('API response:', response.data);
      } catch (error) {
        console.error('Error triggering alarm API:', error.message);
        console.error('Full error details:', error.response?.data || error);
      }
    },
    options: {
      rule: '* * * * *', // Every minute
      tz: 'America/Los_Angeles', // Set timezone if needed
    },
  },
};
