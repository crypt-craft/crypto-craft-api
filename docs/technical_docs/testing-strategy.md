# Testing Strategy & Implementation Plan

## Overview

CryptoCraft API використовує комплексну стратегію тестування для забезпечення високої якості коду, надійності блокчейн операцій та стабільності API. Тестування охоплює всі рівні: від unit тестів до end-to-end тестування в production-подібному середовищі.

## Testing Pyramid

### 1. Unit Tests (70% coverage target)
**Призначення**: Тестування ізольованих компонентів та функцій.

**Технології**:
- **Jest** - Test runner та assertion library
- **ts-jest** - TypeScript підтримка для Jest
- **@testing-library/jest-dom** - DOM testing utilities

**Структура**:
```
tests/unit/
├── adapters/
│   ├── solana/
│   │   ├── SolanaAdapter.test.ts
│   │   ├── SolanaTokenService.test.ts
│   │   └── SolanaAirdropService.test.ts
│   └── BlockchainManager.test.ts
├── services/
│   ├── TokenService.test.ts
│   ├── AirdropService.test.ts
│   ├── LiquidityService.test.ts
│   └── AnalyticsService.test.ts
├── utils/
│   ├── validation.test.ts
│   ├── encryption.test.ts
│   └── logger.test.ts
├── models/
│   ├── Token.test.ts
│   ├── User.test.ts
│   └── Transaction.test.ts
└── queue/
    ├── tokenQueue.test.ts
    └── airdropQueue.test.ts
```

**Приклад Unit тесту**:
```typescript
// tests/unit/services/TokenService.test.ts
import { TokenService } from '../../../src/services/TokenService';
import { mockSolanaAdapter } from '../../mocks/SolanaAdapter';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockAdapter: jest.Mocked<SolanaAdapter>;

  beforeEach(() => {
    mockAdapter = mockSolanaAdapter();
    tokenService = new TokenService(mockAdapter);
  });

  describe('createToken', () => {
    it('should create fungible token successfully', async () => {
      // Arrange
      const tokenParams = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 9,
        type: 'fungible'
      };
      
      mockAdapter.createToken.mockResolvedValue('token_mint_address');

      // Act
      const result = await tokenService.createToken(tokenParams);

      // Assert
      expect(result).toEqual({
        mintAddress: 'token_mint_address',
        status: 'pending'
      });
      expect(mockAdapter.createToken).toHaveBeenCalledWith(tokenParams);
    });

    it('should throw error for invalid token parameters', async () => {
      // Arrange
      const invalidParams = {
        name: '',
        symbol: 'TEST',
        totalSupply: '0',
        decimals: 9,
        type: 'fungible'
      };

      // Act & Assert
      await expect(tokenService.createToken(invalidParams))
        .rejects.toThrow('Invalid token name');
    });
  });
});
```

### 2. Integration Tests (20% coverage target)
**Призначення**: Тестування взаємодії між компонентами, API endpoints та базою даних.

**Технології**:
- **Supertest** - HTTP testing
- **Testcontainers** - PostgreSQL та Redis в Docker
- **Nock** - HTTP mocking для зовнішніх API

**Структура**:
```
tests/integration/
├── api/
│   ├── graphql/
│   │   ├── tokenResolvers.test.ts
│   │   ├── airdropResolvers.test.ts
│   │   └── analyticsResolvers.test.ts
│   └── rest/
│       ├── tokenRoutes.test.ts
│       ├── airdropRoutes.test.ts
│       └── healthRoutes.test.ts
├── database/
│   ├── migrations.test.ts
│   ├── models.test.ts
│   └── queries.test.ts
├── blockchain/
│   ├── solana-integration.test.ts
│   └── transaction-flow.test.ts
└── queue/
    ├── job-processing.test.ts
    └── error-handling.test.ts
```

**Приклад Integration тесту**:
```typescript
// tests/integration/api/graphql/tokenResolvers.test.ts
import { createTestServer } from '../../helpers/testServer';
import { seedTestData } from '../../helpers/seedData';

describe('Token GraphQL Resolvers', () => {
  let server: TestServer;
  let db: TestDatabase;

  beforeAll(async () => {
    server = await createTestServer();
    db = server.database;
  });

  beforeEach(async () => {
    await db.clean();
    await seedTestData(db);
  });

  afterAll(async () => {
    await server.close();
  });

  describe('createToken mutation', () => {
    it('should create token and return GraphQL response', async () => {
      const mutation = `
        mutation CreateToken($input: CreateTokenInput!) {
          createToken(input: $input) {
            id
            mintAddress
            name
            symbol
            totalSupply
            status
          }
        }
      `;

      const variables = {
        input: {
          name: 'Integration Test Token',
          symbol: 'ITT',
          totalSupply: '1000000',
          decimals: 9,
          type: 'FUNGIBLE'
        }
      };

      const response = await server.graphql(mutation, variables, {
        authorization: 'Bearer test_jwt_token'
      });

      expect(response.data.createToken).toEqual({
        id: expect.any(String),
        mintAddress: expect.stringMatching(/^[A-Za-z0-9]{32,44}$/),
        name: 'Integration Test Token',
        symbol: 'ITT',
        totalSupply: '1000000',
        status: 'PENDING'
      });
    });
  });
});
```

### 3. End-to-End Tests (10% coverage target)
**Призначення**: Тестування повних користувацьких сценаріїв від UI до blockchain.

**Технології**:
- **Playwright** - Browser automation
- **Docker Compose** - Повне середовище для тестування

**Структура**:
```
tests/e2e/
├── user-journeys/
│   ├── token-creation-flow.test.ts
│   ├── airdrop-campaign.test.ts
│   └── payment-integration.test.ts
├── api-flows/
│   ├── authentication.test.ts
│   ├── rate-limiting.test.ts
│   └── error-handling.test.ts
├── blockchain-flows/
│   ├── solana-devnet.test.ts
│   └── transaction-confirmation.test.ts
└── helpers/
    ├── testEnvironment.ts
    └── blockchainHelpers.ts
```

**Приклад E2E тесту**:
```typescript
// tests/e2e/user-journeys/token-creation-flow.test.ts
import { test, expect } from '@playwright/test';
import { TestBlockchain } from '../helpers/testBlockchain';

test.describe('Token Creation Flow', () => {
  let blockchain: TestBlockchain;

  test.beforeAll(async () => {
    blockchain = new TestBlockchain('devnet');
    await blockchain.setup();
  });

  test('complete token creation and airdrop flow', async ({ request }) => {
    // Step 1: Authenticate user
    const authResponse = await request.post('/api/auth/login', {
      data: {
        walletAddress: blockchain.testWallet.publicKey,
        signature: await blockchain.signMessage('login'),
        message: 'login'
      }
    });
    
    const { token } = await authResponse.json();
    
    // Step 2: Create token
    const tokenResponse = await request.post('/api/tokens', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        name: 'E2E Test Token',
        symbol: 'E2E',
        totalSupply: '100000',
        decimals: 9,
        type: 'fungible'
      }
    });
    
    const tokenData = await tokenResponse.json();
    expect(tokenData.status).toBe('pending');
    
    // Step 3: Wait for token creation confirmation
    await blockchain.waitForConfirmation(tokenData.transactionHash);
    
    // Step 4: Create airdrop campaign
    const airdropResponse = await request.post('/api/airdrops', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        tokenMintAddress: tokenData.mintAddress,
        recipients: [
          { address: blockchain.testRecipient1, amount: '100' },
          { address: blockchain.testRecipient2, amount: '200' }
        ]
      }
    });
    
    const airdropData = await airdropResponse.json();
    
    // Step 5: Execute airdrop
    const executeResponse = await request.post(
      `/api/airdrops/${airdropData.id}/execute`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    
    expect(executeResponse.status()).toBe(200);
    
    // Step 6: Verify airdrop completion
    const finalStatus = await request.get(
      `/api/airdrops/${airdropData.id}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    
    const finalData = await finalStatus.json();
    expect(finalData.status).toBe('completed');
    expect(finalData.successfulTransfers).toBe(2);
  });
});
```

## Test Data Management

### Test Database Setup
```typescript
// tests/helpers/testDatabase.ts
import { Client } from 'pg';
import { migrate } from '../database/migrations';

export class TestDatabase {
  private client: Client;
  private dbName: string;

  constructor() {
    this.dbName = `test_db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async setup(): Promise<void> {
    // Create test database
    const adminClient = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'postgres'
    });
    
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${this.dbName}"`);
    await adminClient.end();

    // Connect to test database and run migrations
    this.client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: this.dbName
    });
    
    await this.client.connect();
    await migrate(this.client);
  }

  async clean(): Promise<void> {
    // Clean all tables but keep schema
    const tables = await this.client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    for (const { tablename } of tables.rows) {
      await this.client.query(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }

  async teardown(): Promise<void> {
    await this.client.end();
    
    const adminClient = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'postgres'
    });
    
    await adminClient.connect();
    await adminClient.query(`DROP DATABASE "${this.dbName}"`);
    await adminClient.end();
  }
}
```

### Mock Data Factory
```typescript
// tests/helpers/factories.ts
import { Factory } from 'fishery';
import { User, Token, AirdropCampaign } from '../../src/models';

export const userFactory = Factory.define<User>(({ sequence }) => ({
  id: `user-${sequence}`,
  walletAddress: `wallet-address-${sequence}`,
  email: `user${sequence}@test.com`,
  createdAt: new Date(),
  updatedAt: new Date()
}));

export const tokenFactory = Factory.define<Token>(({ sequence, associations }) => ({
  id: `token-${sequence}`,
  mintAddress: `mint-address-${sequence}`,
  creator: associations.creator || userFactory.build(),
  name: `Test Token ${sequence}`,
  symbol: `TTK${sequence}`,
  totalSupply: '1000000',
  decimals: 9,
  tokenType: 'fungible',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
}));

export const airdropCampaignFactory = Factory.define<AirdropCampaign>(({ sequence, associations }) => ({
  id: `airdrop-${sequence}`,
  creator: associations.creator || userFactory.build(),
  token: associations.token || tokenFactory.build(),
  name: `Test Airdrop ${sequence}`,
  totalAmount: '10000',
  recipientsCount: 100,
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date()
}));
```

## Performance Testing

### Load Testing with Artillery
```yaml
# tests/performance/load-test.yml
config:
  target: http://localhost:3000
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  processor: "./helpers/performance-helpers.js"

scenarios:
  - name: "API Health Check"
    weight: 20
    flow:
      - get:
          url: "/health"
      - think: 1

  - name: "GraphQL Token Query"
    weight: 30
    flow:
      - post:
          url: "/graphql"
          headers:
            Content-Type: "application/json"
          json:
            query: "{ tokens(limit: 10) { id name symbol } }"
      - think: 2

  - name: "Token Creation Flow"
    weight: 20
    flow:
      - function: "authenticateUser"
      - post:
          url: "/api/tokens"
          headers:
            Authorization: "Bearer {{ authToken }}"
            Content-Type: "application/json"
          json:
            name: "Load Test Token {{ $randomString() }}"
            symbol: "LTT{{ $randomInt(1000, 9999) }}"
            totalSupply: "{{ $randomInt(1000, 1000000) }}"
            decimals: 9
            type: "fungible"
      - think: 3

  - name: "Airdrop Campaign"
    weight: 30
    flow:
      - function: "authenticateUser"
      - function: "createAirdropCampaign"
      - think: 5
```

### Stress Testing
```typescript
// tests/performance/stress.test.ts
import { performance } from 'perf_hooks';
import { TestServer } from '../helpers/testServer';

describe('Stress Tests', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  test('should handle 1000 concurrent token creations', async () => {
    const startTime = performance.now();
    
    const promises = Array.from({ length: 1000 }, (_, i) =>
      server.createToken({
        name: `Stress Token ${i}`,
        symbol: `ST${i}`,
        totalSupply: '1000',
        decimals: 9,
        type: 'fungible'
      })
    );

    const results = await Promise.allSettled(promises);
    const endTime = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Processed ${successful} successful, ${failed} failed in ${endTime - startTime}ms`);
    
    // At least 95% should succeed
    expect(successful / 1000).toBeGreaterThan(0.95);
    
    // Should complete within 30 seconds
    expect(endTime - startTime).toBeLessThan(30000);
  });
});
```

## Security Testing

### Input Validation Tests
```typescript
// tests/security/validation.test.ts
describe('Input Validation Security', () => {
  test('should prevent SQL injection in token name', async () => {
    const maliciousInput = {
      name: "'; DROP TABLE tokens; --",
      symbol: 'MAL',
      totalSupply: '1000',
      decimals: 9,
      type: 'fungible'
    };

    await expect(tokenService.createToken(maliciousInput))
      .rejects.toThrow('Invalid token name');
  });

  test('should prevent XSS in token description', async () => {
    const xssInput = {
      name: 'XSS Token',
      symbol: 'XSS',
      description: '<script>alert("xss")</script>',
      totalSupply: '1000',
      decimals: 9,
      type: 'fungible'
    };

    const result = await tokenService.createToken(xssInput);
    expect(result.description).not.toContain('<script>');
    expect(result.description).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });
});
```

### Authentication & Authorization Tests
```typescript
// tests/security/auth.test.ts
describe('Authentication Security', () => {
  test('should reject expired JWT tokens', async () => {
    const expiredToken = generateExpiredJWT();
    
    const response = await request(app)
      .post('/api/tokens')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(validTokenData);
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Token expired');
  });

  test('should reject malformed JWT tokens', async () => {
    const malformedToken = 'invalid.jwt.token';
    
    const response = await request(app)
      .post('/api/tokens')
      .set('Authorization', `Bearer ${malformedToken}`)
      .send(validTokenData);
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid token');
  });
});
```

## Testing Configuration

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/migrations/**',
    '!src/seeds/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts'
};
```

### Environment Configuration
```typescript
// tests/setup.ts
import { config } from 'dotenv';
import { setupTestDatabase } from './helpers/testDatabase';

// Load test environment variables
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  await setupTestDatabase();
});

// Global test teardown
afterAll(async () => {
  await teardownTestDatabase();
});

// Increase timeout for blockchain operations
jest.setTimeout(30000);
```

## Continuous Testing

### Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && npm run test:unit",
      "pre-push": "npm run test:integration"
    }
  },
  "lint-staged": {
    "src/**/*.ts": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

### Test Scripts
```json
// package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:smoke": "jest tests/smoke",
    "test:performance": "artillery run tests/performance/load-test.yml",
    "test:security": "jest tests/security"
  }
}
```

## Quality Gates

### Test Coverage Requirements
- **Overall**: 85% line coverage
- **Services**: 90% line coverage
- **Blockchain Adapters**: 95% line coverage
- **Critical Paths**: 100% line coverage

### Performance Benchmarks
- **API Response Time**: < 200ms (95th percentile)
- **GraphQL Queries**: < 500ms (complex queries)
- **Database Queries**: < 100ms (average)
- **Blockchain Operations**: < 30s (confirmation time)

### Security Standards
- **No High/Critical Vulnerabilities**: In dependencies
- **Input Validation**: 100% coverage
- **Authentication Tests**: All endpoints
- **Authorization Tests**: All protected resources

## Monitoring & Reporting

### Test Results Dashboard
- Coverage reports in HTML format
- Performance metrics visualization
- Failure trend analysis
- Flaky test detection

### Alerting
- Failed test notifications in Slack
- Performance degradation alerts
- Security vulnerability notifications
- Coverage drop warnings

Ця стратегія тестування забезпечує високу якість коду, надійність blockchain операцій та стабільність API через комплексний підхід до тестування на всіх рівнях розробки.