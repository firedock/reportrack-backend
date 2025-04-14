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
    {
      method: 'GET',
      path: '/customers/custom/customer-users-without-properties',
      handler: 'customer.getCustomerUsersWithoutProperties',
      config: {},
    },
    {
      method: 'GET',
      path: '/customers/custom/customers-without-properties',
      handler: 'customer.getCustomersWithoutProperties',
      config: {},
    },
  ],
};
