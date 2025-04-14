module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/alarms/custom/count',
      handler: 'alarm.count',
      config: {},
    },
    {
      method: 'GET',
      path: '/alarms/custom/alarms', // Path for getting all alarms
      handler: 'alarm.getAllAlarms', // Controller method to handle this request
      config: {},
    },
    {
      method: 'GET',
      path: '/alarms/custom/alarms-without-users',
      handler: 'alarm.getAlarmsWithoutUsers',
      config: {},
    },
    {
      method: 'POST',
      path: '/alarms/trigger',
      handler: 'alarm.triggerAlarms',
      config: {
        auth: {
          // Enable authentication
          scope: ['authenticated'], // Optionally specify roles or permissions
        },
      },
    },
    {
      method: 'POST',
      path: '/alarms/reset-notifications',
      handler: 'alarm.resetNotifications',
      config: {},
    },
  ],
};
