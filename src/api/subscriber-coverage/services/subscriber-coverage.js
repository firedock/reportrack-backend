'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService(
  'api::subscriber-coverage.subscriber-coverage',
  ({ strapi }) => ({
    /**
     * True if `coveringUserId` has an active coverage window for `coveredUserId`
     * at the given timestamp. Used by the excuse flow to validate that a
     * Subscriber excusing another's alarm has authority via coverage.
     */
    async hasActiveCoverage({ coveringUserId, coveredUserId, at = new Date() }) {
      if (!coveringUserId || !coveredUserId) return false;
      if (coveringUserId === coveredUserId) return true;
      const match = await strapi.db
        .query('api::subscriber-coverage.subscriber-coverage')
        .findOne({
          where: {
            coveringSubscriber: coveringUserId,
            coveredSubscriber: coveredUserId,
            startDate: { $lte: at },
            endDate: { $gte: at },
          },
        });
      return Boolean(match);
    },
  })
);
