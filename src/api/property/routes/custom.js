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
  ],
};
