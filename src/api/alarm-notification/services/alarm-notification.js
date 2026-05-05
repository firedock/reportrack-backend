'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');
const { sendNotificationEmail } = require('../../../utils/sendNotificationEmail');

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
     * Send (or suppress) an email side-effect tied to an alarm-notification
     * action and append an audit transition recording what happened.
     *
     * The notification-setting.emailsEnabled toggle is the kill switch:
     *   true   → email is dispatched, transition action = 'Email Sent'
     *           (also written to api::email-log.email-log per recipient)
     *   false  → email is suppressed (no SMTP call), action = 'Email Suppressed'
     *   error  → caught and logged, action = 'Email Failed'
     */
    async dispatchEmail({ id, recipients, subject, html, trigger, triggerDetails }) {
      const at = new Date().toISOString();
      const SYSTEM = { id: 0, name: 'System' };
      const enabled = await strapi
        .service('api::notification-setting.notification-setting')
        .areEmailsEnabled();

      if (!recipients || recipients.length === 0) {
        await this.appendTransition(id, {
          at,
          by: SYSTEM,
          action: 'Email Suppressed',
          reason: 'No recipients resolved',
          subject,
          recipients: [],
        });
        return { sent: false, suppressed: true, reason: 'no recipients' };
      }

      if (!enabled) {
        await this.appendTransition(id, {
          at,
          by: SYSTEM,
          action: 'Email Suppressed',
          reason: 'Email sending is disabled in Notification Settings',
          subject,
          recipients,
        });
        strapi.log.info(
          `[notif-email] Suppressed for alarm-notification ${id} (recipients=${recipients.length})`
        );
        return { sent: false, suppressed: true };
      }

      const start = Date.now();
      try {
        await sendNotificationEmail({ strapi, to: recipients, subject, html });
        const deliveryTime = Date.now() - start;
        await this.appendTransition(id, {
          at,
          by: SYSTEM,
          action: 'Email Sent',
          subject,
          recipients,
          deliveryTime,
        });
        // Best-effort per-recipient email-log entries (if email-log service exists).
        try {
          for (const recipient of recipients) {
            await strapi.service('api::email-log.email-log').logEmail({
              to: recipient,
              subject,
              trigger: trigger || 'alarm_escalation',
              triggerDetails: triggerDetails || {},
              status: 'success',
              deliveryTime,
              relatedEntity: 'alarm-notification',
              relatedEntityId: Number(id),
            });
          }
        } catch (_logErr) {
          // never block on email-log failures
        }
        strapi.log.info(
          `[notif-email] Sent to ${recipients.length} recipient(s) for alarm-notification ${id}`
        );
        return { sent: true };
      } catch (err) {
        await this.appendTransition(id, {
          at,
          by: SYSTEM,
          action: 'Email Failed',
          subject,
          recipients,
          error: err.message,
        });
        try {
          for (const recipient of recipients) {
            await strapi.service('api::email-log.email-log').logEmail({
              to: recipient,
              subject,
              trigger: trigger || 'alarm_escalation',
              triggerDetails: triggerDetails || {},
              status: 'failed',
              error: err.message,
              relatedEntity: 'alarm-notification',
              relatedEntityId: Number(id),
            });
          }
        } catch (_logErr) {
          // never block on email-log failures
        }
        strapi.log.error(
          `[notif-email] Send failed for alarm-notification ${id}: ${err.message}`
        );
        return { sent: false, error: err.message };
      }
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
