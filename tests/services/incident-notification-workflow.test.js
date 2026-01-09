/**
 * Tests for Incident Notification Workflow
 *
 * This tests the two-stage notification system:
 * 1. When an incident is reported -> notify Subscribers only
 * 2. When "Send to Client" is triggered -> notify Customers only
 */
const dayjs = require('dayjs');

// Mock Strapi service for incident notification workflow
class MockServiceRecordService {
  constructor(strapi) {
    this.strapi = strapi;
    this.shouldFailEmail = null;
  }

  /**
   * Send incident notification to Subscribers only (Stage 1)
   */
  async sendIncidentNotification(serviceRecord, incident) {
    const logs = [];
    const { property, customer, service_type, id } = serviceRecord;

    // Only fetch Subscriber users from property
    const subscriberUsers = this.strapi.db.query('plugin::users-permissions.user')
      .findMany({
        where: {
          properties: property.id,
          role: { name: 'Subscriber' },
        },
        populate: ['role'],
      });

    const resolvedUsers = await subscriberUsers;
    logs.push(`Incident Report: Found ${resolvedUsers.length} Subscriber users for property ${property.id}`);

    const optedInUsers = resolvedUsers.filter(user => user.receiveIncidentNotifications !== false);
    logs.push(`${optedInUsers.length} Subscribers opted in for incident notifications`);

    if (optedInUsers.length === 0) {
      logs.push('No Subscribers opted in for incident notifications');
      return logs;
    }

    let emailStats = {
      total: optedInUsers.length,
      attempted: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };

    for (const user of optedInUsers) {
      if (!user.email) {
        logs.push(`Skipping user ${user.username || user.id}: no email address`);
        emailStats.skipped++;
        continue;
      }

      emailStats.attempted++;

      if (this.shouldFailEmail && this.shouldFailEmail(user.email)) {
        logs.push(`Notification delivery failed to ${user.email}: SMTP error`);
        emailStats.failed++;
      } else {
        logs.push(`Notification delivered successfully to ${user.email} (100ms)`);
        emailStats.successful++;
      }
    }

    logs.push(`Incident Notification Summary:`);
    logs.push(`   Total users: ${emailStats.total}`);
    logs.push(`   Successful: ${emailStats.successful}`);
    logs.push(`   Failed: ${emailStats.failed}`);
    logs.push(`   Success rate: ${emailStats.attempted > 0 ? Math.round((emailStats.successful / emailStats.attempted) * 100) : 0}%`);

    return logs;
  }

  /**
   * Update subscriber notes on an incident
   */
  async updateIncidentNotes(serviceRecordId, incidentId, subscriberNotes, user) {
    const serviceRecord = await this.strapi.db.query('api::service-record.service-record').findOne({
      where: { id: serviceRecordId }
    });

    if (!serviceRecord) {
      return { success: false, error: 'Service record not found' };
    }

    const incidents = serviceRecord.incidents || [];
    const incidentIndex = incidents.findIndex(inc => inc.id === incidentId);

    if (incidentIndex === -1) {
      return { success: false, error: 'Incident not found' };
    }

    incidents[incidentIndex] = {
      ...incidents[incidentIndex],
      subscriberNotes: subscriberNotes || null
    };

    await this.strapi.entityService.update(
      'api::service-record.service-record',
      serviceRecordId,
      { data: { incidents } }
    );

    return { success: true, incident: incidents[incidentIndex] };
  }

  /**
   * Send incident to Client (Customer) users (Stage 2)
   */
  async sendIncidentToClient(serviceRecordId, incidentId, user) {
    const logs = [];

    const serviceRecord = await this.strapi.db.query('api::service-record.service-record').findOne({
      where: { id: serviceRecordId },
      populate: {
        property: { populate: { users: true, customer: true } },
        customer: { populate: { users: true } },
        service_type: true,
      }
    });

    if (!serviceRecord) {
      return { success: false, error: 'Service record not found', logs };
    }

    const incidents = serviceRecord.incidents || [];
    const incidentIndex = incidents.findIndex(inc => inc.id === incidentId);

    if (incidentIndex === -1) {
      return { success: false, error: 'Incident not found', logs };
    }

    const incident = incidents[incidentIndex];
    const { property, customer } = serviceRecord;

    // Fetch only Customer role users
    const customerUsersFromProperty = await this.strapi.db.query('plugin::users-permissions.user')
      .findMany({
        where: {
          properties: property.id,
          role: { name: 'Customer' },
        },
        populate: ['role'],
      });

    const customerUsersFromCustomer = customer?.id ? await this.strapi.db.query('plugin::users-permissions.user')
      .findMany({
        where: {
          customers: customer.id,
          role: { name: 'Customer' },
        },
        populate: ['role'],
      }) : [];

    // Deduplicate
    const allCustomerUsers = [...customerUsersFromProperty, ...customerUsersFromCustomer];
    const uniqueCustomerUsers = Array.from(
      new Map(allCustomerUsers.map(u => [u.id, u])).values()
    );

    const optedInUsers = uniqueCustomerUsers.filter(
      u => u.receiveIncidentNotifications !== false
    );

    logs.push(`Found ${uniqueCustomerUsers.length} Customer users, ${optedInUsers.length} opted in`);

    let emailStats = { total: optedInUsers.length, attempted: 0, successful: 0, failed: 0 };

    for (const customerUser of optedInUsers) {
      if (!customerUser.email) {
        logs.push(`Skipping user ${customerUser.username || customerUser.id}: no email address`);
        continue;
      }

      emailStats.attempted++;

      if (this.shouldFailEmail && this.shouldFailEmail(customerUser.email)) {
        logs.push(`Failed to ${customerUser.email}: SMTP error`);
        emailStats.failed++;
      } else {
        logs.push(`Delivered to ${customerUser.email} (100ms)`);
        emailStats.successful++;
      }
    }

    // Update incident
    const now = new Date().toISOString();
    incidents[incidentIndex] = {
      ...incident,
      sentToClient: true,
      sentToClientAt: now,
      sentToClientBy: { id: user.id, username: user.username }
    };

    await this.strapi.db.query('api::service-record.service-record').update({
      where: { id: serviceRecordId },
      data: { incidents }
    });

    logs.push(`Send to Client Summary: ${emailStats.successful}/${emailStats.attempted} emails sent`);

    return {
      success: true,
      logs,
      emailStats,
      sentAt: now
    };
  }
}

describe('Incident Notification Workflow Tests', () => {
  let strapi;
  let service;

  beforeEach(() => {
    // Setup mock strapi
    strapi = {
      plugins: {
        email: {
          services: {
            email: {
              send: jest.fn().mockResolvedValue(true)
            }
          }
        }
      },
      db: {
        query: jest.fn((entity) => {
          if (entity === 'plugin::users-permissions.user') {
            return {
              findMany: jest.fn().mockResolvedValue([])
            };
          }
          return {
            findOne: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({})
          };
        })
      },
      entityService: {
        update: jest.fn().mockResolvedValue({})
      },
      service: jest.fn().mockReturnValue({
        logEmail: jest.fn().mockResolvedValue({})
      })
    };

    global.strapi = strapi;
    service = new MockServiceRecordService(strapi);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Stage 1: Initial Incident Notification (Subscribers Only)', () => {
    it('should send notifications only to Subscriber users', async () => {
      const subscriberUsers = [
        { id: 1, email: 'subscriber1@test.com', username: 'subscriber1', role: { name: 'Subscriber' }, receiveIncidentNotifications: true },
        { id: 2, email: 'subscriber2@test.com', username: 'subscriber2', role: { name: 'Subscriber' }, receiveIncidentNotifications: true }
      ];

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(subscriberUsers)
          };
        }
        return {
          findOne: jest.fn(),
          update: jest.fn()
        };
      });

      const serviceRecord = {
        id: 1,
        property: { id: 1, name: 'Test Property' },
        customer: { id: 1, name: 'Test Customer' },
        service_type: { service: 'Test Service' }
      };

      const incident = {
        id: 'test-incident-uuid',
        description: 'Test incident',
        severity: 'medium',
        reportedAt: new Date().toISOString(),
        reportedBy: { id: 1, username: 'serviceperson' }
      };

      const logs = await service.sendIncidentNotification(serviceRecord, incident);

      expect(logs).toContain('Incident Report: Found 2 Subscriber users for property 1');
      expect(logs).toContain('2 Subscribers opted in for incident notifications');
      expect(logs.filter(log => log.includes('Delivered')).length).toBe(2);
      expect(logs.some(log => log.includes('subscriber1@test.com'))).toBe(true);
      expect(logs.some(log => log.includes('subscriber2@test.com'))).toBe(true);
    });

    it('should NOT send notifications to Customer users', async () => {
      // Only return Subscriber users from the query
      const subscriberUsers = [
        { id: 1, email: 'subscriber@test.com', username: 'subscriber', role: { name: 'Subscriber' }, receiveIncidentNotifications: true }
      ];

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(subscriberUsers)
          };
        }
        return {
          findOne: jest.fn(),
          update: jest.fn()
        };
      });

      const serviceRecord = {
        id: 1,
        property: { id: 1, name: 'Test Property' },
        customer: { id: 1, name: 'Test Customer' },
        service_type: { service: 'Test Service' }
      };

      const incident = {
        id: 'test-incident-uuid',
        description: 'Test incident',
        severity: 'high'
      };

      const logs = await service.sendIncidentNotification(serviceRecord, incident);

      // Should only notify subscriber, not any customer
      expect(logs).toContain('Incident Report: Found 1 Subscriber users for property 1');
      expect(logs.filter(log => log.includes('customer@test.com')).length).toBe(0);
      expect(logs.filter(log => log.includes('subscriber@test.com')).length).toBe(1);
    });

    it('should skip users who have opted out of notifications', async () => {
      const users = [
        { id: 1, email: 'optin@test.com', username: 'optin', role: { name: 'Subscriber' }, receiveIncidentNotifications: true },
        { id: 2, email: 'optout@test.com', username: 'optout', role: { name: 'Subscriber' }, receiveIncidentNotifications: false }
      ];

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(users)
          };
        }
        return { findOne: jest.fn(), update: jest.fn() };
      });

      const serviceRecord = { id: 1, property: { id: 1 }, customer: { id: 1 }, service_type: { service: 'Test' } };
      const incident = { id: 'test', description: 'Test' };

      const logs = await service.sendIncidentNotification(serviceRecord, incident);

      expect(logs).toContain('1 Subscribers opted in for incident notifications');
      expect(logs.filter(log => log.includes('optin@test.com')).length).toBe(1);
      expect(logs.filter(log => log.includes('optout@test.com')).length).toBe(0);
    });

    it('should handle email failures gracefully', async () => {
      const users = [
        { id: 1, email: 'fail@test.com', username: 'fail', role: { name: 'Subscriber' }, receiveIncidentNotifications: true },
        { id: 2, email: 'success@test.com', username: 'success', role: { name: 'Subscriber' }, receiveIncidentNotifications: true }
      ];

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(users)
          };
        }
        return { findOne: jest.fn(), update: jest.fn() };
      });

      service.shouldFailEmail = (email) => email === 'fail@test.com';

      const serviceRecord = { id: 1, property: { id: 1 }, customer: { id: 1 }, service_type: { service: 'Test' } };
      const incident = { id: 'test', description: 'Test' };

      const logs = await service.sendIncidentNotification(serviceRecord, incident);

      expect(logs.some(log => log.includes('fail@test.com') && log.includes('failed'))).toBe(true);
      expect(logs.some(log => log.includes('success@test.com') && log.includes('Delivered'))).toBe(true);
      expect(logs.some(log => log.includes('Success rate: 50%'))).toBe(true);
    });
  });

  describe('Subscriber Notes Update', () => {
    it('should update subscriber notes on an incident', async () => {
      const existingIncident = {
        id: 'incident-123',
        description: 'Original description',
        severity: 'medium'
      };

      strapi.db.query = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          incidents: [existingIncident]
        }),
        update: jest.fn().mockResolvedValue({})
      }));

      const result = await service.updateIncidentNotes(1, 'incident-123', 'Translation: Test note', { id: 1, username: 'subscriber' });

      expect(result.success).toBe(true);
      expect(result.incident.subscriberNotes).toBe('Translation: Test note');
    });

    it('should return error if service record not found', async () => {
      strapi.db.query = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue(null)
      }));

      const result = await service.updateIncidentNotes(999, 'incident-123', 'Notes', { id: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service record not found');
    });

    it('should return error if incident not found', async () => {
      strapi.db.query = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          incidents: [{ id: 'other-incident' }]
        })
      }));

      const result = await service.updateIncidentNotes(1, 'nonexistent-incident', 'Notes', { id: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Incident not found');
    });

    it('should allow clearing subscriber notes by passing empty string', async () => {
      strapi.db.query = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          incidents: [{ id: 'incident-123', subscriberNotes: 'Old notes' }]
        }),
        update: jest.fn().mockResolvedValue({})
      }));

      const result = await service.updateIncidentNotes(1, 'incident-123', '', { id: 1 });

      expect(result.success).toBe(true);
      expect(result.incident.subscriberNotes).toBe(null);
    });
  });

  describe('Stage 2: Send to Client (Customers Only)', () => {
    it('should send notifications only to Customer users', async () => {
      const customerUsers = [
        { id: 1, email: 'customer1@test.com', username: 'customer1', role: { name: 'Customer' }, receiveIncidentNotifications: true },
        { id: 2, email: 'customer2@test.com', username: 'customer2', role: { name: 'Customer' }, receiveIncidentNotifications: true }
      ];

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(customerUsers)
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            property: { id: 1, name: 'Test Property' },
            customer: { id: 1, name: 'Test Customer' },
            service_type: { service: 'Test Service' },
            incidents: [{
              id: 'incident-123',
              description: 'Test description',
              severity: 'high',
              subscriberNotes: 'Additional context'
            }]
          }),
          update: jest.fn().mockResolvedValue({})
        };
      });

      const result = await service.sendIncidentToClient(1, 'incident-123', { id: 1, username: 'subscriber' });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Found 2 Customer users, 2 opted in');
      expect(result.logs.filter(log => log.includes('customer1@test.com')).length).toBe(1);
      expect(result.logs.filter(log => log.includes('customer2@test.com')).length).toBe(1);
      expect(result.emailStats.successful).toBe(2);
    });

    it('should NOT send to Subscriber users when sending to client', async () => {
      // Only Customer users should be returned
      const customerUsers = [
        { id: 1, email: 'customer@test.com', username: 'customer', role: { name: 'Customer' }, receiveIncidentNotifications: true }
      ];

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(customerUsers)
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            property: { id: 1 },
            customer: { id: 1 },
            service_type: { service: 'Test' },
            incidents: [{ id: 'incident-123', description: 'Test' }]
          }),
          update: jest.fn().mockResolvedValue({})
        };
      });

      const result = await service.sendIncidentToClient(1, 'incident-123', { id: 1, username: 'subscriber' });

      expect(result.success).toBe(true);
      expect(result.logs.filter(log => log.includes('subscriber@test.com')).length).toBe(0);
      expect(result.logs.filter(log => log.includes('customer@test.com')).length).toBe(1);
    });

    it('should mark incident as sent to client with timestamp and user', async () => {
      const customerUsers = [
        { id: 1, email: 'customer@test.com', username: 'customer', role: { name: 'Customer' }, receiveIncidentNotifications: true }
      ];

      let updatedIncidents = null;

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(customerUsers)
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            property: { id: 1 },
            customer: { id: 1 },
            service_type: { service: 'Test' },
            incidents: [{ id: 'incident-123', description: 'Test', sentToClient: false }]
          }),
          update: jest.fn().mockImplementation(({ data }) => {
            updatedIncidents = data.incidents;
            return Promise.resolve({});
          })
        };
      });

      const result = await service.sendIncidentToClient(1, 'incident-123', { id: 5, username: 'admin_user' });

      expect(result.success).toBe(true);
      expect(result.sentAt).toBeDefined();
      expect(updatedIncidents[0].sentToClient).toBe(true);
      expect(updatedIncidents[0].sentToClientAt).toBeDefined();
      expect(updatedIncidents[0].sentToClientBy).toEqual({ id: 5, username: 'admin_user' });
    });

    it('should allow resending to client (update timestamp)', async () => {
      const customerUsers = [
        { id: 1, email: 'customer@test.com', username: 'customer', role: { name: 'Customer' }, receiveIncidentNotifications: true }
      ];

      const originalSentAt = '2025-01-01T00:00:00.000Z';
      let updatedIncidents = null;

      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(customerUsers)
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            property: { id: 1 },
            customer: { id: 1 },
            service_type: { service: 'Test' },
            incidents: [{
              id: 'incident-123',
              description: 'Test',
              sentToClient: true,
              sentToClientAt: originalSentAt,
              sentToClientBy: { id: 1, username: 'original_sender' }
            }]
          }),
          update: jest.fn().mockImplementation(({ data }) => {
            updatedIncidents = data.incidents;
            return Promise.resolve({});
          })
        };
      });

      const result = await service.sendIncidentToClient(1, 'incident-123', { id: 2, username: 'new_sender' });

      expect(result.success).toBe(true);
      expect(updatedIncidents[0].sentToClientAt).not.toBe(originalSentAt);
      expect(updatedIncidents[0].sentToClientBy.username).toBe('new_sender');
    });

    it('should deduplicate Customer users from property and customer relations', async () => {
      const sharedCustomer = { id: 1, email: 'shared@test.com', username: 'shared', role: { name: 'Customer' }, receiveIncidentNotifications: true };

      // Return the same user from both property and customer queries
      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue([sharedCustomer])
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            property: { id: 1 },
            customer: { id: 1 },
            service_type: { service: 'Test' },
            incidents: [{ id: 'incident-123', description: 'Test' }]
          }),
          update: jest.fn().mockResolvedValue({})
        };
      });

      const result = await service.sendIncidentToClient(1, 'incident-123', { id: 1, username: 'subscriber' });

      expect(result.success).toBe(true);
      // Should only send one email, not two
      expect(result.logs.filter(log => log.includes('shared@test.com')).length).toBe(1);
    });

    it('should return error if service record not found', async () => {
      strapi.db.query = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      }));

      const result = await service.sendIncidentToClient(999, 'incident-123', { id: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service record not found');
    });

    it('should return error if incident not found', async () => {
      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return { findMany: jest.fn().mockResolvedValue([]) };
        }
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            property: { id: 1 },
            customer: { id: 1 },
            incidents: [{ id: 'other-incident' }]
          })
        };
      });

      const result = await service.sendIncidentToClient(1, 'nonexistent', { id: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Incident not found');
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should complete full workflow: report -> add notes -> send to client', async () => {
      const subscriberUsers = [
        { id: 1, email: 'subscriber@test.com', username: 'subscriber', role: { name: 'Subscriber' }, receiveIncidentNotifications: true }
      ];
      const customerUsers = [
        { id: 2, email: 'customer@test.com', username: 'customer', role: { name: 'Customer' }, receiveIncidentNotifications: true }
      ];

      // Step 1: Report incident - notify Subscribers
      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(subscriberUsers)
          };
        }
        return { findOne: jest.fn(), update: jest.fn() };
      });

      const serviceRecord = { id: 1, property: { id: 1 }, customer: { id: 1 }, service_type: { service: 'Test' } };
      const incident = { id: 'incident-123', description: 'Employee report' };

      const notificationLogs = await service.sendIncidentNotification(serviceRecord, incident);

      expect(notificationLogs.some(log => log.includes('subscriber@test.com'))).toBe(true);
      expect(notificationLogs.some(log => log.includes('customer@test.com'))).toBe(false);

      // Step 2: Add subscriber notes
      strapi.db.query = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          incidents: [{ id: 'incident-123', description: 'Employee report' }]
        }),
        update: jest.fn().mockResolvedValue({})
      }));

      const notesResult = await service.updateIncidentNotes(1, 'incident-123', 'Spanish translation: Reporte del empleado', { id: 1 });
      expect(notesResult.success).toBe(true);
      expect(notesResult.incident.subscriberNotes).toBe('Spanish translation: Reporte del empleado');

      // Step 3: Send to client - notify Customers
      strapi.db.query = jest.fn((entity) => {
        if (entity === 'plugin::users-permissions.user') {
          return {
            findMany: jest.fn().mockResolvedValue(customerUsers)
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            property: { id: 1 },
            customer: { id: 1 },
            service_type: { service: 'Test' },
            incidents: [{
              id: 'incident-123',
              description: 'Employee report',
              subscriberNotes: 'Spanish translation: Reporte del empleado'
            }]
          }),
          update: jest.fn().mockResolvedValue({})
        };
      });

      const sendResult = await service.sendIncidentToClient(1, 'incident-123', { id: 1, username: 'subscriber' });

      expect(sendResult.success).toBe(true);
      expect(sendResult.logs.some(log => log.includes('customer@test.com'))).toBe(true);
      expect(sendResult.logs.some(log => log.includes('subscriber@test.com'))).toBe(false);
    });
  });
});

module.exports = { MockServiceRecordService };
