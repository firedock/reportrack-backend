module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/email-logs/today',
      handler: 'email-log.getTodaysLogs',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};