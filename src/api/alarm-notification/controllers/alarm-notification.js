// @ts-nocheck
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { sendNotificationEmail } = require('../../../utils/sendNotificationEmail');

const escalationEmailHtml = ({
  fromUser,
  notification,
  escalationNotes,
  appUrl,
}) => `
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2 style="color: #722ed1;">Alarm Escalated</h2>
  <p>${fromUser?.name || fromUser?.username || 'A Subscriber'} has escalated an alarm to you for review.</p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td><strong>Property</strong></td><td>${notification.property?.name || '—'}</td></tr>
    <tr><td><strong>Service</strong></td><td>${notification.service_type?.service || '—'}</td></tr>
    <tr><td><strong>Triggered</strong></td><td>${new Date(notification.triggeredAt).toLocaleString()}</td></tr>
    <tr><td><strong>Service Person</strong></td><td>${notification.employeeName || '—'}</td></tr>
    <tr><td><strong>Reason(s)</strong></td><td>${(notification.triggerReasons || []).join('<br/>')}</td></tr>
  </table>
  <p><strong>Escalation Notes:</strong></p>
  <blockquote style="border-left: 3px solid #722ed1; padding-left: 12px; color: #555;">
    ${(escalationNotes || '').replace(/\n/g, '<br/>')}
  </blockquote>
  ${appUrl ? `<p><a href="${appUrl}/notifications" style="background:#1677ff;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;">View in Reportrack</a></p>` : ''}
</div>
`;

const RESPONDED_POPULATE = {
  property: true,
  customer: true,
  account: true,
  alarm: true,
  service_type: true,
  assignedSubscriber: { fields: ['id', 'username', 'name'] },
  respondedBy: { fields: ['id', 'username', 'name'] },
  escalatedTo: { fields: ['id', 'username', 'name'] },
};

const ROLE_NAMES_FOR_DEFAULT_ACCESS = ['Subscriber'];

const errorResponse = (ctx, status, message) => {
  ctx.status = status;
  ctx.body = { error: { status, message } };
  return ctx.body;
};

module.exports = createCoreController(
  'api::alarm-notification.alarm-notification',
  ({ strapi }) => ({
    async find(ctx) {
      const user = ctx.state.user;
      const role = user?.role?.name;
      if (!ROLE_NAMES_FOR_DEFAULT_ACCESS.includes(role)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }
      ctx.query = {
        ...ctx.query,
        populate: { ...(ctx.query.populate || {}), ...RESPONDED_POPULATE },
      };
      const { data, meta } = await super.find(ctx);
      return { data, meta };
    },

    async findOne(ctx) {
      const user = ctx.state.user;
      const role = user?.role?.name;
      if (!ROLE_NAMES_FOR_DEFAULT_ACCESS.includes(role)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }
      ctx.query = {
        ...ctx.query,
        populate: { ...(ctx.query.populate || {}), ...RESPONDED_POPULATE },
      };
      return super.findOne(ctx);
    },

    /** Always blocked — alarm-notifications are an append-only audit record. */
    async delete(ctx) {
      return errorResponse(
        ctx,
        403,
        'Alarm notifications cannot be deleted (append-only audit record).'
      );
    },

    async count(ctx) {
      const user = ctx.state.user;
      if (!ROLE_NAMES_FOR_DEFAULT_ACCESS.includes(user?.role?.name)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }
      const { filters = {} } = ctx.query || {};
      const where = strapi.entityService.uploadFiles
        ? filters
        : filters; // pass through; entityService handles filter format
      const total = await strapi.db
        .query('api::alarm-notification.alarm-notification')
        .count({ where: filters });
      return { count: total };
    },

    async excuse(ctx) {
      const { id } = ctx.params;
      const user = ctx.state.user;
      if (!ROLE_NAMES_FOR_DEFAULT_ACCESS.includes(user?.role?.name)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }
      const { excuseReason, notes } = ctx.request.body?.data || ctx.request.body || {};
      if (!excuseReason || !notes || String(notes).trim().length < 5) {
        return errorResponse(
          ctx,
          400,
          'excuseReason and notes (min 5 chars) are required'
        );
      }

      const at = new Date().toISOString();
      const updated = await strapi
        .service('api::alarm-notification.alarm-notification')
        .appendTransition(
          id,
          {
            at,
            by: { id: user.id, name: user.name || user.username },
            action: 'Excused',
            toStatus: 'Excused',
            excuseReason,
            notes,
          },
          {
            status: 'Excused',
            excuseReason,
            notes,
            respondedAt: at,
            respondedBy: user.id,
          }
        );
      return { data: updated };
    },

    async escalate(ctx) {
      const { id } = ctx.params;
      const user = ctx.state.user;
      if (!ROLE_NAMES_FOR_DEFAULT_ACCESS.includes(user?.role?.name)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }
      const { escalationNotes, escalatedTo, escalatedToRole } =
        ctx.request.body?.data || ctx.request.body || {};
      if (!escalationNotes || String(escalationNotes).trim().length < 10) {
        return errorResponse(
          ctx,
          400,
          'escalationNotes (min 10 chars) is required'
        );
      }
      if (!escalatedTo && !escalatedToRole) {
        return errorResponse(
          ctx,
          400,
          'Must specify escalatedTo (user id) or escalatedToRole'
        );
      }

      const at = new Date().toISOString();
      let escalatedToRecord = null;
      if (escalatedTo) {
        escalatedToRecord = await strapi.entityService.findOne(
          'plugin::users-permissions.user',
          escalatedTo,
          { fields: ['id', 'username', 'name'] }
        );
      }

      const updated = await strapi
        .service('api::alarm-notification.alarm-notification')
        .appendTransition(
          id,
          {
            at,
            by: { id: user.id, name: user.name || user.username },
            action: 'Escalated',
            toStatus: 'Escalated',
            escalationNotes,
            escalatedTo: escalatedToRecord
              ? {
                  id: escalatedToRecord.id,
                  name:
                    escalatedToRecord.name || escalatedToRecord.username,
                }
              : null,
            escalatedToRole: escalatedToRole || null,
            autoEscalated: false,
          },
          {
            status: 'Escalated',
            escalationNotes,
            escalatedTo: escalatedTo || null,
            escalatedToRole: escalatedToRole || null,
            respondedAt: at,
            respondedBy: user.id,
            autoEscalated: false,
          }
        );

      // Best-effort email notification to escalation target. We never block the
      // status change on email failure — the audit record is the source of truth.
      try {
        const fullRecord = await strapi.entityService.findOne(
          'api::alarm-notification.alarm-notification',
          id,
          { populate: { property: true, service_type: true } }
        );
        let recipients = [];
        if (escalatedToRecord?.id) {
          const u = await strapi.entityService.findOne(
            'plugin::users-permissions.user',
            escalatedToRecord.id,
            { fields: ['email', 'username', 'name'] }
          );
          if (u?.email) recipients.push(u.email);
        } else if (escalatedToRole) {
          const usersInRole = await strapi.db
            .query('plugin::users-permissions.user')
            .findMany({
              where: { role: { name: escalatedToRole }, blocked: { $ne: true } },
              select: ['email', 'username'],
            });
          recipients = usersInRole.map((u) => u.email).filter(Boolean);
        }
        if (recipients.length) {
          await sendNotificationEmail({
            strapi,
            to: recipients,
            subject: `Alarm escalated: ${fullRecord.property?.name || 'Property'}`,
            html: escalationEmailHtml({
              fromUser: user,
              notification: fullRecord,
              escalationNotes,
              appUrl: process.env.FRONTEND_URL,
            }),
          });
          strapi.log.info(
            `[escalate] Email sent to ${recipients.length} recipient(s) for alarm-notification ${id}`
          );
        } else {
          strapi.log.warn(
            `[escalate] No email recipients resolved for alarm-notification ${id}`
          );
        }
      } catch (emailErr) {
        strapi.log.error(
          `[escalate] Email send failed for alarm-notification ${id}: ${emailErr.message}`
        );
      }

      return { data: updated };
    },

    async markInProgress(ctx) {
      const { id } = ctx.params;
      const user = ctx.state.user;
      if (!ROLE_NAMES_FOR_DEFAULT_ACCESS.includes(user?.role?.name)) {
        return errorResponse(ctx, 403, 'Forbidden');
      }

      const at = new Date().toISOString();
      const updated = await strapi
        .service('api::alarm-notification.alarm-notification')
        .appendTransition(
          id,
          {
            at,
            by: { id: user.id, name: user.name || user.username },
            action: 'Marked In Progress',
            toStatus: 'In Progress',
          },
          {
            status: 'In Progress',
            respondedAt: at,
            respondedBy: user.id,
          }
        );
      return { data: updated };
    },
  })
);
