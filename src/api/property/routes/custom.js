module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/properties/custom/count',
      handler: 'property.count',
      config: {
        // policies: ['global::isOwner'],
      },
    },
    {
      method: 'GET',
      path: '/properties/custom/locationScan',
      handler: 'property.locationScans',
      config: {
        // policies: ['global::isOwner'],
      },
    },
    {
      method: 'GET',
      path: '/properties/custom/customer/:id',
      handler: 'property.findByCustomer',
      config: {},
    },
  ],
};
