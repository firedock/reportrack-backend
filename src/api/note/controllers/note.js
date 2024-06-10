'use strict';

/**
 * note controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::note.note', ({ strapi }) => ({
  // custom action
  async customAction(ctx) {
    try {
      ctx.body = 'note.customAction';
    } catch (error) {
      ctx.body = error;
    }
  },
}));
