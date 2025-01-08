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
        populate: { property: true, customer: true, service_type: true },
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
          service_type: alarmServiceType,
        } = alarm;

        logs.push(
          `----------------------------------------------------------------------------------------`
        );

        const currentTimeUtc = dayjs.utc();
        const currentTimeInTimezone = currentTimeUtc.tz(alarmTimezone);
        const currentDay = currentTimeInTimezone.format('dddd');

        logs.push(
          `- Alarm ID ${id}: Current timezone (${alarmTimezone}): ${currentTimeInTimezone.format()}`
        );
        logs.push(`- Alarm days: ${daysOfWeek.join(', ')}`);
        logs.push(`- Current day: ${currentDay}`);

        // Skip alarm if it's not scheduled for the current day
        if (!daysOfWeek.includes(currentDay)) {
          logs.push(
            `- Skipping alarm ID ${id}: Not configured for today (${currentDay}).`
          );
          continue;
        }

        // Check notification and trigger conditions
        const hasBeenNotifiedToday =
          alarm.notified &&
          dayjs(alarm.notified).isSame(currentTimeInTimezone, 'day');

        logs.push(`- Alarm already notified today: ${hasBeenNotifiedToday}`);

        if (hasBeenNotifiedToday) {
          logs.push(`- Skipping alarm ID ${id}: Already notified today.`);
          continue;
        }

        // Calculate today's start in UTC based on the alarm's timezone
        const todayStartUtc = dayjs()
          .tz(alarmTimezone)
          .startOf('day')
          .utc()
          .toISOString();

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

        // logs.push(`- Alarm Start Time (UTC): ${alarmStartTimeUtc}`);
        // logs.push(`- Alarm End Time (UTC): ${alarmEndTimeUtc}`);

        // Log alarm times in the alarm's timezone
        const alarmStartTimeLocal = alarmStartTime.format('YYYY-MM-DD hh:mm A');
        const alarmEndTimeLocal = alarmEndTime.format('YYYY-MM-DD hh:mm A');

        // Add logs for local times
        logs.push(`- Alarm Start Time (Local): ${alarmStartTimeLocal}`);
        logs.push(`- Alarm End Time (Local): ${alarmEndTimeLocal}`);

        // Check if the alarm is past due
        if (currentTimeUtc.isBefore(alarmStartTimeUtc)) {
          logs.push(`- Skipping alarm ID ${id}: Alarm is not past due yet.`);
          continue;
        }

        logs.push(`- Alarm Service Type: ${alarmServiceType?.service}`);

        // Service record query using the corrected todayStartUtc
        const query = {
          where: {
            property: property.id,
            service_type: alarmServiceType?.id,
            $or: [
              {
                // Match records that start within the alarm's adjusted timeframe
                startDateTime: {
                  $lte: alarmStartTimeUtc, // Use alarmStartTimeUtc as is
                  $gte: todayStartUtc,
                },
              },
              {
                // Match records that end within the alarm's adjusted timeframe
                endDateTime: {
                  $lte: alarmEndTimeUtc, // Use alarmEndTimeUtc as is
                  $gte: todayStartUtc,
                },
              },
            ],
          },
          populate: {
            service_type: true,
          },
        };

        const serviceRecords = await strapi.db
          .query('api::service-record.service-record')
          .findMany(query);

        const serviceMatches = serviceRecords.some((record) => {
          const recordServiceTypeId = record?.service_type?.id;
          const alarmServiceTypeId = alarmServiceType?.id;

          return (
            recordServiceTypeId &&
            alarmServiceTypeId &&
            recordServiceTypeId === alarmServiceTypeId
          );
        });

        const serviceHasStarted = serviceRecords.some(
          (record) =>
            dayjs(record.startDateTime).isSameOrBefore(alarmStartTimeUtc) &&
            dayjs(record.startDateTime).isSameOrAfter(todayStartUtc)
        );

        const serviceHasEnded = serviceRecords.some(
          (record) =>
            dayjs(record.endDateTime).isSameOrBefore(alarmEndTimeUtc) &&
            dayjs(record.endDateTime).isSameOrAfter(todayStartUtc)
        );

        logs.push(`- Service type match: ${serviceMatches}`);
        logs.push(`- Service Record Started On Time: ${serviceHasStarted}`);
        logs.push(`- Service Record Ended On Time: ${serviceHasEnded}`);

        if (!serviceMatches || !serviceHasStarted || !serviceHasEnded) {
          logs.push(
            `- No matching service record found or missing start/end justification for property ID ${property.id}. > Trigger alarm.`
          );

          const serviceRecordsForDay = await strapi.db
            .query('api::service-record.service-record')
            .findMany({
              where: {
                property: property.id,
                startDateTime: {
                  $gte: todayStartUtc,
                  $lte: alarmEndTimeUtc,
                },
              },
              populate: {
                service_type: true,
              },
            });

          await this.triggerAlarm(
            alarm,
            'start',
            serviceRecordsForDay,
            alarmStartTimeUtc,
            alarmEndTimeUtc
          );
        } else {
          logs.push(
            `- ${serviceRecords.length} matching Service record(s) found for property ID ${property.id} during the scheduled time. > Skip alarm.`
          );
          continue;
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

  async triggerAlarm(
    alarm,
    type,
    serviceRecordsForDay,
    alarmStartTimeUtc,
    alarmEndTimeUtc
  ) {
    try {
      const {
        property,
        customer,
        service_type,
        timezone,
        daysOfWeek,
        startTime,
        endTime,
        startTimeDelay,
        endTimeDelay,
        notified,
      } = alarm;

      if (!property) {
        console.error(`Cannot trigger alarm ID ${alarm.id}: Missing property.`);
        return;
      }

      // Format service records into an HTML table with timezone conversion
      const serviceRecordsDetails =
        serviceRecordsForDay.length > 0
          ? `
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th>Service Record ID</th>
          <th>Start Time (Local)</th>
          <th>End Time (Local)</th>
          <th>Service Type</th>
        </tr>
      </thead>
      <tbody>
        ${serviceRecordsForDay
          .map((record) => {
            // Convert service record times to the alarm's timezone
            const startTimeLocal = dayjs
              .utc(record.startDateTime) // Treat as UTC
              .tz(timezone) // Convert to the alarm's timezone
              .format('MM/DD/YYYY hh:mm:ss A');

            const endTimeLocal = dayjs
              .utc(record.endDateTime) // Treat as UTC
              .tz(timezone) // Convert to the alarm's timezone
              .format('MM/DD/YYYY hh:mm:ss A');

            return `
            <tr>
              <td>${record.id}</td>
              <td>${startTimeLocal}</td>
              <td>${endTimeLocal}</td>
              <td>${record?.service_type?.service || 'N/A'}</td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
  `
          : '<p>No service records found for today.</p>';

      // Alarm times in local timezone with delays applied
      const alarmStartLocal = dayjs
        .tz(`${dayjs().format('YYYY-MM-DD')}T${startTime}`, timezone)
        .add(startTimeDelay, 'minute') // Apply start time delay
        .format('MM/DD/YYYY hh:mm A');

      const alarmEndLocal = dayjs
        .tz(`${dayjs().format('YYYY-MM-DD')}T${endTime}`, timezone)
        .add(endTimeDelay, 'minute') // Apply end time delay
        .format('MM/DD/YYYY hh:mm A');

      const emailContent = {
        subject: `Alarm ${type} Notification for ${property.name}`,
        html: `
          <p>The ${type} alarm for property "<strong>${
          property.name
        }</strong>" (Customer: <strong>${
          customer?.name || 'N/A'
        }</strong>) has been triggered.</p>
          
          <h3>Alarm Details:</h3>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <tr>
              <td><strong>Alarm Timezone</strong></td>
              <td>${timezone || 'UTC'}</td>
            </tr>
            <tr>
              <td><strong>Alarm Start Time (Local)</strong></td>
              <td>${alarmStartLocal}</td>
            </tr>
            <tr>
              <td><strong>Alarm End Time (Local)</strong></td>
              <td>${alarmEndLocal}</td>
            </tr>
            <tr>
              <td><strong>Service Type</strong></td>
              <td>${service_type?.service || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Active Days</strong></td>
              <td>${daysOfWeek.join(', ')}</td>
            </tr>
            <tr>
              <td><strong>Status</strong></td>
              <td>${alarm.active ? 'Active' : 'Inactive'}</td>
            </tr>
            <tr>
              <td><strong>Last Notified</strong></td>
              <td>${notified || 'Never'}</td>
            </tr>
          </table>
      
          <h3>Service Records Found for the subject property today:</h3>
          ${serviceRecordsDetails}
        `,
      };

      const globalAlarmEmail = 'robert@firedock.com'; // Replace with your desired email

      // Send to associated users
      const users = await strapi.db
        .query('plugin::users-permissions.user')
        .findMany({
          where: { properties: property.id },
        });

      if (users && users.length > 0) {
        for (const user of users) {
          const emailData = {
            ...emailContent,
            to: user.email,
            from: 'noreply@reportrack.com',
          };

          try {
            await strapi.plugins['email'].services.email.send(emailData);
            console.log(`Email sent to ${user.email}`);
          } catch (error) {
            console.error(
              `Failed to send email to ${user.email}:`,
              error.message
            );
          }
        }
      }

      // Send to global alarm recipient
      const globalEmailData = {
        ...emailContent,
        to: globalAlarmEmail,
        from: 'noreply@reportrack.com',
      };

      try {
        await strapi.plugins['email'].services.email.send(globalEmailData);
        console.log(`Global alarm email sent to ${globalAlarmEmail}`);
      } catch (error) {
        console.error(
          `Failed to send global alarm email to ${globalAlarmEmail}:`,
          error.message
        );
      }

      // Update the notified field
      await strapi.db.query('api::alarm.alarm').update({
        where: { id: alarm.id },
        data: { notified: dayjs.utc().toISOString() },
      });
    } catch (error) {
      console.error(`Error triggering ${type} alarm:`, error);
    }
  },
}));
