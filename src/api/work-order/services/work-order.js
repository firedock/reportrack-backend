// @ts-nocheck
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { timezoneFromState } = require('../../../utils/timezoneFromState');

dayjs.extend(utc);
dayjs.extend(timezone);

module.exports = createCoreService(
  'api::work-order.work-order',
  ({ strapi }) => ({
    async findRecordsByUser(user, queryParams) {
      // console.log('findRecordsByUser', user);
      const page = queryParams?.pagination?.page || 1;
      const pageSize = queryParams?.pagination?.pageSize || 10;
      const sort = queryParams?.sort || 'createdAt:desc';
      const filters = queryParams?.filters || {};
      const doAssociatedFilter =
        queryParams?.showAssociatedOnly === 'true' && user?.id;

      const userRole = user?.role?.name;

      let userFilters = {};

      if (userRole === 'Customer') {
        userFilters = {
          $and: [
            {
              property: {
                users: {
                  id: { $eq: user.id },
                },
              },
            },
            {
              $or: [
                { private: { $eq: false } },
                { private: { $null: true } }
              ]
            }
          ]
        };
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
        // console.log('Show Associated', userFilters);
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
          createdAt: sort.split(':')[1] === 'asc' ? 'asc' : 'desc',
        },
      };

      // Execute the query
      const result = await strapi.db
        .query('api::work-order.work-order')
        .findMany(queryOptions);

      // Count total records for pagination meta
      const totalCount = await strapi.db
        .query('api::work-order.work-order')
        .count({ where: combinedWhere });

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

    async sendCreationNotification(workOrder, creator) {
      const logs = [];

      // Check if email alerts are enabled (defaults to false if not set)
      const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
      if (!emailAlertsEnabled) {
        logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
        console.log('Work Order Creation Notification:', logs.join('\n'));
        return logs;
      }

      try {
        const { property, customer, title, id, status, dueBy } = workOrder;
        
        // Collect all unique users from property and customer
        const allUsers = new Set();
        
        // Add users from property
        if (property?.users) {
          property.users.forEach(user => allUsers.add(user));
        }
        
        // Add users from customer
        if (customer?.users) {
          customer.users.forEach(user => allUsers.add(user));
        }
        
        const uniqueUsers = Array.from(allUsers);
        
        // Filter users who have opted in to receive work order notifications
        const optedInUsers = uniqueUsers.filter(user => user.receiveWorkOrderNotifications !== false);
        
        logs.push(`Work Order Creation: Found ${uniqueUsers.length} associated users`);
        logs.push(`${optedInUsers.length} users opted in for notifications`);
        
        if (optedInUsers.length === 0) {
          logs.push('No users opted in for work order notifications');
          return logs;
        }
        
        // Format due date in property's local timezone
        const tz = timezoneFromState(property?.state);
        const dueDateFormatted = dueBy ? dayjs.utc(dueBy).tz(tz).format('MM/DD/YYYY h:mmA') : 'Not set';
        const propertyName = property?.name || 'Unknown Property';
        const customerName = customer?.name || 'Unknown Customer';
        const creatorName = creator?.username || creator?.name || 'System';
        
        const emailContent = {
          subject: `New Work Order Created: ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1890ff;">New Work Order Created</h2>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Title:</strong> ${title}</p>
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Status:</strong> ${status || 'New'}</p>
                <p><strong>Due By:</strong> ${dueDateFormatted}</p>
                <p><strong>Created By:</strong> ${creatorName}</p>
              </div>
              
              <p style="margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/workOrders/detail?id=${id}"
                   style="background-color: #1890ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  View Work Order
                </a>
              </p>
              
              <p style="margin-top: 30px; color: #666; font-size: 12px;">
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
          logs.push(`📧 Attempting to send creation notification to ${user.email}...`);
          
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
              trigger: 'work_order_creation',
              triggerDetails: {
                workOrderId: id,
                workOrderTitle: title,
                propertyName,
                customerName,
                creatorName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'success',
              deliveryTime: emailDuration,
              relatedEntity: 'work-order',
              relatedEntityId: id,
            });
          } catch (err) {
            logs.push(`❌ Notification delivery failed to ${user.email}: ${err.message}`);
            emailStats.failed++;
            
            // Log failed email
            await strapi.service('api::email-log.email-log').logEmail({
              to: user.email,
              subject: emailContent.subject,
              trigger: 'work_order_creation',
              triggerDetails: {
                workOrderId: id,
                workOrderTitle: title,
                propertyName,
                customerName,
                creatorName,
                username: user.username || user.name || 'Unknown',
              },
              status: 'failed',
              error: err.message,
              relatedEntity: 'work-order',
              relatedEntityId: id,
            });
          }
        }

        // Summary
        logs.push(`📊 Work Order Creation Notification Summary:`);
        logs.push(`   • Total users: ${emailStats.total}`);
        logs.push(`   • Successful: ${emailStats.successful}`);
        logs.push(`   • Failed: ${emailStats.failed}`);
        logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);
        
        console.log('Work Order Creation Notification:', logs.join('\n'));
        
        return logs;
      } catch (error) {
        logs.push(`❌ Error sending creation notifications: ${error.message}`);
        console.error('Work order creation notification error:', error);
        return logs;
      }
    },

    async sendChangeNotification(workOrder, changes) {
      const logs = [];

      // Check if email alerts are enabled (defaults to false if not set)
      const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
      if (!emailAlertsEnabled) {
        logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
        console.log('Work Order Change Notification:', logs.join('\n'));
        return logs;
      }

      try {
        const { property, customer, title, id } = workOrder;
        
        // Collect all unique users from property and customer
        const allUsers = new Set();
        
        // Add users from property
        if (property?.users) {
          property.users.forEach(user => allUsers.add(user));
        }
        
        // Add users from customer
        if (customer?.users) {
          customer.users.forEach(user => allUsers.add(user));
        }
        
        const uniqueUsers = Array.from(allUsers);
        
        // Filter users who have opted in to receive work order notifications
        const optedInUsers = uniqueUsers.filter(user => user.receiveWorkOrderNotifications !== false);
        
        logs.push(`Found ${uniqueUsers.length} associated users for work order notification`);
        logs.push(`${optedInUsers.length} of them have opted in to receive work order notifications`);
        
        if (optedInUsers.length === 0) {
          logs.push('No users opted in for work order notifications, skipping email notifications');
          return logs;
        }
        
        // Create email content
        const changesHtml = changes.map(change => `<li>${change}</li>`).join('');
        const propertyName = property?.name || 'Unknown Property';
        const customerName = customer?.name || 'Unknown Customer';
        
        const emailContent = {
          subject: `Work Order Updated: ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1890ff;">Work Order Updated</h2>
              <p><strong>Work Order:</strong> ${title}</p>
              <p><strong>Property:</strong> ${propertyName}</p>
              <p><strong>Customer:</strong> ${customerName}</p>
              
              <h3 style="color: #666;">Changes Made:</h3>
              <ul style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                ${changesHtml}
              </ul>
              
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
          logs.push(`📧 Attempting to send email to ${user.email} (${user.username || user.name || 'Unknown'})...`);
          
          try {
            const emailStart = Date.now();
            await strapi.plugins['email'].services.email.send({
              ...emailContent,
              to: user.email,
              from: 'noreply@reportrack.com',
            });
            const emailDuration = Date.now() - emailStart;
            logs.push(`✅ Email delivered successfully to ${user.email} (${emailDuration}ms)`);
            emailStats.successful++;
          } catch (err) {
            logs.push(`❌ Email delivery failed to ${user.email}: ${err.message}`);
            logs.push(`   Error details: ${JSON.stringify({
              code: err.code,
              command: err.command,
              response: err.response,
              responseCode: err.responseCode
            })}`);
            emailStats.failed++;
          }
        }

        // Summary statistics
        logs.push(`📊 Email Delivery Summary:`);
        logs.push(`   • Total users: ${emailStats.total}`);
        logs.push(`   • Attempted: ${emailStats.attempted}`);
        logs.push(`   • Successful: ${emailStats.successful}`);
        logs.push(`   • Failed: ${emailStats.failed}`);
        logs.push(`   • Skipped (no email): ${emailStats.skipped}`);
        logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);
        
        // Log the notification
        console.log('Work Order Change Notification:', logs.join('\n'));
        
        return logs;
      } catch (error) {
        logs.push(`❌ Error sending work order notifications: ${error.message}`);
        console.error('Work order notification error:', error);
        return logs;
      }
    },
  })
);
