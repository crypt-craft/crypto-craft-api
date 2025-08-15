import request from 'supertest';
import { CryptoCraftServer } from '../../src/app';
import { AuthService } from '../../src/services/AuthService';

describe('DB_OFF_MODE stateless flows', () => {
  let server: CryptoCraftServer;
  let app: any;
  let authService: AuthService;

  const wallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

  beforeAll(async () => {
    process.env.DB_OFF_MODE = 'true';
    process.env.AUTH_STATELESS_MODE = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_please_change';
    server = new CryptoCraftServer();
    await server.initialize();
    app = server.getApp();
    authService = new AuthService();
  });

  afterAll(async () => {
    await server.stop();
  });

  test('login works without DB and returns JWT', async () => {
    const { message, timestamp } = authService.generateAuthMessage(wallet, 'login');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ walletAddress: wallet, signature: 'mock_sig', message, timestamp })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  test('claim-direct returns unsigned transfer without DB', async () => {
    const { message, timestamp } = authService.generateAuthMessage(wallet, 'login');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ walletAddress: wallet, signature: 'mock_sig', message, timestamp })
      .expect(200);
    const token = login.body.token;

    const res = await request(app)
      .post('/api/airdrops/claim-direct')
      .set('Authorization', `Bearer ${token}`)
      .send({ mintAddress: '11111111111111111111111111111111', amount: '1', decimals: 9 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction).toBeDefined();
  });
});


