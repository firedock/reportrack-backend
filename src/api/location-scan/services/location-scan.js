'use strict';

/**
 * location-scan service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::location-scan.location-scan');
