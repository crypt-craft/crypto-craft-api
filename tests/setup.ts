/**
 * Jest Test Setup Configuration
 * Global setup and teardown for tests
 */

import dotenv from 'dotenv';

// Mock logger BEFORE importing it
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
}));

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Defaults for test mode if not provided
process.env.AUTH_TEST_MODE = process.env.AUTH_TEST_MODE || 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_please_change';
process.env.SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
// Run API in full stateless mode by default in tests to avoid DB dependency
process.env.AUTH_STATELESS_MODE = process.env.AUTH_STATELESS_MODE || 'true';
process.env.DB_OFF_MODE = process.env.DB_OFF_MODE || 'true';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global setup before all tests
beforeAll(async () => {
  // Any global setup can go here
});

// Global cleanup after all tests
afterAll(async () => {
  // Any global cleanup can go here
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

export {};