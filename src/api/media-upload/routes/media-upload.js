module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/media-upload',
      handler: 'media-upload.upload',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};