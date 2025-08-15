module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/app.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/adapters/(.*)$': '<rootDir>/src/adapters/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/models/(.*)$': '<rootDir>/src/models/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/database/(.*)$': '<rootDir>/src/database/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/api/(.*)$': '<rootDir>/src/api/$1',
    '^helmet$': '<rootDir>/tests/mocks/helmet.ts',
    '^graphql-depth-limit$': '<rootDir>/tests/mocks/graphql-depth-limit.ts'
  },
  testTimeout: 10000,
  verbose: true,
  globals: {
    'ts-jest': {
      diagnostics: false
    }
  }
};