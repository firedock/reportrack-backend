'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/alarm-notifications/:id/excuse',
      handler: 'alarm-notification.excuse',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/alarm-notifications/:id/escalate',
      handler: 'alarm-notification.escalate',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/alarm-notifications/:id/in-progress',
      handler: 'alarm-notification.markInProgress',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/alarm-notifications/count',
      handler: 'alarm-notification.count',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/alarm-notifications/run-sla-check',
      handler: 'alarm-notification.runSlaCheck',
      config: { policies: [], middlewares: [] },
    },
  ],
};
