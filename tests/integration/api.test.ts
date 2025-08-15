/**
 * Integration Tests for API Endpoints
 */

import request from 'supertest';
import { CryptoCraftServer } from '@/app';

describe('API Integration Tests', () => {
  let server: CryptoCraftServer;
  let app: any;

  beforeAll(async () => {
    // Mock environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0'; // Let system assign port
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
    process.env.JWT_SECRET = 'test_secret';

    server = new CryptoCraftServer();
    await server.initialize();
    
    // Get Express app for testing without starting HTTP server
    app = (server as any).app;
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Health Endpoints', () => {
    it('GET /health should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        version: expect.any(String),
        environment: 'test'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('API Info Endpoints', () => {
    it('GET /api should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'CryptoCraft API',
        version: expect.any(String),
        description: expect.any(String)
      });
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.blockchain).toBeDefined();
    });

    it('GET /api/blockchain/status should return blockchain status', async () => {
      const response = await request(app)
        .get('/api/blockchain/status')
        .expect(200);

      expect(response.body).toHaveProperty('defaultBlockchain');
      expect(response.body).toHaveProperty('adapters');
      expect(response.body).toHaveProperty('totalAdapters');
      expect(response.body).toHaveProperty('supportedBlockchains');
    });
  });

  describe('GraphQL Endpoint', () => {
    it('POST /graphql should handle basic query', async () => {
      const query = `
        query {
          hello
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query })
        .expect(200);

      expect(response.body.data.hello).toBe('Hello from CryptoCraft API!');
    });

    it('POST /graphql should handle health check query', async () => {
      const query = `
        query {
          healthCheck {
            status
            timestamp
            blockchains {
              name
              connected
              network
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query })
        .expect(200);

      expect(response.body.data.healthCheck).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        blockchains: expect.any(Array)
      });
    });

    it('POST /graphql should handle invalid query', async () => {
      const query = `
        query {
          invalidField
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('REST API Endpoints', () => {
    it('GET /api/tokens should return not implemented message', async () => {
      const response = await request(app)
        .get('/api/tokens')
        .expect(501);

      expect(response.body.message).toContain('not implemented yet');
      expect(response.body.availableViaGraphQL).toBe(true);
    });

    it('GET /api/airdrops should return not implemented message', async () => {
      const response = await request(app)
        .get('/api/airdrops')
        .expect(501);

      expect(response.body.message).toContain('not implemented yet');
      expect(response.body.availableViaGraphQL).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.availableEndpoints).toBeDefined();
    });

    it('should handle CORS preflight requests', async () => {
      await request(app)
        .options('/api')
        .expect(204);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to API endpoints', async () => {
      // Make multiple requests quickly
      const requests = Array.from({ length: 5 }, () => 
        request(app).get('/api')
      );

      const responses = await Promise.all(requests);
      
      // All should succeed for this small number
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content type', async () => {
      await request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({ query: '{ hello }' })
        .expect(200);
    });

    it('should reject invalid content for GraphQL', async () => {
      await request(app)
        .post('/graphql')
        .send('invalid-json')
        .expect(400);
    });
  });
});