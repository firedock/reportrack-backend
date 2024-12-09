module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/alarms/custom/count',
      handler: 'alarm.count',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/alarms/custom/alarms', // Path for getting all alarms
      handler: 'alarm.getAllAlarms', // Controller method to handle this request
      config: {
        auth: false, // Require authentication if needed
      },
    },
    {
      method: 'POST',
      path: '/alarms/trigger',
      handler: 'alarm.triggerAlarms',
      config: {
        auth: false, // Set to true if you want this endpoint to require authentication
      },
    },
    {
      method: 'POST',
      path: '/alarms/reset-notifications',
      handler: 'alarm.resetNotifications',
      config: {
        auth: false, // Require authentication for this endpoint
      },
    },
  ],
};
