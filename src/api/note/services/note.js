'use strict';

/**
 * note service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::note.note', ({ strapi }) => ({
  async findRecordsByUser(user, queryParams) {
    const page = queryParams?.pagination?.page || 1;
    const pageSize = queryParams?.pagination?.pageSize || 25;
    const sort = queryParams?.sort || 'createdAt:desc';
    const filters = queryParams?.filters || {};

    const userRole = user?.role?.name;

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
      // Service Person can see notes for work orders they're assigned to
      userFilters = {
        work_order: {
          users_permissions_user: user.id
        }
      };
    }
    // Subscribers and Admins can see all notes (no additional filters)

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
        work_order: {
          populate: ['property', 'customer'],
        },
        createdByUser: true,
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: {
        createdAt: sort.split(':')[1] === 'asc' ? 'asc' : 'desc',
      },
    };

    // Execute the query
    const result = await strapi.db
      .query('api::note.note')
      .findMany(queryOptions);

    // Count total records for pagination meta
    const totalCount = await strapi.db
      .query('api::note.note')
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

  async sendNoteNotification(note) {
    const logs = [];
    
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
        } catch (err) {
          logs.push(`❌ Note notification delivery failed to ${user.email}: ${err.message}`);
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
