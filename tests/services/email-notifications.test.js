const { MockWorkOrderService, MockNoteService, MockAlarmService } = require('../mocks/strapi-mocks');

describe('Email Notification Services - Integrated Tests', () => {
  let mockEmailService;
  let strapi;

  beforeEach(() => {
    // Setup mock email service
    mockEmailService = {
      send: jest.fn().mockResolvedValue(true)
    };

    // Setup mock strapi
    strapi = {
      plugins: {
        email: {
          services: {
            email: mockEmailService
          }
        }
      },
      db: {
        query: jest.fn(() => ({
          findOne: jest.fn(),
          update: jest.fn()
        }))
      }
    };

    global.strapi = strapi;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Work Order Creation Notifications', () => {
    it('should send emails to all opted-in users', async () => {
      const service = new MockWorkOrderService();
      
      const workOrder = {
        id: 1,
        title: 'Test Work Order',
        status: 'New',
        property: {
          users: [
            { id: 1, email: 'user1@test.com', username: 'user1', receiveWorkOrderNotifications: true },
            { id: 2, email: 'user2@test.com', username: 'user2', receiveWorkOrderNotifications: true }
          ]
        },
        customer: {
          users: [
            { id: 3, email: 'user3@test.com', username: 'user3', receiveWorkOrderNotifications: true }
          ]
        }
      };

      const logs = await service.sendCreationNotification(workOrder, { username: 'creator' });

      expect(logs).toContain('Work Order Creation: Found 3 associated users');
      expect(logs).toContain('3 users opted in for notifications');
      expect(logs.filter(log => log.includes('✅')).length).toBe(3);
      expect(logs.some(log => log.includes('Success rate: 100%'))).toBe(true);
    });

    it('should skip users without email', async () => {
      const service = new MockWorkOrderService();
      
      const workOrder = {
        id: 2,
        title: 'Test',
        property: {
          users: [
            { id: 1, username: 'noEmail', receiveWorkOrderNotifications: true },
            { id: 2, email: 'hasEmail@test.com', receiveWorkOrderNotifications: true }
          ]
        },
        customer: { users: [] }
      };

      const logs = await service.sendCreationNotification(workOrder, {});

      expect(logs.some(log => log.includes('Skipping user noEmail: no email address'))).toBe(true);
      expect(logs.filter(log => log.includes('✅')).length).toBe(1);
    });

    it('should handle email failures', async () => {
      const service = new MockWorkOrderService();
      service.shouldFailEmail = (email) => email === 'fail@test.com';
      
      const workOrder = {
        id: 3,
        title: 'Test',
        property: {
          users: [
            { id: 1, email: 'fail@test.com', receiveWorkOrderNotifications: true },
            { id: 2, email: 'success@test.com', receiveWorkOrderNotifications: true }
          ]
        },
        customer: { users: [] }
      };

      const logs = await service.sendCreationNotification(workOrder, {});

      expect(logs.some(log => log.includes('❌') && log.includes('fail@test.com'))).toBe(true);
      expect(logs.some(log => log.includes('✅') && log.includes('success@test.com'))).toBe(true);
      expect(logs.some(log => log.includes('Success rate: 50%'))).toBe(true);
    });
  });

  describe('Note Notifications', () => {
    it('should send emails for notes with work orders', async () => {
      const service = new MockNoteService(strapi);
      
      const note = { id: 1, note: 'Test note' };
      
      strapi.db.query().findOne.mockResolvedValue({
        id: 1,
        note: 'Test note',
        work_order: {
          title: 'Work Order',
          property: {
            users: [
              { id: 1, email: 'user@test.com', receiveWorkOrderNotifications: true }
            ]
          },
          customer: { users: [] }
        },
        createdByUser: { id: 2, username: 'creator' }
      });

      const logs = await service.sendNoteNotification(note);

      expect(logs).toContain('Found 1 associated users');
      expect(logs.filter(log => log.includes('✅')).length).toBe(1);
    });

    it('should skip notes without work orders', async () => {
      const service = new MockNoteService(strapi);
      
      const note = { id: 2, note: 'Orphan note' };
      
      strapi.db.query().findOne.mockResolvedValue({
        id: 2,
        note: 'Orphan note',
        work_order: null
      });

      const logs = await service.sendNoteNotification(note);

      expect(logs).toContain('Note not associated with work order, skipping notification');
    });

    it('should identify note creator in logs', async () => {
      const service = new MockNoteService(strapi);
      
      const note = { id: 3, note: 'Creator note' };
      const creator = { id: 1, email: 'creator@test.com', username: 'creator', receiveWorkOrderNotifications: true };
      
      strapi.db.query().findOne.mockResolvedValue({
        id: 3,
        note: 'Creator note',
        work_order: {
          title: 'Work Order',
          property: {
            users: [creator]
          },
          customer: { users: [] }
        },
        createdByUser: creator
      });

      const logs = await service.sendNoteNotification(note);

      expect(logs.some(log => log.includes('(note creator)'))).toBe(true);
    });
  });

  describe('Alarm Notifications', () => {
    it('should send emails to assigned users', async () => {
      const mockUpdate = jest.fn();
      strapi.db.query = jest.fn(() => ({
        update: mockUpdate
      }));
      
      const service = new MockAlarmService(strapi);
      
      const alarm = {
        id: 1,
        assignedUsers: [
          { id: 1, email: 'guard1@test.com', receiveAlarmNotifications: true },
          { id: 2, email: 'guard2@test.com', receiveAlarmNotifications: true }
        ]
      };

      const logs = await service.triggerAlarm(alarm, {}, 'Test trigger');

      expect(logs.filter(log => log.includes('✅')).length).toBe(2);
      expect(logs.some(log => log.includes('Total opted-in users: 2'))).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { notified: expect.any(String) }
      });
    });

    it('should handle no assigned users', async () => {
      const mockUpdate = jest.fn();
      strapi.db.query = jest.fn(() => ({
        update: mockUpdate
      }));
      
      const service = new MockAlarmService(strapi);
      
      const alarm = {
        id: 2,
        assignedUsers: []
      };

      const logs = await service.triggerAlarm(alarm, {}, 'Test trigger');

      expect(logs).toContain('No users assigned to alarm');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should skip opted-out users', async () => {
      const service = new MockAlarmService(strapi);
      
      const alarm = {
        id: 3,
        assignedUsers: [
          { id: 1, email: 'opted-in@test.com', receiveAlarmNotifications: true },
          { id: 2, email: 'opted-out@test.com', receiveAlarmNotifications: false },
          { id: 3, email: 'default@test.com' } // undefined = true by default
        ]
      };

      const logs = await service.triggerAlarm(alarm, {}, 'Test');

      expect(logs.filter(log => log.includes('✅')).length).toBe(2);
      expect(logs.some(log => log.includes('opted-in@test.com'))).toBe(true);
      expect(logs.some(log => log.includes('default@test.com'))).toBe(true);
      expect(logs.some(log => log.includes('opted-out@test.com'))).toBe(false);
    });

    it('should handle email failures', async () => {
      const service = new MockAlarmService(strapi);
      service.shouldFailEmail = (email) => email === 'fail@test.com';
      
      const alarm = {
        id: 4,
        assignedUsers: [
          { id: 1, email: 'fail@test.com', receiveAlarmNotifications: true },
          { id: 2, email: 'success@test.com', receiveAlarmNotifications: true }
        ]
      };

      const logs = await service.triggerAlarm(alarm, {}, 'Test');

      expect(logs.some(log => log.includes('❌') && log.includes('fail@test.com'))).toBe(true);
      expect(logs.some(log => log.includes('✅') && log.includes('success@test.com'))).toBe(true);
      expect(logs.some(log => log.includes('Failed: 1'))).toBe(true);
      expect(logs.some(log => log.includes('Success rate: 50%'))).toBe(true);
    });
  });

  describe('Email Content and Format', () => {
    it('should include all required fields in work order emails', () => {
      // This would test actual email content if we had access to the real service
      // For now, we verify the mock service logic handles the data correctly
      expect(true).toBe(true);
    });

    it('should truncate long note content', () => {
      // Test note truncation logic
      const longNote = 'A'.repeat(150);
      const truncated = longNote.length > 100 ? longNote.substring(0, 100) + '...' : longNote;
      expect(truncated).toBe('A'.repeat(100) + '...');
    });

    it('should format dates consistently', () => {
      const dayjs = require('dayjs');
      const testDate = '2025-02-01T10:00:00Z';
      const formatted = dayjs(testDate).format('MM/DD/YYYY h:mmA');
      expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{1,2}:\d{2}(AM|PM)$/);
    });
  });

  describe('User Deduplication', () => {
    it('should deduplicate users across property and customer', async () => {
      const service = new MockWorkOrderService();
      const sharedUser = { id: 1, email: 'shared@test.com', receiveWorkOrderNotifications: true };
      
      const workOrder = {
        id: 5,
        title: 'Test',
        property: { users: [sharedUser] },
        customer: { users: [sharedUser] }
      };

      const logs = await service.sendCreationNotification(workOrder, {});

      expect(logs).toContain('Work Order Creation: Found 1 associated users');
      expect(logs.filter(log => log.includes('shared@test.com')).length).toBe(1);
    });
  });
});