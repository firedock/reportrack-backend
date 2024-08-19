module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/properties/custom/count',
      handler: 'property.count',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/properties/custom/locationScan',
      handler: 'property.locationScans',
      config: {
        auth: false,
      },
    },
  ],
};
