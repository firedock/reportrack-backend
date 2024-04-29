'use strict';

/**
 * alarm controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::alarm.alarm');
