'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/client-changes/:id/view',
      handler: 'client-change.markViewed',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/client-changes/count',
      handler: 'client-change.count',
      config: { policies: [], middlewares: [] },
    },
  ],
};
