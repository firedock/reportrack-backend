'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');

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
        populate: { property: true, customer: true, service_type: true, expected_service_person: true },
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
          startAlarmDisabled = false,
          endAlarmDisabled = false,
          timezone: alarmTimezone = 'UTC',
          daysOfWeek,
          property,
          service_type: alarmServiceType,
          notified,
          expected_service_person,
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
        logs.push(`- Start Alarm Enabled: ${!startAlarmDisabled}`);
        logs.push(`- End Alarm Enabled: ${!endAlarmDisabled}`);

        // Skip if both alarms are disabled
        if (startAlarmDisabled && endAlarmDisabled) {
          logs.push(
            `- Skipping alarm ID ${id}: Both start and end alarms are disabled.`
          );
          continue;
        }

        // Skip alarm if it's not scheduled for the current day
        if (!daysOfWeek.includes(currentDay)) {
          logs.push(
            `- Skipping alarm ID ${id}: Not configured for today (${currentDay}).`
          );
          continue;
        }

        // Check notification and trigger conditions in alarm's local timezone
        const hasBeenNotifiedToday =
          notified &&
          dayjs(notified)
            .tz(alarmTimezone) // Convert to alarm's timezone
            .isSame(currentTimeInTimezone, 'day');

        logs.push(`- Alarm already notified today: ${hasBeenNotifiedToday}`);

        if (hasBeenNotifiedToday) {
          logs.push(`- Skipping alarm ID ${id}: Already notified today.`);
          continue;
        }

        // Calculate today's start in alarm's timezone
        const todayStartLocal = dayjs().tz(alarmTimezone).startOf('day'); // Start of the day in local timezone

        const todayStartUtc = todayStartLocal.utc().toISOString();

        // Parse and calculate trigger times in the alarm's timezone (only if enabled)
        let alarmStartTime, alarmEndTime, alarmStartTimeUtc, alarmEndTimeUtc;

        if (!startAlarmDisabled && startTime) {
          alarmStartTime = dayjs
            .tz(
              `${todayStartLocal.format('YYYY-MM-DD')}T${startTime}`,
              alarmTimezone
            )
            .add(startTimeDelay, 'minute');
          alarmStartTimeUtc = alarmStartTime.utc().toISOString();
          const alarmStartTimeLocal = alarmStartTime.format('MM/DD/YYYY hh:mm A');
          logs.push(`- Alarm Start Time (Local): ${alarmStartTimeLocal}`);
        } else {
          logs.push(`- Alarm Start Time: Disabled`);
        }

        if (!endAlarmDisabled && endTime) {
          alarmEndTime = dayjs
            .tz(
              `${todayStartLocal.format('YYYY-MM-DD')}T${endTime}`,
              alarmTimezone
            )
            .add(endTimeDelay, 'minute');
          alarmEndTimeUtc = alarmEndTime.utc().toISOString();
          const alarmEndTimeLocal = alarmEndTime.format('MM/DD/YYYY hh:mm A');
          logs.push(`- Alarm End Time (Local): ${alarmEndTimeLocal}`);
        } else {
          logs.push(`- Alarm End Time: Disabled`);
        }

        // Check if the alarm is past due (for enabled alarms)
        // Only check start time if start alarm is enabled
        if (!startAlarmDisabled && alarmStartTimeUtc && currentTimeUtc.isBefore(alarmStartTimeUtc)) {
          logs.push(`- Skipping alarm ID ${id}: Start alarm is not past due yet.`);
          continue;
        }

        // If only end alarm is enabled, check if we're past that time
        if (startAlarmDisabled && !endAlarmDisabled && alarmEndTimeUtc && currentTimeUtc.isBefore(alarmEndTimeUtc)) {
          logs.push(`- Skipping alarm ID ${id}: End alarm is not past due yet.`);
          continue;
        }

        logs.push(`- Alarm Service Type: ${alarmServiceType?.service}`);

        // Build time range conditions based on which alarms are enabled
        const timeConditions = [];

        if (!startAlarmDisabled && alarmStartTimeUtc) {
          timeConditions.push({
            startDateTime: {
              $lte: alarmStartTimeUtc,
              $gte: todayStartUtc,
            },
          });
        }

        if (!endAlarmDisabled && alarmEndTimeUtc) {
          timeConditions.push({
            endDateTime: {
              $lte: alarmEndTimeUtc,
              $gte: todayStartUtc,
            },
          });
        }

        // Service record query using property, service_type, and time range
        const query = {
          where: {
            property: property.id,
            service_type: alarmServiceType?.id,
            ...(timeConditions.length > 0 && { $or: timeConditions }),
          },
          populate: { service_type: true },
        };

        const serviceRecords = await strapi.db
          .query('api::service-record.service-record')
          .findMany({
            ...query,
            populate: { service_type: true, users_permissions_user: true },
          });

        const serviceMatches = serviceRecords.some(
          (record) => record?.service_type?.id === alarmServiceType?.id
        );

        // Only check start time if start alarm is enabled
        const serviceHasStarted = startAlarmDisabled ? true : serviceRecords.some(
          (record) =>
            dayjs(record.startDateTime).isSameOrBefore(alarmStartTimeUtc) &&
            dayjs(record.startDateTime).isSameOrAfter(todayStartUtc)
        );

        // Only check end time if end alarm is enabled
        const serviceHasEnded = endAlarmDisabled ? true : serviceRecords.some(
          (record) =>
            record.endDateTime &&
            dayjs(record.endDateTime).isSameOrBefore(alarmEndTimeUtc) &&
            dayjs(record.endDateTime).isSameOrAfter(todayStartUtc)
        );

        // Check service person condition if expected_service_person is set
        let servicePersonMatches = true; // Default to true for backward compatibility
        if (expected_service_person) {
          servicePersonMatches = serviceRecords.some(
            (record) => record?.users_permissions_user?.id === expected_service_person.id
          );
          logs.push(`- Expected Service Person: ${expected_service_person.username || expected_service_person.id}`);
          logs.push(`- Service Person Matches: ${servicePersonMatches}`);
        } else {
          logs.push(`- No expected service person set (optional condition)`);
        }

        logs.push(`- Service type match: ${serviceMatches}`);
        logs.push(`- Service Record Started On Time: ${serviceHasStarted}${startAlarmDisabled ? ' (start alarm disabled - skipped)' : ''}`);
        logs.push(`- Service Record Ended On Time: ${serviceHasEnded}${endAlarmDisabled ? ' (end alarm disabled - skipped)' : ''}`);

        if (!serviceMatches || (!serviceHasStarted && !serviceHasEnded) || !servicePersonMatches) {
          const reasons = [];
          if (!serviceMatches) reasons.push('service type mismatch');
          if (!serviceHasStarted && !serviceHasEnded) reasons.push('missing start/end justification');
          if (!servicePersonMatches) reasons.push('service person mismatch');
          
          logs.push(
            `- Alarm trigger reason(s): ${reasons.join(', ')} for property ID ${property.id}. > Trigger alarm.`
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
              populate: { service_type: true, users_permissions_user: true },
            });

          const alarmLogs = await this.triggerAlarm(
            alarm,
            'start',
            serviceRecordsForDay,
            alarmStartTimeUtc,
            alarmEndTimeUtc
          );
          logs.push(...alarmLogs);
        } else {
          logs.push(
            `- ${serviceRecords.length} matching Service record(s) found for property ID ${property.id} during the scheduled time. > Skip alarm.`
          );
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

    await strapi.entityService.create('api::alarm-log.alarm-log', {
      data: {
        logs,
        runAt: dayjs().toISOString(),
      },
    });

    return {
      message: 'Alarms checked and triggered successfully',
      logs,
    };
  },

  async triggerAlarm(
    alarm,
    type,
    serviceRecordsForDay,
    alarmStartTimeUtc,
    alarmEndTimeUtc
  ) {
    const logs = [];

    try {
      const {
        property,
        customer,
        service_type,
        timezone,
        daysOfWeek,
        notified,
        createdByRole,
      } = alarm;

      if (!property) {
        const msg = `Cannot trigger alarm ID ${alarm.id}: Missing property.`;
        logs.push(`❌ ${msg}`);
        return logs;
      }

      // Alarm times in local timezone
      const alarmStartLocal = dayjs(alarmStartTimeUtc)
        .tz(timezone)
        .format('MM/DD/YYYY hh:mm A');
      const alarmEndLocal = dayjs(alarmEndTimeUtc)
        .tz(timezone)
        .format('MM/DD/YYYY hh:mm A');

      const emailContent = {
        subject: `Alarm ${type} Notification for ${property.name}`,
        html: `<p>The ${type} alarm for "<strong>${property.name}</strong>" was triggered.</p>`,
      };

      const roleToNotify =
        createdByRole === 'Customer' ? 'Customer' : 'Subscriber';
      // First fetch all users assigned to the property and role
      const allAssignedUsers = await strapi.db
        .query('plugin::users-permissions.user')
        .findMany({
          where: {
            properties: property.id,
            role: { name: roleToNotify },
          },
          populate: ['role'],
        });

      const optedInUsers = allAssignedUsers.filter(
        (user) => user.receiveAlarmNotifications
      );

      logs.push(
        `🔍 Found ${allAssignedUsers.length} user(s) with role "${roleToNotify}" assigned to property ${property.id}.`
      );
      logs.push(
        `🔔 ${optedInUsers.length} of them have opted in to receive alarm notifications.`
      );

      if (!optedInUsers.length) {
        logs.push(
          `⚠️ No users opted in for notifications. Emails will not be sent.`
        );
      }

      // Send emails with detailed logging
      let emailStats = {
        total: optedInUsers.length,
        attempted: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      };

      for (const user of optedInUsers) {
        if (!user.email) {
          logs.push(`⚠️  Skipping user ${user.username || user.id}: no email address`);
          emailStats.skipped++;
          continue;
        }
        
        emailStats.attempted++;
        logs.push(`📧 Attempting to send alarm notification to ${user.email} (${user.username || user.name || 'Unknown'})...`);
        
        try {
          const emailStart = Date.now();
          await strapi.plugins['email'].services.email.send({
            ...emailContent,
            to: user.email,
            from: 'noreply@reportrack.com',
          });
          const emailDuration = Date.now() - emailStart;
          logs.push(`✅ Alarm notification delivered successfully to ${user.email} (${emailDuration}ms)`);
          emailStats.successful++;
          
          // Log successful email
          await strapi.service('api::email-log.email-log').logEmail({
            to: user.email,
            subject: emailContent.subject,
            trigger: 'alarm_notification',
            triggerDetails: {
              alarmId: alarm.id,
              propertyName: property.name,
              propertyId: property.id,
              alarmType: type,
              username: user.username || user.name || 'Unknown',
            },
            status: 'success',
            deliveryTime: emailDuration,
            relatedEntity: 'alarm',
            relatedEntityId: alarm.id,
          });
        } catch (err) {
          logs.push(`❌ Alarm notification delivery failed to ${user.email}: ${err.message}`);
          logs.push(`   Error details: ${JSON.stringify({
            code: err.code,
            command: err.command,
            response: err.response,
            responseCode: err.responseCode
          })}`);
          emailStats.failed++;
          
          // Log failed email
          await strapi.service('api::email-log.email-log').logEmail({
            to: user.email,
            subject: emailContent.subject,
            trigger: 'alarm_notification',
            triggerDetails: {
              alarmId: alarm.id,
              propertyName: property.name,
              propertyId: property.id,
              alarmType: type,
              username: user.username || user.name || 'Unknown',
            },
            status: 'failed',
            error: err.message,
            relatedEntity: 'alarm',
            relatedEntityId: alarm.id,
          });
        }
      }

      // Summary statistics
      logs.push(`📊 Alarm Notification Email Summary:`);
      logs.push(`   • Total opted-in users: ${emailStats.total}`);
      logs.push(`   • Attempted: ${emailStats.attempted}`);
      logs.push(`   • Successful: ${emailStats.successful}`);
      logs.push(`   • Failed: ${emailStats.failed}`);
      logs.push(`   • Skipped (no email): ${emailStats.skipped}`);
      logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);

      // Update notified
      await strapi.db.query('api::alarm.alarm').update({
        where: { id: alarm.id },
        data: { notified: dayjs.utc().toISOString() },
      });

      return logs;
    } catch (error) {
      logs.push(`❌ Error triggering alarm ID ${alarm.id}: ${error.message}`);
      return logs;
    }
  },
}));
