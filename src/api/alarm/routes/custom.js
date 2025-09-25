module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/alarms/custom/count',
      handler: 'alarm.count',
      config: {},
    },
    {
      method: 'POST',
      path: '/alarms/custom/count-post',
      handler: 'alarm.countPost',
      config: {},
    },
    {
      method: 'GET',
      path: '/alarms/custom/alarms', // Path for getting all alarms
      handler: 'alarm.getAllAlarms', // Controller method to handle this request
      config: {},
    },
    {
      method: 'POST',
      path: '/alarms/custom/alarms',
      handler: 'api::alarm.alarm.create', // default controller
      config: {},
    },
    {
      method: 'DELETE',
      path: '/alarms/custom/alarms/:id',
      handler: 'api::alarm.alarm.delete', // default controller
      config: {},
    },
    {
      method: 'PUT',
      path: '/alarms/custom/alarms/:id',
      handler: 'api::alarm.alarm.update', // default controller
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
        auth: false, // Allow cron jobs to trigger without authentication
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
