module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/alarm-logs/latest',
      handler: 'alarm-log.latest',
      config: {
        policies: [],
        auth: false,
      },
    },
  ],
};
