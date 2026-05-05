'use strict';

const NOTIFICATION_PERMISSIONS = {
  Subscriber: [
    'api::alarm-notification.alarm-notification.find',
    'api::alarm-notification.alarm-notification.findOne',
    'api::alarm-notification.alarm-notification.excuse',
    'api::alarm-notification.alarm-notification.escalate',
    'api::alarm-notification.alarm-notification.markInProgress',
    'api::alarm-notification.alarm-notification.count',
    'api::alarm-notification.alarm-notification.runSlaCheck',
    'api::notification-setting.notification-setting.find',
    'api::notification-setting.notification-setting.update',
    'api::escalation-config.escalation-config.find',
    'api::escalation-config.escalation-config.findOne',
    'api::escalation-config.escalation-config.create',
    'api::escalation-config.escalation-config.update',
    'api::escalation-config.escalation-config.delete',
    'api::subscriber-coverage.subscriber-coverage.find',
    'api::subscriber-coverage.subscriber-coverage.findOne',
    'api::subscriber-coverage.subscriber-coverage.create',
    'api::subscriber-coverage.subscriber-coverage.update',
    'api::subscriber-coverage.subscriber-coverage.delete',
    'api::client-change.client-change.find',
    'api::client-change.client-change.findOne',
    'api::client-change.client-change.markViewed',
    'api::client-change.client-change.count',
  ],
};

async function seedNotificationPermissions(strapi) {
  for (const [roleName, actions] of Object.entries(NOTIFICATION_PERMISSIONS)) {
    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { name: roleName } });
    if (!role) {
      console.warn(`[notif-perms] Role "${roleName}" not found — skipping`);
      continue;
    }
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: role.id, action: { $in: actions } } });
    const existingActions = new Set(existing.map((p) => p.action));
    const toCreate = actions.filter((a) => !existingActions.has(a));
    for (const action of toCreate) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: role.id } });
      console.log(`[notif-perms] Granted ${action} → ${roleName}`);
    }
  }
}

module.exports = {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }) {
    const cronEnabled = strapi.config.get('server.cron.enabled');
    console.log('=== Reportrack Configuration ===');
    console.log(`  Cron enabled: ${cronEnabled}`);
    console.log(`  SEND_EMAIL_ALERTS: ${process.env.SEND_EMAIL_ALERTS || 'NOT SET'}`);
    if (!cronEnabled) {
      console.warn('  WARNING: Cron is DISABLED - alarms will NOT trigger');
    }
    console.log('================================');

    try {
      await seedNotificationPermissions(strapi);
    } catch (err) {
      console.error('[notif-perms] Failed to seed permissions:', err);
    }

    try {
      await strapi
        .service('api::notification-setting.notification-setting')
        .ensureSingleton();
    } catch (err) {
      console.error('[notification-setting] Failed to ensure singleton:', err);
    }
  },
};
