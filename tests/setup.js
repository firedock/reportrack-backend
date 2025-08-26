// Test setup file for Jest
const path = require('path');

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
process.env.APP_KEYS = 'test-app-key-1,test-app-key-2';
process.env.API_TOKEN_SALT = 'test-api-token-salt';
process.env.TRANSFER_TOKEN_SALT = 'test-transfer-token-salt';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress logs during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
  // info: jest.fn(),
  // debug: jest.fn(),
};

// Set timeout for async operations
jest.setTimeout(30000);