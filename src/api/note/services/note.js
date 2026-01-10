'use strict';

/**
 * note service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::note.note', ({ strapi }) => ({
  async findRecordsByUser(user, queryParams) {
    try {
      // Safety check - if no user, treat as unauthenticated
      if (!user) {
        console.warn('Note findRecordsByUser - No user provided, returning empty result');
        return {
          data: [],
          meta: {
            pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }
          }
        };
      }

      const page = queryParams?.pagination?.page || 1;
      const pageSize = queryParams?.pagination?.pageSize || 25;
      // Handle sort - could be string, array, or object from query params
      let sortParam = queryParams?.sort || 'createdAt:desc';
      // If it's an object/array, convert to string
      if (typeof sortParam === 'object') {
        sortParam = Object.values(sortParam).join(':') || 'createdAt:desc';
      }
      const sort = String(sortParam);
      const rawFilters = queryParams?.filters || {};

      console.log('Note findRecordsByUser - Input params:', {
        sort: queryParams?.sort,
        sortType: typeof queryParams?.sort,
        parsedSort: sort,
        page,
        pageSize,
        userId: user?.id,
        userRole: user?.role?.name
      });

      // Transform REST API filters to Query Engine format
      // Converts { service_record: { id: { $eq: "29599" } } } to { service_record: { id: 29599 } }
      const transformFilters = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value && typeof value === 'object') {
            // Handle $eq operator - extract the value
            if ('$eq' in value) {
              const eqValue = value.$eq;
              // Convert to number if it looks like a number
              result[key] = !isNaN(eqValue) && eqValue !== '' ? Number(eqValue) : eqValue;
            } else {
              // Recurse into nested objects
              result[key] = transformFilters(value);
            }
          } else {
            result[key] = value;
          }
        }
        return result;
      };

      const filters = transformFilters(rawFilters);

      // Get user role - handle case where role might not be populated
      let userRole = user?.role?.name;
      if (!userRole && user?.role?.id) {
        // Role exists but name not populated - fetch it
        try {
          const fullRole = await strapi.db.query('plugin::users-permissions.role').findOne({
            where: { id: user.role.id }
          });
          userRole = fullRole?.name;
        } catch (roleErr) {
          console.error('Note findRecordsByUser - Failed to fetch role:', roleErr.message);
        }
      }

      console.log('Note findRecordsByUser - Debug:', {
        rawFilters: JSON.stringify(rawFilters),
        transformedFilters: JSON.stringify(filters),
        userRole,
        userId: user?.id,
        roleId: user?.role?.id
      });

      let userFilters = {};

      if (userRole === 'Customer') {
        // Customer can see notes for properties they have access to
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
              work_order: {
                property: {
                  users: {
                    id: { $eq: user.id },
                  },
                },
              },
            },
          ],
        };
      } else if (userRole === 'Service Person') {
        // Service Person can see notes for service records they created
        userFilters = {
          service_record: {
            users_permissions_user: {
              id: user.id
            }
          }
        };
      }
      // Subscribers and Admins can see all notes (no additional filters)

      // Deep merge filters - handle case where both userFilters and filters
      // have service_record conditions that need to be combined with $and
      let combinedFilters;
      if (userFilters.service_record && filters.service_record) {
        // Both have service_record filters - combine them with $and
        const { service_record: userSR, ...restUserFilters } = userFilters;
        const { service_record: querySR, ...restFilters } = filters;
        combinedFilters = {
          ...restUserFilters,
          ...restFilters,
          $and: [
            { service_record: userSR },
            { service_record: querySR }
          ]
        };
      } else {
        // Simple merge is fine
        combinedFilters = { ...userFilters, ...filters };
      }

      // Set up query options with pagination, sorting, and user filters
      // Using simpler populate syntax to avoid potential issues
      const queryOptions = {
        where: combinedFilters,
        populate: ['property', 'customer', 'work_order', 'service_record', 'createdByUser'],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: {
          createdAt: sort.split(':')[1] === 'asc' ? 'asc' : 'desc',
        },
      };

      console.log('Note findRecordsByUser - combinedFilters:', JSON.stringify(combinedFilters, null, 2));
      console.log('Note findRecordsByUser - queryOptions:', JSON.stringify(queryOptions, null, 2));

      // Execute the query
      let result;
      try {
        result = await strapi.db
          .query('api::note.note')
          .findMany(queryOptions);
      } catch (queryError) {
        console.error('Note findRecordsByUser - Query Error:', queryError.message);
        console.error('Note findRecordsByUser - Query Error Stack:', queryError.stack);
        console.error('Note findRecordsByUser - queryOptions at error:', JSON.stringify(queryOptions, null, 2));
        throw queryError;
      }

      // Count total records for pagination meta
      let totalCount;
      try {
        totalCount = await strapi.db
          .query('api::note.note')
          .count({ where: combinedFilters });
      } catch (countError) {
        console.error('Note findRecordsByUser - Count Error:', countError.message);
        console.error('Note findRecordsByUser - Count Error Stack:', countError.stack);
        throw countError;
      }

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
    } catch (error) {
      console.error('Note findRecordsByUser - Unhandled Error:', error.message);
      console.error('Note findRecordsByUser - Error Stack:', error.stack);
      console.error('Note findRecordsByUser - Query Params:', JSON.stringify(queryParams, null, 2));
      throw error;
    }
  },

  async sendNoteNotification(note) {
    const logs = [];

    // Check if email alerts are enabled (defaults to false if not set)
    const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
    if (!emailAlertsEnabled) {
      logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
      console.log('Note Creation Notification:', logs.join('\n'));
      return logs;
    }

    try {
      // Get the full note with relations
      const fullNote = await strapi.db.query('api::note.note').findOne({
        where: { id: note.id },
        populate: {
          work_order: {
            populate: {
              property: {
                populate: ['users']
              },
              customer: {
                populate: ['users']
              }
            }
          },
          createdByUser: true
        }
      });

      if (!fullNote?.work_order) {
        logs.push('Note not associated with work order, skipping notification');
        return logs;
      }

      const { work_order, createdByUser } = fullNote;
      const { property, customer, title: workOrderTitle } = work_order;
      
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
      
      // Include all users (including note creator) who have opted in to work order notifications
      const notificationUsers = uniqueUsers.filter(user => 
        user.receiveWorkOrderNotifications !== false
      );
      
      logs.push(`Found ${uniqueUsers.length} associated users`);
      logs.push(`Sending to ${notificationUsers.length} users (including note creator, excluding users who opted out)`);
      
      if (notificationUsers.length === 0) {
        logs.push('No users to notify after filtering, skipping email notifications');
        return logs;
      }
      
      // Create email content
      const propertyName = property?.name || 'Unknown Property';
      const customerName = customer?.name || 'Unknown Customer';
      const creatorName = createdByUser?.username || createdByUser?.name || 'Someone';
      const notePreview = note.note.length > 100 ? note.note.substring(0, 100) + '...' : note.note;
      
      const emailContent = {
        subject: `New Note Added to Work Order: ${workOrderTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1890ff;">New Note Added</h2>
            <p><strong>Work Order:</strong> ${workOrderTitle}</p>
            <p><strong>Property:</strong> ${propertyName}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Note by:</strong> ${creatorName}</p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h4 style="margin-top: 0; color: #666;">Note:</h4>
              <p style="margin-bottom: 0; white-space: pre-wrap;">${notePreview}</p>
            </div>

            <p style="margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/workOrders/detail?id=${work_order.id}"
                 style="background-color: #1890ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Work Order
              </a>
            </p>

            <p style="margin-top: 20px; color: #666; font-size: 12px;">
              This is an automated notification from Reportrack.
            </p>
          </div>
        `,
      };
      
      // Send emails to all notification users
      let emailStats = {
        total: notificationUsers.length,
        attempted: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      };

      for (const user of notificationUsers) {
        if (!user.email) {
          logs.push(`⚠️  Skipping user ${user.username || user.id}: no email address`);
          emailStats.skipped++;
          continue;
        }
        
        emailStats.attempted++;
        const isCreator = user.id === createdByUser?.id;
        const userLabel = `${user.username || user.name || 'Unknown'}${isCreator ? ' (note creator)' : ''}`;
        logs.push(`📧 Attempting to send note notification to ${user.email} (${userLabel})...`);
        
        try {
          const emailStart = Date.now();
          await strapi.plugins['email'].services.email.send({
            ...emailContent,
            to: user.email,
            from: 'noreply@reportrack.com',
          });
          const emailDuration = Date.now() - emailStart;
          logs.push(`✅ Note notification delivered successfully to ${user.email} (${emailDuration}ms)`);
          emailStats.successful++;
          
          // Log successful email
          await strapi.service('api::email-log.email-log').logEmail({
            to: user.email,
            subject: emailContent.subject,
            trigger: 'work_order_note',
            triggerDetails: {
              noteId: note.id,
              workOrderId: work_order.id,
              workOrderTitle,
              propertyName,
              customerName,
              creatorName,
              username: user.username || user.name || 'Unknown',
              isCreator,
            },
            status: 'success',
            deliveryTime: emailDuration,
            relatedEntity: 'note',
            relatedEntityId: note.id,
          });
        } catch (err) {
          logs.push(`❌ Note notification delivery failed to ${user.email}: ${err.message}`);
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
            trigger: 'work_order_note',
            triggerDetails: {
              noteId: note.id,
              workOrderId: work_order.id,
              workOrderTitle,
              propertyName,
              customerName,
              creatorName,
              username: user.username || user.name || 'Unknown',
              isCreator,
            },
            status: 'failed',
            error: err.message,
            relatedEntity: 'note',
            relatedEntityId: note.id,
          });
        }
      }

      // Summary statistics
      logs.push(`📊 Note Notification Email Summary:`);
      logs.push(`   • Total eligible users: ${emailStats.total}`);
      logs.push(`   • Attempted: ${emailStats.attempted}`);
      logs.push(`   • Successful: ${emailStats.successful}`);
      logs.push(`   • Failed: ${emailStats.failed}`);
      logs.push(`   • Skipped (no email): ${emailStats.skipped}`);
      logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);
      
      // Log the notification
      console.log('Note Creation Notification:', logs.join('\n'));
      
      return logs;
    } catch (error) {
      logs.push(`❌ Error sending note notifications: ${error.message}`);
      console.error('Note notification error:', error);
      return logs;
    }
  },

  async sendPropertyNoteNotification(note) {
    const logs = [];

    // Check if email alerts are enabled (defaults to false if not set)
    const emailAlertsEnabled = process.env.SEND_EMAIL_ALERTS === 'true';
    if (!emailAlertsEnabled) {
      logs.push('📧 Email alerts disabled (SEND_EMAIL_ALERTS not set to true)');
      console.log('Property Note Creation Notification:', logs.join('\n'));
      return logs;
    }

    try {
      // Get the full note with relations
      const fullNote = await strapi.db.query('api::note.note').findOne({
        where: { id: note.id },
        populate: {
          property: {
            populate: ['users', 'customer']
          },
          createdByUser: true
        }
      });

      if (!fullNote?.property) {
        logs.push('Note not associated with property, skipping notification');
        return logs;
      }

      const { property, createdByUser } = fullNote;
      
      // Collect all unique users from property and its customer
      const allUsers = new Set();
      
      // Add users from property
      if (property?.users) {
        property.users.forEach(user => allUsers.add(user));
      }
      
      // Add users from customer if property has one
      if (property?.customer?.users) {
        property.customer.users.forEach(user => allUsers.add(user));
      }
      
      const uniqueUsers = Array.from(allUsers);
      
      // Include all users (including note creator) who have opted in to work order notifications
      const notificationUsers = uniqueUsers.filter(user => 
        user.receiveWorkOrderNotifications !== false
      );
      
      logs.push(`Found ${uniqueUsers.length} associated users for property`);
      logs.push(`Sending to ${notificationUsers.length} users (including note creator, excluding users who opted out)`);
      
      if (notificationUsers.length === 0) {
        logs.push('No users to notify after filtering, skipping email notifications');
        return logs;
      }
      
      // Create email content
      const propertyName = property?.name || 'Unknown Property';
      const customerName = property?.customer?.name || 'Unknown Customer';
      const creatorName = createdByUser?.username || createdByUser?.name || 'Someone';
      const notePreview = note.note.length > 100 ? note.note.substring(0, 100) + '...' : note.note;
      
      const emailContent = {
        subject: `New Property Note Added: ${propertyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1890ff;">New Property Note Added</h2>
            <p><strong>Property:</strong> ${propertyName}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Note by:</strong> ${creatorName}</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h4 style="margin-top: 0; color: #666;">Note:</h4>
              <p style="margin-bottom: 0; white-space: pre-wrap;">${notePreview}</p>
            </div>
            
            <p style="margin-top: 20px; color: #666; font-size: 12px;">
              This is an automated notification from Reportrack.
            </p>
          </div>
        `,
      };
      
      // Send emails to all notification users
      let emailStats = {
        total: notificationUsers.length,
        attempted: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      };

      for (const user of notificationUsers) {
        if (!user.email) {
          logs.push(`⚠️  Skipping user ${user.username || user.id}: no email address`);
          emailStats.skipped++;
          continue;
        }
        
        emailStats.attempted++;
        const isCreator = user.id === createdByUser?.id;
        const userLabel = `${user.username || user.name || 'Unknown'}${isCreator ? ' (note creator)' : ''}`;
        logs.push(`📧 Attempting to send property note notification to ${user.email} (${userLabel})...`);
        
        try {
          const emailStart = Date.now();
          await strapi.plugins['email'].services.email.send({
            ...emailContent,
            to: user.email,
            from: 'noreply@reportrack.com',
          });
          const emailDuration = Date.now() - emailStart;
          logs.push(`✅ Property note notification delivered successfully to ${user.email} (${emailDuration}ms)`);
          emailStats.successful++;
        } catch (err) {
          logs.push(`❌ Property note notification delivery failed to ${user.email}: ${err.message}`);
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
      logs.push(`📊 Property Note Notification Email Summary:`);
      logs.push(`   • Total eligible users: ${emailStats.total}`);
      logs.push(`   • Attempted: ${emailStats.attempted}`);
      logs.push(`   • Successful: ${emailStats.successful}`);
      logs.push(`   • Failed: ${emailStats.failed}`);
      logs.push(`   • Skipped (no email): ${emailStats.skipped}`);
      logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);
      
      // Log the notification
      console.log('Property Note Creation Notification:', logs.join('\n'));
      
      return logs;
    } catch (error) {
      logs.push(`❌ Error sending property note notifications: ${error.message}`);
      console.error('Property note notification error:', error);
      return logs;
    }
  },
}));
