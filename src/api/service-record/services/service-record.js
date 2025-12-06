// @ts-nocheck
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');

module.exports = createCoreService(
  'api::service-record.service-record',
  ({ strapi }) => ({
    async findRecordsByUser(user, queryParams) {
      // console.log('findRecordsByUser', user);
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

      // console.log('\nqueryOptions', JSON.stringify(queryOptions, 2, null));

      // Execute the query
      const result = await strapi.db
        .query('api::service-record.service-record')
        .findMany(queryOptions);

      // Count total records for pagination meta
      const totalCount = await strapi.db
        .query('api::service-record.service-record')
        .count({ where: { ...userFilters, ...filters } });

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

      try {
        const { property, customer, service_type, id } = serviceRecord;

        // Collect all unique users from property and customer
        const allUsers = new Set();

        // Add users from property
        if (property?.users) {
          property.users.forEach(user => allUsers.add(user));
        }

        // Add users from customer (may be nested under property)
        if (customer?.users) {
          customer.users.forEach(user => allUsers.add(user));
        }
        if (property?.customer?.users) {
          property.customer.users.forEach(user => allUsers.add(user));
        }

        const uniqueUsers = Array.from(allUsers);

        // Filter users who have opted in to receive incident notifications
        const optedInUsers = uniqueUsers.filter(user => user.receiveIncidentNotifications !== false);

        logs.push(`Incident Report: Found ${uniqueUsers.length} associated users`);
        logs.push(`${optedInUsers.length} users opted in for incident notifications`);

        if (optedInUsers.length === 0) {
          logs.push('No users opted in for incident notifications');
          console.log('Incident Notification:', logs.join('\n'));
          return logs;
        }

        // Severity colors for email styling
        const severityColors = {
          low: '#52c41a',
          medium: '#faad14',
          high: '#fa8c16',
          critical: '#ff4d4f'
        };

        const severityLabels = {
          low: 'Low',
          medium: 'Medium',
          high: 'High',
          critical: 'Critical'
        };

        const categoryLabels = {
          safety: 'Safety Hazard',
          equipment: 'Equipment Issue',
          property_damage: 'Property Damage',
          access_issue: 'Access Issue',
          pest: 'Pest Issue',
          maintenance: 'Maintenance Required',
          other: 'Other'
        };

        const propertyName = property?.name || 'Unknown Property';
        const customerName = customer?.name || property?.customer?.name || 'Unknown Customer';
        const reporterName = incident.reportedBy?.username || 'Service Person';
        const serviceTypeName = service_type?.service || 'Service';
        const severityColor = severityColors[incident.severity] || '#faad14';
        const severityLabel = severityLabels[incident.severity] || 'Medium';
        const categoryLabel = categoryLabels[incident.category] || incident.category || 'Other';
        const reportedTime = dayjs(incident.reportedAt).format('MM/DD/YYYY h:mmA');

        const emailContent = {
          subject: `[INCIDENT - ${severityLabel.toUpperCase()}] Issue Reported at ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: ${severityColor}; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">Incident Report - ${severityLabel}</h2>
              </div>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Service Type:</strong> ${serviceTypeName}</p>
                <p><strong>Reported By:</strong> ${reporterName}</p>
                <p><strong>Category:</strong> ${categoryLabel}</p>
                <p><strong>Time:</strong> ${reportedTime}</p>

                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid ${severityColor};">
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
                This is an automated notification from Reportrack.
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
                severity: incident.severity,
                category: incident.category,
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
                severity: incident.severity,
                category: incident.category,
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
  })
);
