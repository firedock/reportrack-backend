module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/work-orders/custom/count',
      handler: 'work-order.count',
    },
    {
      method: 'POST',
      path: '/work-orders/custom/count-post',
      handler: 'work-order.countPost',
    },
    {
      method: 'GET',
      path: '/work-orders/custom/find',
      handler: 'work-order.find',
    },
  ],
};
