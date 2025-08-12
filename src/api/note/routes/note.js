'use strict';

/**
 * note router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::note.note', {
  config: {
    find: {
      middlewares: ['api::note.populate-creator-fields'],
    },
    findOne: {
      middlewares: ['api::note.populate-creator-fields'],
    },
  },
});
