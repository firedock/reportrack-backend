'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

module.exports = createCoreController('api::email-log.email-log', ({ strapi }) => ({
  async getTodaysLogs(ctx) {
    try {
      const { timezone } = ctx.query;
      const userTimezone = Array.isArray(timezone) ? timezone[0] : (timezone || 'America/Los_Angeles');
      
      // Get start and end of today in user's timezone
      const todayStart = dayjs().tz(userTimezone).startOf('day').utc().toISOString();
      const todayEnd = dayjs().tz(userTimezone).endOf('day').utc().toISOString();
      
      // Debug logging
      console.log('Querying email logs for timezone:', userTimezone);
      console.log('Date range:', { todayStart, todayEnd });
      
      const logs = await strapi.db.query('api::email-log.email-log').findMany({
        where: {
          sentAt: {
            $gte: todayStart,
            $lte: todayEnd,
          },
        },
        orderBy: { sentAt: 'desc' },
      });
      
      console.log('Found', logs.length, 'email logs');
      
      // Format logs for display
      const formattedLogs = logs.map(log => ({
        ...log,
        sentAtFormatted: log.sentAt ? dayjs(log.sentAt).tz(userTimezone).format('MM/DD/YYYY h:mm:ss A') : '',
        deliveryTimeFormatted: log.deliveryTime ? `${log.deliveryTime}ms` : '',
      }));
      
      // Calculate statistics
      const stats = {
        total: logs.length,
        successful: logs.filter(l => l.status === 'success').length,
        failed: logs.filter(l => l.status === 'failed').length,
        byTrigger: {},
      };
      
      // Count by trigger type
      logs.forEach(log => {
        if (!stats.byTrigger[log.trigger]) {
          stats.byTrigger[log.trigger] = { total: 0, success: 0, failed: 0 };
        }
        stats.byTrigger[log.trigger].total++;
        if (log.status === 'success') {
          stats.byTrigger[log.trigger].success++;
        } else {
          stats.byTrigger[log.trigger].failed++;
        }
      });
      
      return ctx.send({
        data: formattedLogs,
        meta: {
          stats,
          timezone: userTimezone,
          date: dayjs().tz(userTimezone).format('MM/DD/YYYY'),
        },
      });
    } catch (error) {
      console.error('Error fetching email logs:', error);
      return ctx.badRequest('Error fetching email logs');
    }
  },
}));