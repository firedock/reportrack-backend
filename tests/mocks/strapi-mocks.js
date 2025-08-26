// Mock implementation of Strapi services without using factories
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

class MockWorkOrderService {
  async sendCreationNotification(workOrder, creator) {
    const logs = [];
    const { property, customer, title, id, status, dueBy } = workOrder;
    
    // Collect all unique users
    const allUsers = new Set();
    if (property?.users) {
      property.users.forEach(user => allUsers.add(user));
    }
    if (customer?.users) {
      customer.users.forEach(user => allUsers.add(user));
    }
    
    const uniqueUsers = Array.from(allUsers);
    const optedInUsers = uniqueUsers.filter(user => user.receiveWorkOrderNotifications !== false);
    
    logs.push(`Work Order Creation: Found ${uniqueUsers.length} associated users`);
    logs.push(`${optedInUsers.length} users opted in for notifications`);
    
    if (optedInUsers.length === 0) {
      logs.push('No users opted in for work order notifications');
      return logs;
    }
    
    // Mock email sending
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
      
      // Check if email service should fail (for testing)
      if (this.shouldFailEmail && this.shouldFailEmail(user.email)) {
        logs.push(`❌ Notification delivery failed to ${user.email}: SMTP error`);
        emailStats.failed++;
      } else {
        logs.push(`✅ Notification delivered successfully to ${user.email} (100ms)`);
        emailStats.successful++;
      }
    }
    
    logs.push(`📊 Work Order Creation Notification Summary:`);
    logs.push(`   • Total users: ${emailStats.total}`);
    logs.push(`   • Successful: ${emailStats.successful}`);
    logs.push(`   • Failed: ${emailStats.failed}`);
    logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);
    
    return logs;
  }
}

class MockNoteService {
  constructor(strapi) {
    this.strapi = strapi;
  }
  
  async sendNoteNotification(note) {
    const logs = [];
    
    // Get the full note
    const fullNote = await this.strapi.db.query('api::note.note').findOne({
      where: { id: note.id }
    });
    
    if (!fullNote?.work_order) {
      logs.push('Note not associated with work order, skipping notification');
      return logs;
    }
    
    const { work_order, createdByUser } = fullNote;
    const { property, customer, title: workOrderTitle } = work_order;
    
    const allUsers = new Set();
    if (property?.users) {
      property.users.forEach(user => allUsers.add(user));
    }
    if (customer?.users) {
      customer.users.forEach(user => allUsers.add(user));
    }
    
    const uniqueUsers = Array.from(allUsers);
    const notificationUsers = uniqueUsers.filter(user => 
      user.receiveWorkOrderNotifications !== false
    );
    
    logs.push(`Found ${uniqueUsers.length} associated users`);
    logs.push(`Sending to ${notificationUsers.length} users (including note creator, excluding users who opted out)`);
    
    if (notificationUsers.length === 0) {
      logs.push('No users to notify after filtering, skipping email notifications');
      return logs;
    }
    
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
      
      // Check if email service should fail
      if (this.shouldFailEmail && this.shouldFailEmail(user.email)) {
        logs.push(`❌ Note notification delivery failed to ${user.email}: SMTP error for user1`);
        emailStats.failed++;
      } else {
        logs.push(`✅ Note notification delivered successfully to ${user.email} (100ms)`);
        emailStats.successful++;
      }
    }
    
    logs.push(`📊 Note Notification Email Summary:`);
    logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);
    
    return logs;
  }
}

class MockAlarmService {
  constructor(strapi) {
    this.strapi = strapi;
  }
  
  async triggerAlarm(alarm, serviceRecord, triggerReason) {
    const logs = [];
    const { assignedUsers = [] } = alarm;
    
    if (assignedUsers.length === 0) {
      logs.push('No users assigned to alarm');
      
      // Update notified timestamp
      await this.strapi.db.query('api::alarm.alarm').update({
        where: { id: alarm.id },
        data: { notified: dayjs.utc().toISOString() }
      });
      
      return logs;
    }
    
    const optedInUsers = assignedUsers.filter(user => user.receiveAlarmNotifications !== false);
    
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
      
      // Check if email service should fail
      if (this.shouldFailEmail && this.shouldFailEmail(user.email)) {
        logs.push(`❌ Alarm notification delivery failed to ${user.email}: SMTP connection failed`);
        emailStats.failed++;
      } else {
        logs.push(`✅ Alarm notification delivered successfully to ${user.email} (100ms)`);
        emailStats.successful++;
      }
    }
    
    logs.push(`📊 Alarm Notification Email Summary:`);
    logs.push(`   • Total opted-in users: ${emailStats.total}`);
    logs.push(`   • Attempted: ${emailStats.attempted}`);
    logs.push(`   • Successful: ${emailStats.successful}`);
    logs.push(`   • Failed: ${emailStats.failed}`);
    logs.push(`   • Skipped (no email): ${emailStats.skipped}`);
    logs.push(`   • Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);
    
    // Update notified timestamp
    await this.strapi.db.query('api::alarm.alarm').update({
      where: { id: alarm.id },
      data: { notified: dayjs.utc().toISOString() }
    });
    
    return logs;
  }
}

module.exports = {
  MockWorkOrderService,
  MockNoteService,
  MockAlarmService
};