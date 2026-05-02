'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');

module.exports = createCoreService(
  'api::alarm-notification.alarm-notification',
  ({ strapi }) => ({
    /**
     * Append a new transition entry to an alarm-notification's `transitions`
     * JSON array, atomically with the status/field updates.
     */
    async appendTransition(id, transition, additionalChanges = {}) {
      const existing = await strapi.entityService.findOne(
        'api::alarm-notification.alarm-notification',
        id,
        { populate: { respondedBy: true, escalatedTo: true } }
      );
      if (!existing) {
        throw new Error(`alarm-notification ${id} not found`);
      }
      const transitions = Array.isArray(existing.transitions)
        ? existing.transitions
        : [];
      const stamped = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        at: transition.at || new Date().toISOString(),
        fromStatus: transition.fromStatus ?? existing.status,
        ...transition,
      };
      return strapi.entityService.update(
        'api::alarm-notification.alarm-notification',
        id,
        {
          data: {
            ...additionalChanges,
            transitions: [...transitions, stamped],
          },
        }
      );
    },

    /**
     * Create alarm-notification records for every Subscriber assigned to the
     * triggering alarm's property. Called from alarm.triggerAlarm().
     */
    async createOnTrigger({
      alarm,
      type,
      reasons,
      alarmStartTime,
      alarmEndTime,
      employeeName,
    }) {
      const subscribers = await strapi.db
        .query('plugin::users-permissions.user')
        .findMany({
          where: {
            properties: { id: alarm.property?.id },
            role: { name: 'Subscriber' },
            blocked: { $ne: true },
          },
          populate: ['role'],
        });

      const created = [];
      for (const subscriber of subscribers) {
        const record = await strapi.entityService.create(
          'api::alarm-notification.alarm-notification',
          {
            data: {
              status: 'Uncleared',
              triggeredAt: dayjs.utc().toISOString(),
              alarmType: type,
              triggerReasons: reasons,
              alarmStartTime,
              alarmEndTime,
              employeeName,
              alarm: alarm.id,
              property: alarm.property?.id || null,
              customer: alarm.customer?.id || null,
              account: alarm.account?.id || null,
              assignedSubscriber: subscriber.id,
              service_type: alarm.service_type?.id || null,
              transitions: [],
            },
          }
        );
        created.push(record);
      }
      return created;
    },
  })
);
