module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/service-records/custom/count',
      handler: 'service-record.count',
      config: {
        // policies: ['global::isOwner'],
      },
    },
    {
      method: 'GET',
      path: '/service-records/:id',
      handler: 'service-record.findOne',
      config: {
        // policies: ['global::isOwner'],
      },
    },
  ],
};
