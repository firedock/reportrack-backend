'use strict';

/**
 * service-record service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::service-record.service-record');
