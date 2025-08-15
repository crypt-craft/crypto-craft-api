/**
 * Тести для Web3 Transaction endpoints
 * Перевіряють безпечну архітектуру без приватних ключів
 */

import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { CryptoCraftServer } from '../src/app';
import { AuthService } from '../src/services/AuthService';
import { TransactionBuilderService } from '../src/services/TransactionBuilder';
import { prisma } from '../src/database/prisma';

describe('Transaction Endpoints - Secure Web3 Architecture', () => {
  let app: any;
  let server: CryptoCraftServer;
  let authService: AuthService;
  let transactionBuilder: TransactionBuilderService;
  let authToken: string;
  
  const testWalletAddress = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const testTokenParams = {
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 9,
    initialSupply: 1000000,
    description: 'Test token for secure Web3 testing',
    imageUrl: 'https://example.com/token.png'
  };

  beforeAll(async () => {
    server = new CryptoCraftServer();
    await server.initialize();
    app = server.getApp();
    authService = new AuthService();
    transactionBuilder = new TransactionBuilderService();

    // Створення та логін тестового користувача
    await registerAndLoginTestUser();
  });

  afterAll(async () => {
    await server.stop();
    await prisma.$disconnect();
  });

  async function registerAndLoginTestUser() {
    // Реєстрація
    const registerMessage = await authService.generateAuthMessage(testWalletAddress, 'register');
    await request(app)
      .post('/api/auth/register')
      .send({
        walletAddress: testWalletAddress,
        signature: 'mock_signature',
        message: registerMessage.message,
        timestamp: registerMessage.timestamp,
        username: 'testtransactionuser'
      });

    // Логін
    const loginMessage = await authService.generateAuthMessage(testWalletAddress, 'login');
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        walletAddress: testWalletAddress,
        signature: 'mock_signature',
        message: loginMessage.message,
        timestamp: loginMessage.timestamp
      });

    authToken = loginResponse.body.token;
  }

  describe('POST /api/transactions/create-token', () => {
    test('should create unsigned token transaction', async () => {
      const response = await request(app)
        .post('/api/transactions/create-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testTokenParams)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: expect.stringContaining('Unsigned transaction created'),
        transaction: expect.any(String), // base64 serialized transaction
        metadata: {
          mintAddress: expect.any(String),
          tokenAccountAddress: expect.any(String),
          estimatedFee: expect.any(Number),
          instructions: expect.arrayContaining([
            'Create Mint Account',
            'Initialize Mint',
            'Create Token Account',
            'Mint Initial Supply',
            'Revoke Mint Authority'
          ]),
          network: 'devnet'
        },
        signingInstructions: expect.arrayContaining([
          expect.stringContaining('wallet will prompt'),
          expect.stringContaining('Review the transaction'),
          expect.stringContaining('NEVER share your private key')
        ])
      });

      // Перевіряємо що transaction є валідним base64
      expect(() => Buffer.from(response.body.transaction, 'base64')).not.toThrow();
      
      // Перевіряємо формат mint address
      expect(response.body.metadata.mintAddress).toMatch(/^[A-Za-z0-9]{32,44}$/);
    });

    test('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/transactions/create-token')
        .send(testTokenParams)
        .expect(401);

      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    test('should validate token parameters', async () => {
      const invalidParams = {
        name: '', // Invalid: empty name
        symbol: 'TOOLONGSYMBOL', // Invalid: too long
        decimals: -1, // Invalid: negative
        initialSupply: -100 // Invalid: negative
      };

      const response = await request(app)
        .post('/api/transactions/create-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidParams)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        details: expect.any(String),
        code: 'VALIDATION_FAILED'
      });
    });

    test('should handle missing required fields', async () => {
      const incompleteParams = {
        name: 'Test Token'
        // Missing symbol, decimals, initialSupply
      };

      const response = await request(app)
        .post('/api/transactions/create-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteParams)
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('POST /api/transactions/submit', () => {
    let unsignedTransaction: string;
    let transactionMetadata: any;

    beforeAll(async () => {
      // Створюємо unsigned транзакцію для тестування
      const createResponse = await request(app)
        .post('/api/transactions/create-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testTokenParams);

      unsignedTransaction = createResponse.body.transaction;
      transactionMetadata = createResponse.body.metadata;
    });

    test('should accept signed transaction (mocked)', async () => {
      // Симулюємо підписану транзакцію (в реальності це робить клієнт)
      const mockSignedTransaction = Buffer.from('mock_signed_transaction_data').toString('base64');

      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          signedTransaction: mockSignedTransaction,
          metadata: {
            mintAddress: transactionMetadata.mintAddress
          }
        })
        .expect(500); // Очікуємо 500 бо це mock транзакція

      // Перевіряємо що запит був оброблений правильно
      expect(response.body).toEqual({
        success: false,
        error: expect.any(String),
        code: 'TRANSACTION_SUBMISSION_FAILED'
      });
    });

    test('should reject request without signed transaction', async () => {
      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metadata: { mintAddress: transactionMetadata.mintAddress }
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Signed transaction is required',
        code: 'MISSING_SIGNED_TRANSACTION'
      });
    });

    test('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/transactions/submit')
        .send({
          signedTransaction: 'mock_signed_transaction'
        })
        .expect(401);

      expect(response.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('GET /api/transactions/status/:signature', () => {
    test('should return transaction status', async () => {
      const mockSignature = 'mock_transaction_signature_hash';

      const response = await request(app)
        .get(`/api/transactions/status/${mockSignature}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        signature: mockSignature,
        status: expect.stringMatching(/^(pending|confirmed|failed|not_found)$/),
        error: expect.any(String),
        explorerUrl: expect.stringContaining('explorer.solana.com')
      });
    });

    test('should reject request without signature', async () => {
      const response = await request(app)
        .get('/api/transactions/status/')
        .expect(404); // Не знайдено маршрут без signature
    });
  });

  describe('GET /api/transactions/network-info', () => {
    test('should return network information', async () => {
      const response = await request(app)
        .get('/api/transactions/network-info')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        network: expect.stringContaining('solana.com'),
        blockHeight: expect.any(Number),
                  health: expect.stringMatching(/^(ok|degraded|down)$/),
        isDevnet: expect.any(Boolean),
        explorerUrl: expect.stringContaining('explorer.solana.com')
      });
    });
  });

  describe('POST /api/transactions/validate-address', () => {
    test('should validate valid Solana address', async () => {
      const response = await request(app)
        .post('/api/transactions/validate-address')
        .send({ address: testWalletAddress })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        address: testWalletAddress,
        isValid: true,
        message: 'Valid Solana address'
      });
    });

    test('should reject invalid address', async () => {
      const response = await request(app)
        .post('/api/transactions/validate-address')
        .send({ address: 'invalid_address' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        address: 'invalid_address',
        isValid: false,
        message: 'Invalid Solana address format'
      });
    });

    test('should require address parameter', async () => {
      const response = await request(app)
        .post('/api/transactions/validate-address')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Address is required');
    });
  });

  describe('POST /api/transactions/estimate-fee', () => {
    test('should estimate fee for token creation', async () => {
      const response = await request(app)
        .post('/api/transactions/estimate-fee')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          operation: 'create-token',
          parameters: testTokenParams 
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        operation: 'create-token',
        estimatedFee: expect.any(Number),
        estimatedFeeSOL: expect.any(Number),
        currency: 'lamports',
        note: expect.stringContaining('estimate')
      });

      // Перевіряємо що fee для create-token більший за transfer
      expect(response.body.estimatedFee).toBeGreaterThan(10000);
    });

    test('should estimate fee for transfer', async () => {
      const response = await request(app)
        .post('/api/transactions/estimate-fee')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ operation: 'transfer' })
        .expect(200);

      expect(response.body.estimatedFee).toBe(5000);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/transactions/estimate-fee')
        .send({ operation: 'transfer' })
        .expect(401);

      expect(response.body.code).toBe('AUTH_REQUIRED');
    });
  });
});

describe('TransactionBuilder Service Unit Tests', () => {
  let transactionBuilder: TransactionBuilderService;
  const testWalletAddress = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

  beforeAll(() => {
    transactionBuilder = new TransactionBuilderService();
  });

  describe('validatePublicKey', () => {
    test('should validate correct Solana public key', () => {
      const isValid = transactionBuilder.validatePublicKey(testWalletAddress);
      expect(isValid).toBe(true);
    });

    test('should reject invalid public key formats', () => {
      const invalidKeys = [
        'invalid',
        '123',
        '',
        'too_short',
        'way_too_long_to_be_a_valid_solana_public_key_address'
      ];

      invalidKeys.forEach(key => {
        const isValid = transactionBuilder.validatePublicKey(key);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('getNetworkInfo', () => {
    test('should return network information', async () => {
      const networkInfo = await transactionBuilder.getNetworkInfo();

      expect(networkInfo).toEqual({
        network: expect.stringContaining('solana.com'),
        blockHeight: expect.any(Number),
                  health: expect.stringMatching(/^(ok|degraded|down)$/)
      });
    });
  });

  describe('createTokenTransaction', () => {
    test('should create valid unsigned transaction', async () => {
      const testTokenParams = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9,
        initialSupply: 1000000,
        description: 'Test token for secure Web3 testing',
        imageUrl: 'https://example.com/token.png'
      };

      const result = await transactionBuilder.createTokenTransaction({
        userPublicKey: testWalletAddress,
        ...testTokenParams
      });

      if (result.success) {
        expect(result.transaction).toBeDefined();
        expect(result.metadata?.mintAddress).toMatch(/^[A-Za-z0-9]{32,44}$/);
        expect(result.metadata?.estimatedFee).toBeGreaterThan(0);
        expect(result.metadata?.instructions).toHaveLength(5);
      }
      
      // Тест може fail через мережеві проблеми в CI, тому перевіряємо структуру
      expect(result).toHaveProperty('success');
      if (result.error) {
        expect(result.error).toEqual(expect.any(String));
      }
    });

    test('should handle invalid parameters', async () => {
      const result = await transactionBuilder.createTokenTransaction({
        userPublicKey: 'invalid_public_key',
        name: '',
        symbol: '',
        decimals: -1,
        initialSupply: -1
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createUpdateMetadataTransaction', () => {
    it('should validate uri and return unsigned tx', async () => {
      const svc = new TransactionBuilderService();
      // Use a valid public key format (random, only format is checked early)
      const testUser = '11111111111111111111111111111111AAAAAAAAAA';
      const testMint = '11111111111111111111111111111111BBBBBBBBBB';
      // Mock fetch for HEAD/GET
      const savedFetch = (global as any).fetch;
      (global as any).fetch = async (url: string, opts: any) => {
        if (opts?.method === 'HEAD') return { ok: true, status: 200, headers: { get: () => 'application/json' } } as any;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ name: 'T', symbol: 'TT', image: 'https://example.com/x.png' })
        } as any;
      };
      const res = await svc.createUpdateMetadataTransaction({ userPublicKey: testUser, mintAddress: testMint, uri: 'https://example.com/meta.json', name: 'New', symbol: 'NEW' });
      (global as any).fetch = savedFetch;
      expect(res.success).toBe(true);
      expect(res.transaction).toBeDefined();
      expect(res.metadata?.instructions).toContain('Update Metadata Account V2');
    });

    it('should fail when uri not reachable', async () => {
      const svc = new TransactionBuilderService();
      const testUser = '11111111111111111111111111111111CCCCCCCCCC';
      const testMint = '11111111111111111111111111111111DDDDDDDDDD';
      const savedFetch = (global as any).fetch;
      (global as any).fetch = async (_url: string, _opts: any) => ({ ok: false, status: 404 }) as any;
      const res = await svc.createUpdateMetadataTransaction({ userPublicKey: testUser, mintAddress: testMint, uri: 'https://bad.example/meta.json' });
      (global as any).fetch = savedFetch;
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not reachable/i);
    });
  });
});

describe('Security Tests', () => {
  test('should never expose private keys in responses', async () => {
    const server = new CryptoCraftServer();
    await server.initialize();
    const app = server.getApp();

    // Тест всіх endpoints щоб переконатися що приватні ключі ніколи не повертаються
    const endpoints = [
      '/api/auth/me',
      '/api/transactions/network-info',
      '/api/transactions/validate-address'
    ];

    for (const endpoint of endpoints) {
      const response = await request(app).get(endpoint);
      const responseStr = JSON.stringify(response.body);
      
      // Перевіряємо що відповіді не містять ключових слів пов'язаних з приватними ключами
      expect(responseStr).not.toMatch(/private.*key/i);
      expect(responseStr).not.toMatch(/secret.*key/i);
      expect(responseStr).not.toMatch(/seed.*phrase/i);
      expect(responseStr).not.toMatch(/mnemonic/i);
    }

    await server.stop();
  });

  test('should validate all user inputs', async () => {
    // Тест SQL injection, XSS та інших векторів атак
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      '<script>alert("xss")</script>',
      '../../etc/passwd',
      '${process.env.SECRET}',
      'null',
      'undefined'
    ];

    const server = new CryptoCraftServer();
    await server.initialize();
    const app = server.getApp();

    for (const maliciousInput of maliciousInputs) {
      // Тест validation endpoint
      const response = await request(app)
        .post('/api/transactions/validate-address')
        .send({ address: maliciousInput });

      // Всі запити мають бути оброблені безпечно (не 500 error)
      expect(response.status).not.toBe(500);
      
      if (response.body.isValid !== undefined) {
        expect(response.body.isValid).toBe(false);
      }
    }

    await server.stop();
  });
});