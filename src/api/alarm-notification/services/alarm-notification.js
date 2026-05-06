'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');
const { sendNotificationEmail } = require('../../../utils/sendNotificationEmail');

// Process-local guard to prevent two SLA checks running concurrently. Without
// this the scheduled cron + a manual trigger (or two cron beats overlapping)
// can both escalate the same record, producing duplicate transitions and
// duplicate emails.
let slaCheckRunning = false;

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
     * SLA auto-escalation. Looks for Uncleared alarm-notifications whose age
     * has exceeded the applicable escalation-config's slaMinutes (or the
     * 60-minute default if no config), then auto-escalates them and dispatches
     * an email to the configured target (gated by the global toggle).
     *
     * Idempotent — already-escalated records are skipped.
     */
    async checkSLA() {
      if (slaCheckRunning) {
        strapi.log.info('[sla-cron] Already running — skipping this invocation');
        return { checked: 0, escalated: 0, skipped: 0, skippedReason: 'already_running' };
      }
      slaCheckRunning = true;
      try {
        return await this._runSlaCheck();
      } finally {
        slaCheckRunning = false;
      }
    },

    async _runSlaCheck() {
      const now = new Date();
      const uncleared = await strapi.db
        .query('api::alarm-notification.alarm-notification')
        .findMany({
          where: { status: 'Uncleared' },
          populate: {
            property: true,
            account: true,
            service_type: true,
            assignedSubscribers: true,
          },
        });

      const SYSTEM = { id: 0, name: 'System' };
      const summary = { checked: uncleared.length, escalated: 0, skipped: 0 };

      for (const notif of uncleared) {
        // Re-check status before mutating — another concurrent caller may have
        // moved this record to Escalated already.
        const fresh = await strapi.db
          .query('api::alarm-notification.alarm-notification')
          .findOne({ where: { id: notif.id }, select: ['id', 'status'] });
        if (fresh?.status !== 'Uncleared') {
          summary.skipped += 1;
          continue;
        }
        try {
          const ageMs = now - new Date(notif.triggeredAt).getTime();
          const config = await strapi
            .service('api::escalation-config.escalation-config')
            .findApplicable({ accountId: notif.account?.id });
          const slaMinutes = config?.slaMinutes ?? 60;
          if (ageMs < slaMinutes * 60 * 1000) {
            summary.skipped += 1;
            continue;
          }

          // Determine target
          let recipients = [];
          let escalatedTo = null;
          let escalatedToRole = null;
          if (config?.targetType === 'user' && (config.targetUsers || []).length) {
            const userIds = config.targetUsers.map((u) => u.id);
            const users = await strapi.db
              .query('plugin::users-permissions.user')
              .findMany({
                where: { id: { $in: userIds }, blocked: { $ne: true } },
                select: ['id', 'email', 'username', 'name'],
              });
            recipients = users.map((u) => u.email).filter(Boolean);
            escalatedTo = users[0]?.id || null;
          } else {
            const roleName = config?.targetRole || 'Subscriber';
            escalatedToRole = roleName;
            // Property-scoped: only the Subscribers assigned to this specific
            // alarm-notification, not every user with the role globally.
            // Fixes the 2026-05-06 incident where the SLA cron sent 180 emails
            // to all 20 Subscribers including non-associated admin/CFO accounts.
            recipients = (notif.assignedSubscribers || [])
              .filter((u) => !u.blocked && u.email)
              .map((u) => u.email);
          }

          const at = new Date().toISOString();
          await this.appendTransition(
            notif.id,
            {
              at,
              by: SYSTEM,
              action: 'Auto-Escalated (SLA breach)',
              toStatus: 'Escalated',
              fromStatus: 'Uncleared',
              escalationNotes: `SLA breach: ${slaMinutes} minutes elapsed without response.`,
              escalatedTo: escalatedTo
                ? {
                    id: escalatedTo,
                    name:
                      (config?.targetUsers || []).find((u) => u.id === escalatedTo)
                        ?.name || 'Target',
                  }
                : null,
              escalatedToRole,
              autoEscalated: true,
            },
            {
              status: 'Escalated',
              escalationNotes: `SLA breach: ${slaMinutes} minutes elapsed without response.`,
              escalatedTo,
              escalatedToRole,
              respondedAt: at,
              respondedBy: null,
              autoEscalated: true,
            }
          );

          await this.dispatchEmail({
            id: notif.id,
            recipients,
            subject: `Alarm auto-escalated: ${notif.property?.name || 'Property'}`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #722ed1;">Alarm Auto-Escalated</h2>
              <p>An alarm has exceeded its SLA threshold (${slaMinutes} min) without response and was auto-escalated by the system.</p>
              <p><strong>Property:</strong> ${notif.property?.name || '—'}</p>
              <p><strong>Service:</strong> ${notif.service_type?.service || '—'}</p>
              <p><strong>Triggered:</strong> ${new Date(notif.triggeredAt).toLocaleString()}</p>
              <p><strong>Reason(s):</strong> ${(notif.triggerReasons || []).join('<br/>')}</p>
              ${process.env.FRONTEND_URL ? `<p><a href="${process.env.FRONTEND_URL}/notifications" style="background:#1677ff;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;">View in Reportrack</a></p>` : ''}
            </div>`,
            trigger: 'alarm_escalation',
            triggerDetails: {
              alarmNotificationId: notif.id,
              autoEscalated: true,
              slaMinutes,
            },
          });

          summary.escalated += 1;
        } catch (err) {
          strapi.log.error(
            `[sla-cron] Error processing alarm-notification ${notif.id}: ${err.message}`
          );
        }
      }

      strapi.log.info(
        `[sla-cron] Checked ${summary.checked}, escalated ${summary.escalated}, skipped ${summary.skipped}`
      );
      return summary;
    },

    /**
     * Create ONE alarm-notification record per alarm trigger, linking all
     * Subscribers assigned to the alarm's property as assignedSubscribers
     * (many-to-many). The first Subscriber (lowest id) is marked as the
     * primarySubscriber for accountability — the rest can still view, action,
     * and receive emails.
     *
     * Updates by any assigned Subscriber are visible to all (single record,
     * single audit trail). This replaces the prior 1-record-per-Subscriber
     * fan-out, which created duplicate work and divergent audit trails.
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

      if (subscribers.length === 0) return [];

      const subscriberIds = subscribers.map((s) => s.id);
      const primary = subscribers[0];

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
            assignedSubscribers: subscriberIds,
            primarySubscriber: primary.id,
            service_type: alarm.service_type?.id || null,
            transitions: [],
          },
        }
      );
      return [record];
    },
  })
);
