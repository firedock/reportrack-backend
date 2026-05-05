'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::client-change.client-change',
  ({ strapi }) => ({
    /**
     * Create a client-change audit record. Called from service-record and
     * work-order lifecycle hooks when the editor's role is Customer.
     */
    async record({
      changeType,
      entityType,
      entityId,
      changeDetails = {},
      property,
      customer,
      account,
      changedByUser,
    }) {
      try {
        return await strapi.entityService.create(
          'api::client-change.client-change',
          {
            data: {
              changeType,
              entityType,
              entityId,
              changeDetails,
              changedAt: new Date().toISOString(),
              status: 'Unread',
              property: property || null,
              customer: customer || null,
              account: account || null,
              changedByUser: changedByUser || null,
            },
          }
        );
      } catch (err) {
        strapi.log.error(
          `[client-change] failed to record ${entityType}#${entityId}: ${err.message}`
        );
        return null;
      }
    },
  })
);
