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
      logs.push(`[${dayjs().utc().toISOString()}] Starting alarm checks...`);

      // Fetch active alarms with related properties and customers
      const alarms = await strapi.db.query('api::alarm.alarm').findMany({
        where: { active: true },
        populate: { property: true, customer: true },
      });

      logs.push(
        `[${dayjs().utc().toISOString()}] Fetched ${
          alarms.length
        } active alarms.`
      );

      const currentTimeUtc = dayjs.utc();

      for (const alarm of alarms) {
        const {
          id,
          startTime,
          endTime,
          startTimeDelay = 10,
          endTimeDelay = 10,
          timezone: alarmTimezone = 'UTC',
          daysOfWeek,
        } = alarm;

        logs.push(
          `----------------------------------------------------------------------------------------`
        );

        const currentTimeInTimezone = currentTimeUtc.tz(alarmTimezone);
        const currentDay = currentTimeInTimezone.format('dddd');

        logs.push(
          `- Alarm ID ${id}: Current time in alarm timezone (${alarmTimezone}): ${currentTimeInTimezone.format()}`
        );
        logs.push(`- Days configured for alarm: ${daysOfWeek.join(', ')}`);
        logs.push(`- Current day: ${currentDay}`);

        // Skip alarm if it's not scheduled for the current day
        if (!daysOfWeek.includes(currentDay)) {
          logs.push(
            `- Skipping alarm ID ${id}: Not configured for today (${currentDay}).`
          );
          continue;
        }

        let startTriggerTime, endTriggerTime;

        // Parse and calculate start trigger time in the alarm's timezone
        logs.push(`- Raw startTime: ${startTime}`);
        if (startTime && /^\d{2}:\d{2}:\d{2}$/.test(startTime)) {
          startTriggerTime = currentTimeInTimezone
            .startOf('day')
            .set('hour', parseInt(startTime.split(':')[0], 10))
            .set('minute', parseInt(startTime.split(':')[1], 10))
            .set('second', parseInt(startTime.split(':')[2], 10))
            .add(startTimeDelay, 'minute');
        } else {
          logs.push(`- Invalid startTime: ${startTime}`);
        }

        // Parse and calculate end trigger time in the alarm's timezone
        logs.push(`- Raw endTime: ${endTime}`);
        if (endTime && /^\d{2}:\d{2}:\d{2}$/.test(endTime)) {
          endTriggerTime = currentTimeInTimezone
            .startOf('day')
            .set('hour', parseInt(endTime.split(':')[0], 10))
            .set('minute', parseInt(endTime.split(':')[1], 10))
            .set('second', parseInt(endTime.split(':')[2], 10))
            .add(endTimeDelay, 'minute');
        } else {
          logs.push(`- Invalid endTime: ${endTime}`);
        }

        logs.push(
          `- Start trigger time (${alarmTimezone}): ${
            startTriggerTime ? startTriggerTime.format() : 'Invalid Date'
          }`
        );
        logs.push(
          `- End trigger time (${alarmTimezone}): ${
            endTriggerTime ? endTriggerTime.format() : 'Invalid Date'
          }`
        );

        // Skip alarm if trigger times are invalid
        if (!startTriggerTime || !endTriggerTime) {
          logs.push(`- Skipping alarm ID ${id}: Invalid trigger times.`);
          continue;
        }

        // Check notification and trigger conditions
        const hasBeenNotifiedToday =
          alarm.notified &&
          dayjs(alarm.notified).isSame(currentTimeInTimezone, 'day');

        logs.push(`- Alarm already notified today: ${hasBeenNotifiedToday}`);

        if (
          currentTimeInTimezone.isAfter(startTriggerTime) &&
          !alarm.startAlarmDisabled &&
          !hasBeenNotifiedToday
        ) {
          logs.push(`- Conditions met for start alarm. Triggering now...`);
          await strapi.service('api::alarm.alarm').triggerAlarm(alarm, 'start');
          logs.push(`- Start alarm triggered successfully for Alarm ID ${id}.`);
        } else {
          logs.push(`- Start alarm not triggered.`);
        }

        if (
          currentTimeInTimezone.isAfter(endTriggerTime) &&
          !alarm.endAlarmDisabled &&
          !hasBeenNotifiedToday
        ) {
          logs.push(`- Conditions met for end alarm. Triggering now...`);
          await strapi.service('api::alarm.alarm').triggerAlarm(alarm, 'end');
          logs.push(`- End alarm triggered successfully for Alarm ID ${id}.`);
        } else {
          logs.push(`- End alarm not triggered.`);
        }
      }

      logs.push(`[${dayjs().utc().toISOString()}] Finished processing alarms.`);
    } catch (error) {
      logs.push(
        `[${dayjs().utc().toISOString()}] Error checking alarms: ${
          error.message
        }`
      );
      console.error(error);
    }

    return logs; // Return logs for debugging
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
