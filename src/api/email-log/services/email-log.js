'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::email-log.email-log', ({ strapi }) => ({
  async logEmail({
    to,
    from = 'noreply@reportrack.com',
    subject,
    trigger,
    triggerDetails = {},
    status,
    error = null,
    deliveryTime = null,
    relatedEntity = null,
    relatedEntityId = null,
  }) {
    try {
      const log = await strapi.entityService.create('api::email-log.email-log', {
        data: {
          to,
          from,
          subject,
          trigger,
          triggerDetails,
          status,
          error,
          sentAt: new Date(),
          deliveryTime,
          relatedEntity,
          relatedEntityId,
        },
      });
      return log;
    } catch (err) {
      console.error('Failed to log email:', err);
      // Don't throw error to avoid breaking email sending
      return null;
    }
  },
}));