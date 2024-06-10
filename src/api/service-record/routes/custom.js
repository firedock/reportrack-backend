module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/service-records/custom/count',
      handler: 'service-record.count',
      config: {
        auth: false,
      },
    },
  ],
};
