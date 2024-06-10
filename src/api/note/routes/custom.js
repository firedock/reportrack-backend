module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/note/custom',
      handler: 'note.customAction',
      config: {
        auth: false,
      },
    },
  ],
};
