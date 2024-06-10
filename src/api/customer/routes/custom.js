module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/customers/custom/count',
      handler: 'customer.count',
      config: {
        auth: false,
      },
    },
  ],
};
