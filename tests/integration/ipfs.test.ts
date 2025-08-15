import request from 'supertest';
import { CryptoCraftServer } from '@/app';

describe('IPFS/Pinata Integration', () => {
  let server: CryptoCraftServer;
  let app: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
    process.env.JWT_SECRET = 'test_secret';
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('GET /api/ipfs/test-auth returns 401 when creds missing', async () => {
    delete process.env.PINATA_JWT;
    delete process.env.PINATA_API_KEY;
    delete process.env.PINATA_API_SECRET;

    server = new CryptoCraftServer();
    await server.initialize();
    app = (server as any).getApp();

    const res = await request(app).get('/api/ipfs/test-auth').expect(401);
    expect(res.body).toMatchObject({ code: 'PINATA_AUTH_MISSING' });

    await server.stop();
  });

  it('POST /api/ipfs/pin-json proxies to Pinata (mocked) when JWT provided', async () => {
    // Provide fake JWT (format validated by route; actual call will be mocked)
    process.env.PINATA_JWT = 'test.jwt.token';

    // Mock global fetch
    const originalFetch = (global as any).fetch;
    (global as any).fetch = jest.fn(async (url: string, init?: any) => {
      if (url.includes('/pinning/pinJSONToIPFS')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ IpfsHash: 'QmTest', PinSize: 42, Timestamp: new Date().toISOString() })
        } as any;
      }
      if (url.includes('/data/testAuthentication')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ message: 'Congratulations! You are communicating with the Pinata API!' })
        } as any;
      }
      throw new Error('Unexpected fetch url: ' + url);
    });

    try {
      server = new CryptoCraftServer();
      await server.initialize();
      app = (server as any).getApp();

      const res = await request(app)
        .post('/api/ipfs/pin-json')
        .send({ name: 'Test' })
        .expect(200);

      expect(res.body).toHaveProperty('IpfsHash', 'QmTest');
    } finally {
      (global as any).fetch = originalFetch;
      await server.stop();
    }
  });
});


