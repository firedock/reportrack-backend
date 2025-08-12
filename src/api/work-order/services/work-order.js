// @ts-nocheck
'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

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
          property: {
            users: {
              id: { $eq: user.id },
            },
          },
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

    async sendChangeNotification(workOrder, changes) {
      const logs = [];
      
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
