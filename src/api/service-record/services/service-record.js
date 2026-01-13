// @ts-nocheck
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');

module.exports = createCoreService(
  'api::service-record.service-record',
  ({ strapi }) => ({
    async findRecordsByUser(user, queryParams) {
      console.log('🔍 findRecordsByUser called:', {
        userId: user?.id,
        userRole: user?.role?.name,
        queryParams: JSON.stringify(queryParams)
      });
      const page = queryParams?.pagination?.page || 1;
      const pageSize = queryParams?.pagination?.pageSize || 10;
      const sort = queryParams?.sort || 'startDateTime:desc';
      const filters = queryParams?.filters || {};
      const doAssociatedFilter =
        queryParams?.showAssociatedOnly === 'true' && user?.id;

      const userRole = user?.role?.name;

      let userFilters = {};

      if (userRole === 'Customer') {
        userFilters = {
          property: {
            users: {
              id: { $eq: user.id },
            },
          },
        };
        // console.log('Customer Filters', userFilters);
      } else if (userRole === 'Service Person') {
        userFilters = { users_permissions_user: user.id };
        // console.log('Service Person Filters', userFilters);
      }

      // Determine if we need to filter by associated users
      else if (doAssociatedFilter) {
        userFilters = {
          $or: [
            {
              property: {
                users: {
                  id: { $eq: user.id },
                },
              },
            },
            {
              customer: {
                users: {
                  id: { $eq: user.id },
                },
              },
            },
          ],
        };
        // console.log('Show Associated', doAssociatedFilter);
      }

      // Set up query options with pagination, sorting, and user filters
      const queryOptions = {
        where: { ...userFilters, ...filters },
        populate: {
          property: {
            populate: ['users'],
          },
          customer: {
            populate: ['users'],
          },
          service_type: true,
          users_permissions_user: true,
          author: true,
        },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: {
          startDateTime: sort.split(':')[1] === 'asc' ? 'asc' : 'desc',
        },
      };

      console.log('🔍 queryOptions:', JSON.stringify(queryOptions, null, 2));

      // Execute the query
      const result = await strapi.db
        .query('api::service-record.service-record')
        .findMany(queryOptions);

      // Count total records for pagination meta
      const totalCount = await strapi.db
        .query('api::service-record.service-record')
        .count({ where: { ...userFilters, ...filters } });

      console.log('🔍 Query result:', { resultCount: result?.length, totalCount });

      return {
        data: result,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(totalCount / pageSize),
            total: totalCount,
          },
        },
      };
    },

    async sendIncidentNotification(serviceRecord, incident) {
      const logs = [];

      // Check if email alerts are enabled (defaults to false if not set)
      const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
      if (!emailAlertsEnabled) {
        logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
        console.log('Incident Notification:', logs.join('\n'));
        return logs;
      }

      try {
        const { property, customer, service_type, id } = serviceRecord;

        // Fetch only Subscriber users assigned to the property
        // This ensures initial incident notifications go ONLY to Subscribers for review
        // Customers will receive notifications via the manual "Send to Client" action
        const subscriberUsers = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: {
              properties: property.id,
              role: { name: 'Subscriber' },
            },
            populate: ['role'],
          });

        logs.push(`Incident Report: Found ${subscriberUsers.length} Subscriber users for property ${property.id}`);

        // Filter users who have opted in to receive incident notifications
        const optedInUsers = subscriberUsers.filter(user => user.receiveIncidentNotifications !== false);

        logs.push(`${optedInUsers.length} Subscribers opted in for incident notifications`);

        if (optedInUsers.length === 0) {
          logs.push('No users opted in for incident notifications');
          console.log('Incident Notification:', logs.join('\n'));
          return logs;
        }

        const propertyName = property?.name || 'Unknown Property';
        const customerName = customer?.name || property?.customer?.name || 'Unknown Customer';
        const reporterName = incident.reportedBy?.username || 'Service Person';
        const serviceTypeName = service_type?.service || 'Service';
        const reportedTime = dayjs(incident.reportedAt).format('MM/DD/YYYY h:mmA');

        const emailContent = {
          subject: `[INCIDENT REPORT] Issue Reported at ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #faad14; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">Incident Report</h2>
              </div>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Service Type:</strong> ${serviceTypeName}</p>
                <p><strong>Reported By:</strong> ${reporterName}</p>
                <p><strong>Time:</strong> ${reportedTime}</p>

                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #faad14;">
                  <h4 style="margin-top: 0;">Description:</h4>
                  <p style="white-space: pre-wrap;">${incident.description}</p>
                </div>

                ${incident.mediaIds?.length > 0 ? '<p><em>📷 Photos attached to this incident - view in the service record.</em></p>' : ''}

                <p style="margin-top: 20px;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/serviceRecords/detail?id=${id}"
                     style="background-color: #1890ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Service Record
                  </a>
                </p>
              </div>

              <p style="margin-top: 20px; color: #666; font-size: 12px;">
                This is an automated notification from REPORTRACK.
              </p>
            </div>
          `,
        };

        // Send emails to all opted-in users
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
          logs.push(`📧 Attempting to send incident notification to ${user.email}...`);

          try {
            const emailStart = Date.now();
            await strapi.plugins['email'].services.email.send({
              ...emailContent,
              to: user.email,
              from: 'noreply@reportrack.com',
            });
            const emailDuration = Date.now() - emailStart;
            logs.push(`✅ Notification delivered successfully to ${user.email} (${emailDuration}ms)`);
            emailStats.successful++;

            // Log successful email
            await strapi.service('api::email-log.email-log').logEmail({
              to: user.email,
              subject: emailContent.subject,
              trigger: 'incident_report',
              triggerDetails: {
                serviceRecordId: id,
                incidentId: incident.id,
                propertyName,
                reporterName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'success',
              deliveryTime: emailDuration,
              relatedEntity: 'service-record',
              relatedEntityId: id,
            });
          } catch (err) {
            logs.push(`❌ Notification delivery failed to ${user.email}: ${err.message}`);
            emailStats.failed++;

            // Log failed email
            await strapi.service('api::email-log.email-log').logEmail({
              to: user.email,
              subject: emailContent.subject,
              trigger: 'incident_report',
              triggerDetails: {
                serviceRecordId: id,
                incidentId: incident.id,
                propertyName,
                reporterName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'failed',
              error: err.message,
              relatedEntity: 'service-record',
              relatedEntityId: id,
            });
          }
        }

        // Summary
        logs.push(`📊 Incident Notification Summary:`);
        logs.push(`   • Total users: ${emailStats.total}`);
        logs.push(`   • Successful: ${emailStats.successful}`);
        logs.push(`   • Failed: ${emailStats.failed}`);
        logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);

        console.log('Incident Notification:', logs.join('\n'));

        // Update incident to mark notification as sent
        // Note: The incident was just added by the controller, so we need to update it
        const updatedIncidents = [...(serviceRecord.incidents || []), { ...incident, notificationSent: true }];

        await strapi.db.query('api::service-record.service-record').update({
          where: { id: serviceRecord.id },
          data: { incidents: updatedIncidents }
        });

        return logs;
      } catch (error) {
        logs.push(`❌ Error sending incident notifications: ${error.message}`);
        console.error('Incident notification error:', error);
        return logs;
      }
    },

    /**
     * Update subscriber notes on a specific incident
     * @param {number} serviceRecordId - The service record ID
     * @param {string} incidentId - The incident UUID
     * @param {string} subscriberNotes - The notes/translation text
     * @param {object} user - The user making the update
     */
    async updateIncidentNotes(serviceRecordId, incidentId, subscriberNotes, user) {
      try {
        const serviceRecord = await strapi.db.query('api::service-record.service-record').findOne({
          where: { id: serviceRecordId }
        });

        if (!serviceRecord) {
          throw new Error('Service record not found');
        }

        const incidents = serviceRecord.incidents || [];
        const incidentIndex = incidents.findIndex(inc => inc.id === incidentId);

        if (incidentIndex === -1) {
          throw new Error('Incident not found');
        }

        // Update subscriber notes on the incident
        incidents[incidentIndex] = {
          ...incidents[incidentIndex],
          subscriberNotes: subscriberNotes || null
        };

        await strapi.entityService.update(
          'api::service-record.service-record',
          serviceRecordId,
          { data: { incidents } }
        );

        console.log(`✅ Updated subscriber notes for incident ${incidentId} by user ${user?.username}`);

        return { success: true, incident: incidents[incidentIndex] };
      } catch (error) {
        console.error('Update incident notes error:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * Send incident report to Client (Customer) users
     * This is the manual "Send to Client" action triggered by Subscribers
     * @param {number} serviceRecordId - The service record ID
     * @param {string} incidentId - The incident UUID
     * @param {object} user - The user triggering the send
     */
    async sendIncidentToClient(serviceRecordId, incidentId, user) {
      const logs = [];

      // Check if email alerts are enabled
      const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
      if (!emailAlertsEnabled) {
        logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
        console.log('Send to Client:', logs.join('\n'));
        return { success: true, logs, skipped: true };
      }

      try {
        // Fetch service record with full population
        const serviceRecord = await strapi.db.query('api::service-record.service-record').findOne({
          where: { id: serviceRecordId },
          populate: {
            property: { populate: { users: true, customer: true } },
            customer: { populate: { users: true } },
            service_type: true,
          }
        });

        if (!serviceRecord) {
          throw new Error('Service record not found');
        }

        // Find the specific incident
        const incidents = serviceRecord.incidents || [];
        const incidentIndex = incidents.findIndex(inc => inc.id === incidentId);

        if (incidentIndex === -1) {
          throw new Error('Incident not found');
        }

        const incident = incidents[incidentIndex];
        const { property, customer, service_type } = serviceRecord;

        // Fetch only Customer role users from property and customer relations
        const customerUsersFromProperty = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: {
              properties: property.id,
              role: { name: 'Customer' },
            },
            populate: ['role'],
          });

        const customerUsersFromCustomer = customer?.id ? await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: {
              customers: customer.id,
              role: { name: 'Customer' },
            },
            populate: ['role'],
          }) : [];

        // Deduplicate by user id
        const allCustomerUsers = [...customerUsersFromProperty, ...customerUsersFromCustomer];
        const uniqueCustomerUsers = Array.from(
          new Map(allCustomerUsers.map(u => [u.id, u])).values()
        );

        // Filter by notification preference
        const optedInUsers = uniqueCustomerUsers.filter(
          u => u.receiveIncidentNotifications !== false
        );

        logs.push(`Found ${uniqueCustomerUsers.length} Customer users, ${optedInUsers.length} opted in`);

        // Build email content with subscriber notes
        const propertyName = property?.name || 'Unknown Property';
        const customerName = customer?.name || property?.customer?.name || 'Unknown Customer';
        const serviceTypeName = service_type?.service || 'Service';
        const reportedTime = dayjs(incident.reportedAt).format('MM/DD/YYYY h:mmA');

        const emailContent = {
          subject: `[INCIDENT REPORT] ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #faad14; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">Incident Report</h2>
              </div>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Service Type:</strong> ${serviceTypeName}</p>
                <p><strong>Reported:</strong> ${reportedTime}</p>
                <p><strong>Reported By:</strong> ${incident.reportedBy?.username || 'Service Person'}</p>

                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #faad14;">
                  <h4 style="margin-top: 0;">Description:</h4>
                  <p style="white-space: pre-wrap;">${incident.description}</p>
                </div>

                ${incident.subscriberNotes ? `
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1890ff;">
                  <h4 style="margin-top: 0;">Additional Notes:</h4>
                  <p style="white-space: pre-wrap;">${incident.subscriberNotes}</p>
                </div>
                ` : ''}

                ${incident.mediaIds?.length > 0 ? '<p><em>📷 Photos attached to this incident - view in the service record.</em></p>' : ''}

                <p style="margin-top: 20px;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/serviceRecords/detail?id=${serviceRecordId}"
                     style="background-color: #1890ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Service Record
                  </a>
                </p>
              </div>

              <p style="margin-top: 20px; color: #666; font-size: 12px;">
                This is an automated notification from REPORTRACK.
              </p>
            </div>
          `,
        };

        // Send emails to all opted-in Customer users
        let emailStats = { total: optedInUsers.length, attempted: 0, successful: 0, failed: 0 };

        for (const customerUser of optedInUsers) {
          if (!customerUser.email) {
            logs.push(`⚠️ Skipping user ${customerUser.username || customerUser.id}: no email address`);
            continue;
          }

          emailStats.attempted++;
          logs.push(`📧 Attempting to send to client ${customerUser.email}...`);

          try {
            const emailStart = Date.now();
            await strapi.plugins['email'].services.email.send({
              ...emailContent,
              to: customerUser.email,
              from: 'noreply@reportrack.com',
            });
            const emailDuration = Date.now() - emailStart;
            logs.push(`✅ Delivered to ${customerUser.email} (${emailDuration}ms)`);
            emailStats.successful++;

            // Log successful email
            await strapi.service('api::email-log.email-log').logEmail({
              to: customerUser.email,
              subject: emailContent.subject,
              trigger: 'incident_to_client',
              triggerDetails: {
                serviceRecordId,
                incidentId,
                propertyName,
                sentBy: user?.username,
              },
              status: 'success',
              deliveryTime: emailDuration,
              relatedEntity: 'service-record',
              relatedEntityId: serviceRecordId,
            });
          } catch (err) {
            logs.push(`❌ Failed to ${customerUser.email}: ${err.message}`);
            emailStats.failed++;

            // Log failed email
            await strapi.service('api::email-log.email-log').logEmail({
              to: customerUser.email,
              subject: emailContent.subject,
              trigger: 'incident_to_client',
              triggerDetails: {
                serviceRecordId,
                incidentId,
                propertyName,
                sentBy: user?.username,
              },
              status: 'failed',
              error: err.message,
              relatedEntity: 'service-record',
              relatedEntityId: serviceRecordId,
            });
          }
        }

        // Collect list of emails that were successfully sent to
        const sentToEmails = optedInUsers
          .filter(u => u.email)
          .map(u => u.email);

        // Update incident to mark as sent to client
        const now = new Date().toISOString();
        incidents[incidentIndex] = {
          ...incident,
          sentToClient: true,
          sentToClientAt: now,
          sentToClientBy: { id: user.id, username: user.username },
          sentToEmails: sentToEmails
        };

        await strapi.db.query('api::service-record.service-record').update({
          where: { id: serviceRecordId },
          data: { incidents }
        });

        logs.push(`📊 Send to Client Summary: ${emailStats.successful}/${emailStats.attempted} emails sent`);
        console.log('Send to Client:', logs.join('\n'));

        return {
          success: true,
          logs,
          emailStats,
          sentAt: now
        };
      } catch (error) {
        logs.push(`❌ Error: ${error.message}`);
        console.error('Send to Client error:', error);
        return { success: false, error: error.message, logs };
      }
    },
  })
);
