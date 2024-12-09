// @ts-nocheck
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc'); // Use CommonJS for imports
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

module.exports = createCoreService('api::alarm.alarm', ({ strapi }) => ({
  async checkAlarms() {
    const logs = []; // Array to collect log messages

    try {
      logs.push(`[${dayjs().format()}] Starting alarm checks...`);

      const alarms = await strapi.db.query('api::alarm.alarm').findMany({
        where: { active: true },
        populate: { property: true, customer: true },
      });

      const currentTimeUTC = dayjs.utc();
      logs.push(
        `[${currentTimeUTC.format()}] Fetched ${alarms.length} active alarms.`
      );

      for (const alarm of alarms) {
        const {
          id,
          startTime,
          endTime,
          startTimeDelay = 15,
          endTimeDelay = 15,
          timezone = 'UTC',
          startAlarmDisabled,
          endAlarmDisabled,
          notified,
        } = alarm;

        // Get the current time in the alarm's timezone
        const currentTimeInTimezone = currentTimeUTC.tz(timezone);
        logs.push(
          `----------------------------------------------------------------------------------------`
        );
        logs.push(
          `- Current time in alarm timezone (${timezone}): ${currentTimeInTimezone.format()}`
        );

        // Calculate trigger times based on the current local date in the alarm's timezone
        const startTriggerTime = dayjs
          .tz(
            `${currentTimeInTimezone.format('YYYY-MM-DD')}T${startTime}`,
            timezone
          )
          .add(startTimeDelay, 'minute');
        const endTriggerTime = dayjs
          .tz(
            `${currentTimeInTimezone.format('YYYY-MM-DD')}T${endTime}`,
            timezone
          )
          .add(endTimeDelay, 'minute');

        logs.push(
          `- Start trigger time (${timezone}): ${startTriggerTime.format()}`
        );
        logs.push(
          `- End trigger time (${timezone}): ${endTriggerTime.format()}`
        );

        const hasBeenNotifiedToday =
          notified && dayjs(notified).isSame(currentTimeInTimezone, 'day');

        logs.push(`- Alarm already notified today: ${hasBeenNotifiedToday}`);

        // Check Start Alarm
        if (
          currentTimeInTimezone.isAfter(startTriggerTime) &&
          !startAlarmDisabled &&
          !hasBeenNotifiedToday
        ) {
          logs.push(`- Conditions met for start alarm. Triggering now...`);
          await this.triggerAlarm(alarm, 'start');
          logs.push(`- Start alarm triggered successfully for Alarm ID ${id}.`);
        } else {
          logs.push(
            `- Start alarm not triggered. Conditions: currentTimeInTimezone.isAfter(startTriggerTime) = ${currentTimeInTimezone.isAfter(
              startTriggerTime
            )}, startAlarmDisabled = ${startAlarmDisabled}, hasBeenNotifiedToday = ${hasBeenNotifiedToday}`
          );
        }

        // Check End Alarm
        if (
          currentTimeInTimezone.isAfter(endTriggerTime) &&
          !endAlarmDisabled &&
          !hasBeenNotifiedToday
        ) {
          logs.push(`- Conditions met for end alarm. Triggering now...`);
          await this.triggerAlarm(alarm, 'end');
          logs.push(`- End alarm triggered successfully for Alarm ID ${id}.`);
        } else {
          logs.push(
            `- End alarm not triggered. Conditions: currentTimeInTimezone.isAfter(endTriggerTime) = ${currentTimeInTimezone.isAfter(
              endTriggerTime
            )}, endAlarmDisabled = ${endAlarmDisabled}, hasBeenNotifiedToday = ${hasBeenNotifiedToday}`
          );
        }
      }

      logs.push(`[${dayjs().format()}] Finished processing alarms.`);
    } catch (error) {
      logs.push(
        `[${dayjs().format()}] Error checking alarms: ${error.message}`
      );
      console.error(error);
    }

    return logs;
  },
  async triggerAlarm(alarm, type) {
    try {
      const { property, customer } = alarm;

      if (!property) {
        console.error(`Cannot trigger alarm ID ${alarm.id}: Missing property.`);
        return;
      }

      // Fetch users associated with the property
      const users = await strapi.db
        .query('plugin::users-permissions.user')
        .findMany({
          where: { properties: property.id },
        });

      // Send notification to all property users
      for (const user of users) {
        console.log('email user', user);
        // Uncomment the email logic once ready
        // await strapi.plugins['email'].services.email.send({
        //   to: user.email,
        //   subject: `Alarm ${type} Notification for ${property.name}`,
        //   text: `The ${type} alarm for property "${property.name}" (Customer: ${
        //     customer?.name || 'N/A'
        //   }) has been triggered.`,
        // });
      }

      // Update the notified field with the current timestamp
      await strapi.db.query('api::alarm.alarm').update({
        where: { id: alarm.id },
        data: { notified: dayjs.utc().toISOString() },
      });
    } catch (error) {
      console.error(`Error triggering ${type} alarm:`, error);
    }
  },
}));
