'use strict';

/**
 * alarm service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::alarm.alarm');
