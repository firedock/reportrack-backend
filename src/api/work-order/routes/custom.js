module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/work-orders/custom/count',
      handler: 'work-order.count',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/work-orders/custom/find',
      handler: 'work-order.find',
      config: {
        auth: false,
      },
    },
  ],
};
