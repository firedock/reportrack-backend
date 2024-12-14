'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');

// Extend Day.js with required plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

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

      for (const alarm of alarms) {
        const {
          id,
          startTime,
          endTime,
          startTimeDelay = 10,
          endTimeDelay = 10,
          timezone: alarmTimezone = 'UTC',
          daysOfWeek,
          property,
        } = alarm;

        logs.push(
          `----------------------------------------------------------------------------------------`
        );

        const currentTimeUtc = dayjs.utc();
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

        // Calculate today's start in UTC based on the alarm's timezone
        const todayStartUtc = dayjs()
          .tz(alarmTimezone)
          .startOf('day')
          .utc()
          .toISOString();

        logs.push(
          `- Today's date (UTC start based on alarm's timezone): ${todayStartUtc}`
        );

        // Parse and calculate trigger times in the alarm's timezone
        const alarmStartTime = dayjs
          .tz(
            `${currentTimeInTimezone.format('YYYY-MM-DD')}T${startTime}`,
            alarmTimezone
          )
          .add(startTimeDelay, 'minute');

        const alarmEndTime = dayjs
          .tz(
            `${currentTimeInTimezone.format('YYYY-MM-DD')}T${endTime}`,
            alarmTimezone
          )
          .add(endTimeDelay, 'minute');

        const alarmStartTimeUtc = alarmStartTime.utc().toISOString();
        const alarmEndTimeUtc = alarmEndTime.utc().toISOString();

        logs.push(
          `- Alarm Start Time (UTC): ${alarmStartTimeUtc}, End Time (UTC): ${alarmEndTimeUtc}`
        );

        // const utcDayRange = getUtcDayRange(alarmTimezone);
        // logs.push(`- Get UTC day range for: ${alarmTimezone}`);
        // logs.push(utcDayRange);

        // logs.push(
        //   `- UTC day range for alarm timezone: ${utcDayRange.utcStart} to ${utcDayRange.utcEnd}`
        // );
        // logs.push(
        //   `- Day range for alarm timezone: ${utcDayRange.timezoneStart} to ${utcDayRange.timezoneEnd}`
        // );

        // Service record query using the corrected todayStartUtc
        const query = {
          where: {
            property: property.id,
            $or: [
              {
                startDateTime: {
                  $lte: alarmStartTimeUtc,
                  $gte: todayStartUtc,
                },
              },
              {
                endDateTime: {
                  $lte: alarmEndTimeUtc,
                  $gte: todayStartUtc,
                },
              },
            ],
          },
        };

        logs.push(`- Service record query:`);
        logs.push(query);

        const serviceRecords = await strapi.db
          .query('api::service-record.service-record')
          .findMany(query);
        logs.push(`- Service record result:`);
        logs.push(serviceRecords);

        // Confirms that a service record started within the appropriate timeframe for the alarm's start.
        const serviceHasStarted = serviceRecords.some(
          (record) =>
            // Started on or before the alarm's start time
            dayjs(record.startDateTime).isSameOrBefore(alarmStartTimeUtc) &&
            // Started on or after the beginning of the current day in UTC
            dayjs(record.startDateTime).isSameOrAfter(todayStartUtc)
        );

        // Confirms that a service record ended within the appropriate timeframe for the alarm's end.
        const serviceHasEnded = serviceRecords.some(
          (record) =>
            // Ended on or before the alarm's end time
            dayjs(record.endDateTime).isSameOrBefore(alarmEndTimeUtc) &&
            // Ended on or after the beginning of the current day in UTC
            dayjs(record.endDateTime).isSameOrAfter(todayStartUtc)
        );

        logs.push(
          `- Service Record has Started: ${serviceHasStarted}, has Ended: ${serviceHasEnded}`
        );

        if (!serviceHasStarted || !serviceHasEnded) {
          logs.push(
            `- No service records found for property ID ${property.id} during the scheduled alarm time. > Trigger alarm.`
          );
        } else {
          logs.push(
            `- ${serviceRecords.length} Service record(s) found for property ID ${property.id} during the scheduled time. > Skip alarm.`
          );
          continue;
        }

        // Check notification and trigger conditions
        const hasBeenNotifiedToday =
          alarm.notified &&
          dayjs(alarm.notified).isSame(currentTimeInTimezone, 'day');

        logs.push(`- Alarm already notified today: ${hasBeenNotifiedToday}`);

        if (
          currentTimeInTimezone.isAfter(alarmStartTime) &&
          !alarm.startAlarmDisabled &&
          !hasBeenNotifiedToday
        ) {
          logs.push(`- Conditions met for start alarm. Triggering now...`);
          await this.triggerAlarm(alarm, 'start');
          logs.push(`- Start alarm triggered successfully for Alarm ID ${id}.`);
        } else {
          logs.push(`- Start alarm not triggered.`);
        }

        if (
          currentTimeInTimezone.isAfter(alarmEndTime) &&
          !alarm.endAlarmDisabled &&
          !hasBeenNotifiedToday
        ) {
          logs.push(`- Conditions met for end alarm. Triggering now...`);
          await this.triggerAlarm(alarm, 'end');
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

function getUtcDayRange(timezoneValue) {
  // Validate the input timezone value
  if (!timezoneValue) {
    throw new Error(`Invalid timezone value: ${timezoneValue}`);
  }

  // Get the current date in the specified timezone
  const nowInTimezone = dayjs().tz(timezoneValue);

  // Calculate the start and end of the day in the specified timezone
  const startOfDayInTimezone = nowInTimezone.startOf('day');
  const endOfDayInTimezone = startOfDayInTimezone.add(1, 'day');

  // Convert to UTC for the range
  const startUtc = startOfDayInTimezone.utc().toISOString();
  const endUtc = endOfDayInTimezone.utc().toISOString();

  return {
    timezoneStart: startOfDayInTimezone.format(), // Start time in the specified timezone
    timezoneEnd: endOfDayInTimezone.format(), // End time in the specified timezone
    utcStart: startUtc, // Start time in UTC
    utcEnd: endUtc, // End time in UTC
  };
}
