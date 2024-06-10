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
  ],
};
