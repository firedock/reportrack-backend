'use strict';

/**
 * work-order controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::work-order.work-order');
