// @ts-nocheck
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');

module.exports = createCoreService(
  'api::service-record.service-record',
  ({ strapi }) => ({
    async findRecordsByUser(user, queryParams) {
      try {
        // Ensure we have the user's role - fetch it if not populated
        let userRole = user?.role?.name;
        if (user?.id && !userRole) {
          try {
            const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
              where: { id: user.id },
              populate: ['role']
            });
            userRole = fullUser?.role?.name;
          } catch (err) {
            console.error('Error fetching user role:', err);
          }
        }

        console.log('🔍 findRecordsByUser called:', {
          userId: user?.id,
          userRole: userRole,
          queryParams: JSON.stringify(queryParams)
        });
        const page = queryParams?.pagination?.page || 1;
        const pageSize = queryParams?.pagination?.pageSize || 10;
        const sort = queryParams?.sort || 'startDateTime:desc';
        const filters = queryParams?.filters || {};
        const doAssociatedFilter =
          queryParams?.showAssociatedOnly === 'true' && user?.id;

        let userFilters = {};

        if (userRole === 'Customer') {
          userFilters = {
            property: {
              users: {
                id: { $eq: user.id },
              },
            },
          };
        } else if (userRole === 'Service Person') {
          userFilters = { users_permissions_user: user.id };
        } else if (doAssociatedFilter) {
          // Determine if we need to filter by associated users
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
        }

        // Combine userFilters and filters using $and to prevent key collisions
        // (e.g. both userFilters and column search filters may use 'property' key)
        const combinedWhere = Object.keys(userFilters).length > 0 && Object.keys(filters).length > 0
          ? { $and: [userFilters, filters] }
          : { ...userFilters, ...filters };

        // Set up query options with pagination, sorting, and user filters
        const queryOptions = {
          where: combinedWhere,
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
          .count({ where: combinedWhere });

        console.log('🔍 Query result:', { resultCount: result?.length, totalCount });

        // Filter incidents for Customer users - only show approved/sent incidents
        let filteredResult = result || [];
        if (userRole === 'Customer' && Array.isArray(filteredResult)) {
          filteredResult = filteredResult.map(record => ({
            ...record,
            incidents: (record.incidents || []).filter(incident => incident.sentToClient === true)
          }));
        }

        return {
          data: filteredResult,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount: Math.ceil(totalCount / pageSize),
              total: totalCount,
            },
          },
        };
      } catch (error) {
        console.error('❌ findRecordsByUser error:', error);
        throw error;
      }
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

    /**
     * Add a reply to an incident (two-way communication)
     * Customers can reply to incidents sent to them
     * Subscribers/Admins can reply to any incident
     * @param {number} serviceRecordId - The service record ID
     * @param {string} incidentId - The incident UUID
     * @param {string} replyText - The reply text
     * @param {object} user - The user making the reply
     * @param {string} userRole - The user's role (Customer, Subscriber, Admin)
     */
    async addIncidentReply(serviceRecordId, incidentId, replyText, user, userRole) {
      const logs = [];

      try {
        // Verify the incident exists
        const serviceRecord = await strapi.db.query('api::service-record.service-record').findOne({
          where: { id: serviceRecordId },
          populate: {
            property: { populate: { users: true } },
            customer: { populate: { users: true } },
          }
        });

        if (!serviceRecord) {
          throw new Error('Service record not found');
        }

        const incidents = serviceRecord.incidents || [];
        const incidentIndex = incidents.findIndex(inc => inc.id === incidentId);

        if (incidentIndex === -1) {
          throw new Error('Incident not found');
        }

        const incident = incidents[incidentIndex];

        // For Customers: verify incident was sent to client and they have access
        if (userRole === 'Customer') {
          if (!incident.sentToClient) {
            throw new Error('This incident has not been shared with you yet');
          }

          // Verify user has access to this property or customer
          const propertyUserIds = (serviceRecord.property?.users || []).map(u => u.id);
          const customerUserIds = (serviceRecord.customer?.users || []).map(u => u.id);
          const hasAccess = propertyUserIds.includes(user.id) || customerUserIds.includes(user.id);

          if (!hasAccess) {
            throw new Error('You do not have access to reply to this incident');
          }
        }
        // Subscribers/Admins can reply to any incident (no additional checks needed)

        // Create reply object with role indicator
        const reply = {
          id: require('crypto').randomUUID(),
          text: replyText,
          createdAt: new Date().toISOString(),
          createdBy: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: userRole
          }
        };

        // Add reply to incident's replies array
        const existingReplies = incident.customerReplies || [];
        incidents[incidentIndex] = {
          ...incident,
          customerReplies: [...existingReplies, reply]
        };

        // Update service record
        await strapi.db.query('api::service-record.service-record').update({
          where: { id: serviceRecordId },
          data: { incidents }
        });

        logs.push(`✅ Reply added by ${user.username} (${user.name || 'no name'}) - Role: ${userRole}`);
        console.log('Incident Reply:', logs.join('\n'));

        // Send notifications based on who replied
        if (userRole === 'Customer') {
          // Notify Subscribers when Customer replies
          try {
            await this.sendReplyNotification(serviceRecord, incident, reply);
          } catch (notifyError) {
            logs.push(`⚠️ Failed to send reply notification to subscribers: ${notifyError.message}`);
            console.error('Reply notification error:', notifyError);
            // Don't fail the whole operation if notification fails
          }
        } else if (userRole === 'Subscriber' || userRole === 'Admin') {
          // Notify Customers when Subscriber/Admin replies
          try {
            await this.sendReplyNotificationToCustomer(serviceRecord, incident, reply);
          } catch (notifyError) {
            logs.push(`⚠️ Failed to send reply notification to customers: ${notifyError.message}`);
            console.error('Customer reply notification error:', notifyError);
            // Don't fail the whole operation if notification fails
          }
        }

        return { success: true, reply, logs };
      } catch (error) {
        logs.push(`❌ Error: ${error.message}`);
        console.error('Incident reply error:', error);
        return { success: false, error: error.message, logs };
      }
    },

    /**
     * Send notification to subscribers when a customer replies to an incident
     * @param {object} serviceRecord - The service record with property populated
     * @param {object} incident - The incident that was replied to
     * @param {object} reply - The reply object with createdBy info
     */
    async sendReplyNotification(serviceRecord, incident, reply) {
      const logs = [];

      // Check if email alerts are enabled
      const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
      if (!emailAlertsEnabled) {
        logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
        console.log('Reply Notification:', logs.join('\n'));
        return logs;
      }

      try {
        const { property, id: serviceRecordId } = serviceRecord;

        // Fetch Subscriber users assigned to the property
        const subscriberUsers = await strapi.db
          .query('plugin::users-permissions.user')
          .findMany({
            where: {
              properties: property.id,
              role: { name: 'Subscriber' },
            },
            populate: ['role'],
          });

        logs.push(`Reply Notification: Found ${subscriberUsers.length} Subscriber users for property ${property.id}`);

        // Filter users who have opted in to receive incident notifications
        const optedInUsers = subscriberUsers.filter(user => user.receiveIncidentNotifications !== false);

        logs.push(`${optedInUsers.length} Subscribers opted in for incident notifications`);

        if (optedInUsers.length === 0) {
          logs.push('No users opted in for incident notifications');
          console.log('Reply Notification:', logs.join('\n'));
          return logs;
        }

        const propertyName = property?.name || 'Unknown Property';
        const customerName = reply.createdBy?.name || reply.createdBy?.username || 'Customer';
        const incidentDescription = incident.description?.length > 100
          ? incident.description.substring(0, 100) + '...'
          : incident.description;

        const emailContent = {
          subject: `[INCIDENT REPLY] Customer Response at ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #52c41a; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">Customer Reply to Incident</h2>
              </div>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>Customer:</strong> ${customerName}</p>

                <div style="background-color: #f6ffed; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #52c41a;">
                  <h4 style="margin-top: 0; color: #52c41a;">Customer Reply:</h4>
                  <p style="white-space: pre-wrap;">${reply.text}</p>
                </div>

                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #faad14;">
                  <h4 style="margin-top: 0; color: #666;">Original Incident:</h4>
                  <p style="white-space: pre-wrap; color: #666;">${incidentDescription}</p>
                </div>

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
          logs.push(`📧 Attempting to send reply notification to ${user.email}...`);

          try {
            const emailStart = Date.now();
            await strapi.plugins['email'].services.email.send({
              ...emailContent,
              to: user.email,
              from: 'noreply@reportrack.com',
            });
            const emailDuration = Date.now() - emailStart;
            logs.push(`✅ Reply notification delivered successfully to ${user.email} (${emailDuration}ms)`);
            emailStats.successful++;

            // Log successful email
            await strapi.service('api::email-log.email-log').logEmail({
              to: user.email,
              subject: emailContent.subject,
              trigger: 'incident_reply',
              triggerDetails: {
                serviceRecordId,
                incidentId: incident.id,
                replyId: reply.id,
                propertyName,
                customerName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'success',
              deliveryTime: emailDuration,
              relatedEntity: 'service-record',
              relatedEntityId: serviceRecordId,
            });
          } catch (err) {
            logs.push(`❌ Reply notification delivery failed to ${user.email}: ${err.message}`);
            emailStats.failed++;

            // Log failed email
            await strapi.service('api::email-log.email-log').logEmail({
              to: user.email,
              subject: emailContent.subject,
              trigger: 'incident_reply',
              triggerDetails: {
                serviceRecordId,
                incidentId: incident.id,
                replyId: reply.id,
                propertyName,
                customerName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'failed',
              error: err.message,
              relatedEntity: 'service-record',
              relatedEntityId: serviceRecordId,
            });
          }
        }

        // Summary
        logs.push(`📊 Reply Notification Summary:`);
        logs.push(`   • Total users: ${emailStats.total}`);
        logs.push(`   • Successful: ${emailStats.successful}`);
        logs.push(`   • Failed: ${emailStats.failed}`);
        logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);

        console.log('Reply Notification:', logs.join('\n'));

        return logs;
      } catch (error) {
        logs.push(`❌ Error sending reply notifications: ${error.message}`);
        console.error('Reply notification error:', error);
        return logs;
      }
    },

    /**
     * Send notification to customers when a subscriber/admin replies to an incident
     * @param {object} serviceRecord - The service record with property and customer populated
     * @param {object} incident - The incident that was replied to
     * @param {object} reply - The reply object with createdBy info
     */
    async sendReplyNotificationToCustomer(serviceRecord, incident, reply) {
      const logs = [];

      // Check if email alerts are enabled
      const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
      if (!emailAlertsEnabled) {
        logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
        console.log('Customer Reply Notification:', logs.join('\n'));
        return logs;
      }

      try {
        const { property, customer, id: serviceRecordId } = serviceRecord;

        // Collect Customer users from property and customer relations
        const propertyUsers = property?.users || [];
        const customerUsers = customer?.users || [];

        // Combine and deduplicate users
        const allUsers = [...propertyUsers];
        customerUsers.forEach(cu => {
          if (!allUsers.some(u => u.id === cu.id)) {
            allUsers.push(cu);
          }
        });

        // Filter to only Customer role users
        const customerRoleUsers = allUsers.filter(user => {
          // Check if user has Customer role (role might be populated or just an ID)
          if (user.role?.name === 'Customer') return true;
          // If role isn't populated, we'll include them and let notification preference filter
          return true;
        });

        logs.push(`Customer Reply Notification: Found ${customerRoleUsers.length} potential Customer users`);

        // Filter users who have opted in to receive incident notifications
        const optedInUsers = customerRoleUsers.filter(user => user.receiveIncidentNotifications !== false);

        logs.push(`${optedInUsers.length} users opted in for incident notifications`);

        if (optedInUsers.length === 0) {
          logs.push('No Customer users opted in for incident notifications');
          console.log('Customer Reply Notification:', logs.join('\n'));
          return logs;
        }

        const propertyName = property?.name || 'Unknown Property';
        const subscriberName = reply.createdBy?.name || reply.createdBy?.username || 'Staff';
        const incidentDescription = incident.description?.length > 100
          ? incident.description.substring(0, 100) + '...'
          : incident.description;

        const emailContent = {
          subject: `[INCIDENT UPDATE] New Response for ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #1890ff; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">New Response to Your Incident Report</h2>
              </div>

              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>From:</strong> ${subscriberName}</p>

                <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1890ff;">
                  <h4 style="margin-top: 0; color: #1890ff;">Response:</h4>
                  <p style="white-space: pre-wrap;">${reply.text}</p>
                </div>

                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #faad14;">
                  <h4 style="margin-top: 0; color: #666;">Original Incident:</h4>
                  <p style="white-space: pre-wrap; color: #666;">${incidentDescription}</p>
                </div>

                <p style="margin-top: 20px;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/serviceRecords/detail?id=${serviceRecordId}"
                     style="background-color: #1890ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View & Reply
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
          logs.push(`📧 Attempting to send customer reply notification to ${user.email}...`);

          try {
            const emailStart = Date.now();
            await strapi.plugins['email'].services.email.send({
              ...emailContent,
              to: user.email,
              from: 'noreply@reportrack.com',
            });
            const emailDuration = Date.now() - emailStart;
            logs.push(`✅ Customer reply notification delivered successfully to ${user.email} (${emailDuration}ms)`);
            emailStats.successful++;

            // Log successful email
            await strapi.service('api::email-log.email-log').logEmail({
              to: user.email,
              subject: emailContent.subject,
              trigger: 'incident_reply_to_customer',
              triggerDetails: {
                serviceRecordId,
                incidentId: incident.id,
                replyId: reply.id,
                propertyName,
                subscriberName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'success',
              deliveryTime: emailDuration,
              relatedEntity: 'service-record',
              relatedEntityId: serviceRecordId,
            });
          } catch (err) {
            logs.push(`❌ Customer reply notification delivery failed to ${user.email}: ${err.message}`);
            emailStats.failed++;

            // Log failed email
            await strapi.service('api::email-log.email-log').logEmail({
              to: user.email,
              subject: emailContent.subject,
              trigger: 'incident_reply_to_customer',
              triggerDetails: {
                serviceRecordId,
                incidentId: incident.id,
                replyId: reply.id,
                propertyName,
                subscriberName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'failed',
              error: err.message,
              relatedEntity: 'service-record',
              relatedEntityId: serviceRecordId,
            });
          }
        }

        // Summary
        logs.push(`📊 Customer Reply Notification Summary:`);
        logs.push(`   • Total users: ${emailStats.total}`);
        logs.push(`   • Successful: ${emailStats.successful}`);
        logs.push(`   • Failed: ${emailStats.failed}`);
        logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);

        console.log('Customer Reply Notification:', logs.join('\n'));

        return logs;
      } catch (error) {
        logs.push(`❌ Error sending customer reply notifications: ${error.message}`);
        console.error('Customer reply notification error:', error);
        return logs;
      }
    },
  })
);
