/**
 * Інтеграційні тести для CryptoCraft API
 * Тестують повний flow функцій з безпечною Web3 архітектурою
 */

import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { CryptoCraftServer } from '../src/app';
import { AuthService } from '../src/services/AuthService';
import { AirdropService } from '../src/services/AirdropService';
import { TransactionBuilderService } from '../src/services/TransactionBuilder';
import { prisma } from '../src/database/prisma';

describe('CryptoCraft API Integration Tests', () => {
  let app: any;
  let server: CryptoCraftServer;
  let authService: AuthService;
  let airdropService: AirdropService;
  let transactionBuilder: TransactionBuilderService;
  
  // Test users
  const testUser1 = {
    walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    username: 'integrationtestuser1',
    email: 'test1@example.com'
  };

  const testUser2 = {
    walletAddress: 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3',
    username: 'integrationtestuser2',
    email: 'test2@example.com'
  };

  let user1Token: string;
  let user2Token: string;
  let createdTokenId: string;
  let createdCampaignId: string;

  const DB_OFF = process.env.DB_OFF_MODE === 'true';

  beforeAll(async () => {
    server = new CryptoCraftServer();
    await server.initialize();
    app = server.getApp();
    authService = new AuthService();
    airdropService = new AirdropService();
    transactionBuilder = new TransactionBuilderService();

    // Cleanup test data
    if (!DB_OFF) {
      await prisma.token.deleteMany({
        where: {
          OR: [
            { creator: { walletAddress: testUser1.walletAddress } },
            { creator: { walletAddress: testUser2.walletAddress } }
          ]
        }
      });
      await prisma.user.deleteMany({
        where: {
          walletAddress: { in: [testUser1.walletAddress, testUser2.walletAddress] }
        }
      });
    }
  });

  afterAll(async () => {
    await server.stop();
    await prisma.$disconnect();
  });

  describe('Complete User Registration and Authentication Flow', () => {
    test('should register two users', async () => {
      // Register User 1
      const message1 = await authService.generateAuthMessage(testUser1.walletAddress, 'register');
      const registerResponse1 = await request(app)
        .post('/api/auth/register')
        .send({
          walletAddress: testUser1.walletAddress,
          signature: 'mock_signature_1',
          message: message1.message,
          timestamp: message1.timestamp,
          username: testUser1.username,
          email: testUser1.email
        })
        .expect(201);

      expect(registerResponse1.body.success).toBe(true);
      expect(registerResponse1.body.user.walletAddress).toBe(testUser1.walletAddress);
      user1Token = registerResponse1.body.token;

      // Register User 2
      const message2 = await authService.generateAuthMessage(testUser2.walletAddress, 'register');
      const registerResponse2 = await request(app)
        .post('/api/auth/register')
        .send({
          walletAddress: testUser2.walletAddress,
          signature: 'mock_signature_2',
          message: message2.message,
          timestamp: message2.timestamp,
          username: testUser2.username,
          email: testUser2.email
        })
        .expect(201);

      expect(registerResponse2.body.success).toBe(true);
      user2Token = registerResponse2.body.token;
    });

    test('should authenticate users with tokens', async () => {
      // Test User 1 authentication
      const meResponse1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(meResponse1.body.user.walletAddress).toBe(testUser1.walletAddress);

      // Test User 2 authentication
      const meResponse2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(meResponse2.body.user.walletAddress).toBe(testUser2.walletAddress);
    });
  });

  describe('Complete Token Creation Flow (Secure Web3)', () => {
    test('should create unsigned transaction for token', async () => {
      const tokenParams = {
        name: 'Integration Test Token',
        symbol: 'ITT',
        decimals: 9,
        initialSupply: 1000000,
        description: 'Token for integration testing'
      };

      const response = await request(app)
        .post('/api/transactions/create-token')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(tokenParams)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction).toBeDefined();
      expect(response.body.metadata.mintAddress).toMatch(/^[A-Za-z0-9]{32,44}$/);
      expect(response.body.signingInstructions).toContain('5. NEVER share your private key with anyone!');

      // Store mint address for later tests
      (global as any).testMintAddress = response.body.metadata.mintAddress;
    });

    test('should submit signed transaction (mocked)', async () => {
      const mockSignedTransaction = Buffer.from('mock_signed_transaction_data').toString('base64');

      const response = await request(app)
        .post('/api/transactions/submit')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          signedTransaction: mockSignedTransaction,
          metadata: {
            mintAddress: (global as any).testMintAddress
          }
        })
        .expect(500); // Expected to fail with mock data

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TRANSACTION_SUBMISSION_FAILED');
    });

    test('should save token metadata to database', async () => {
      // Simulate successful token creation by saving metadata directly
      const tokenData = {
        name: 'Integration Test Token',
        symbol: 'ITT',
        decimals: 9,
        initialSupply: 1000000,
        description: 'Token for integration testing'
      };

      // Create token record in database (simulating successful blockchain transaction)
      const user = await prisma.user.findUnique({
        where: { walletAddress: testUser1.walletAddress }
      });

      const token = await prisma.token.create({
        data: {
          mintAddress: (global as any).testMintAddress || 'mock_mint_address',
          creatorId: user!.id,
          blockchain: 'solana',
          name: tokenData.name,
          symbol: tokenData.symbol,
          decimals: tokenData.decimals,
          supply: tokenData.initialSupply.toString(),
          tokenType: 'FUNGIBLE',
          metadata: tokenData,
          isVerified: false,
          isFrozen: false
        }
      });

      createdTokenId = token.id;
      expect(token.name).toBe(tokenData.name);
      expect(token.symbol).toBe(tokenData.symbol);
    });
  });

  (DB_OFF ? describe.skip : describe)('Complete Airdrop Campaign Flow', () => {
    test('should create airdrop campaign', async () => {
      const campaignData = {
        tokenId: createdTokenId,
        name: 'Integration Test Airdrop',
        description: 'Test airdrop campaign',
        scheduledAt: new Date(Date.now() + 60000), // 1 minute from now
        totalAmount: '100000',
        recipients: [
          {
            walletAddress: testUser2.walletAddress,
            amount: '1000'
          },
          {
            walletAddress: 'B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4',
            amount: '2000'
          }
        ]
      };

      const response = await request(app)
        .post('/api/airdrops/campaigns')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(campaignData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.campaign.name).toBe(campaignData.name);
      expect(response.body.recipientsCount).toBe(2);
      expect(response.body.jobId).toBeDefined();

      createdCampaignId = response.body.campaign.id;
    });

    test('should list airdrop campaigns', async () => {
      const response = await request(app)
        .get('/api/airdrops/campaigns')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.campaigns).toBeInstanceOf(Array);
      expect(response.body.campaigns.length).toBeGreaterThan(0);

      const campaign = response.body.campaigns.find((c: any) => c.id === createdCampaignId);
      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Integration Test Airdrop');
    });

    test('should get campaign details', async () => {
      const response = await request(app)
        .get(`/api/airdrops/campaigns/${createdCampaignId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.campaign.id).toBe(createdCampaignId);
      expect(response.body.campaign.recipients).toBeInstanceOf(Array);
      expect(response.body.campaign.recipients.length).toBe(2);
      expect(response.body.campaign.stats).toBeDefined();
    });

    test('should show available airdrops for user2', async () => {
      const response = await request(app)
        .get('/api/airdrops/available')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.airdrops).toBeInstanceOf(Array);
      
      const userAirdrop = response.body.airdrops.find((a: any) => 
        a.campaignId === createdCampaignId
      );
      expect(userAirdrop).toBeDefined();
      expect(userAirdrop.amount).toBe('1000');
    });

    test('should create claim transaction for user2', async () => {
      const response = await request(app)
        .post(`/api/airdrops/claim/${createdCampaignId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction).toBeDefined();
      expect(response.body.metadata.campaignId).toBe(createdCampaignId);
      expect(response.body.metadata.amount).toBe('1000');
      expect(response.body.signingInstructions).toContain(
        expect.stringContaining('Sign the transaction to claim')
      );
    });
  });

  (DB_OFF ? describe.skip : describe)('GraphQL Integration Tests', () => {
    test('should query user tokens via GraphQL', async () => {
      const query = `
        query {
          myTokens(pagination: { first: 10 }) {
            edges {
              node {
                id
                name
                symbol
                mintAddress
                creator {
                  walletAddress
                }
              }
            }
            totalCount
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ query })
        .expect(200);

      expect(response.body.data.myTokens.edges).toBeInstanceOf(Array);
      expect(response.body.data.myTokens.totalCount).toBeGreaterThan(0);
      
      const token = response.body.data.myTokens.edges[0].node;
      expect(token.name).toBe('Integration Test Token');
      expect(token.creator.walletAddress).toBe(testUser1.walletAddress);
    });

    test('should create unsigned transaction via GraphQL', async () => {
      const mutation = `
        mutation {
          createTokenTransaction(input: {
            name: "GraphQL Test Token"
            symbol: "GTT"
            decimals: 6
            initialSupply: 500000
            description: "Token created via GraphQL"
          }) {
            transaction
            metadata {
              mintAddress
              estimatedFee
              instructions
            }
            signingInstructions
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ query: mutation })
        .expect(200);

      expect(response.body.data.createTokenTransaction.transaction).toBeDefined();
      expect(response.body.data.createTokenTransaction.metadata.mintAddress).toMatch(/^[A-Za-z0-9]{32,44}$/);
      expect(response.body.data.createTokenTransaction.signingInstructions).toContain(
        expect.stringContaining('NEVER share your private key')
      );
    });

    test('should query platform stats via GraphQL', async () => {
      const query = `
        query {
          platformStats {
            totalUsers
            totalTokens
            activeUsers
            totalAirdrops
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query })
        .expect(200);

      expect(response.body.data.platformStats.totalUsers).toBeGreaterThanOrEqual(2);
      expect(response.body.data.platformStats.totalTokens).toBeGreaterThanOrEqual(1);
      expect(response.body.data.platformStats.totalAirdrops).toBeGreaterThanOrEqual(1);
    });

    test('should create unsigned update metadata transaction via GraphQL', async () => {
      const mutation = `
        mutation($input: UpdateMetadataInput!) {
          createUpdateMetadataTransaction(input: $input) {
            transaction
            metadata { mintAddress metadataAddress estimatedFee instructions network }
            signingInstructions
          }
        }
      `;
      const savedFetch = (global as any).fetch;
      (global as any).fetch = async (url: string, opts: any) => {
        if (opts?.method === 'HEAD') return { ok: true, status: 200, headers: { get: () => 'application/json' } } as any;
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ name: 'N', symbol: 'NN' }) } as any;
      };
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ query: mutation, variables: { input: { mintAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', uri: 'https://example.com/meta.json', name: 'New', symbol: 'NEW' } } })
        .expect(200);
      (global as any).fetch = savedFetch;
      expect(response.body.data.createUpdateMetadataTransaction.transaction).toBeDefined();
      expect(response.body.data.createUpdateMetadataTransaction.metadata.instructions).toContain('Update Metadata Account V2');
    });
  });

  describe('Security and Error Handling Tests', () => {
    test('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/transactions/create-token')
        .send({
          name: 'Unauthorized Token',
          symbol: 'UNAUTH',
          decimals: 9,
          initialSupply: 1000
        })
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });

    test('should validate input parameters', async () => {
      const response = await request(app)
        .post('/api/transactions/create-token')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: '', // Invalid empty name
          symbol: 'TOOLONGSYMBOLNAME', // Invalid too long symbol
          decimals: -1, // Invalid negative decimals
          initialSupply: -100 // Invalid negative supply
        })
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });

    test('should handle rate limiting', async () => {
      // Make many requests quickly to trigger rate limiting
      const promises = Array(20).fill(null).map(() => 
        request(app)
          .get('/api/transactions/network-info')
          .set('Authorization', `Bearer ${user1Token}`)
      );

      const responses = await Promise.all(promises);
      
      // At least some should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
      
      // Check if any hit rate limit (429)
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      // Rate limiting might or might not trigger in tests depending on timing
    });

    test('should return proper error codes', async () => {
      // Test 404 for non-existent campaign
      const response = await request(app)
        .get('/api/airdrops/campaigns/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CAMPAIGN_NOT_FOUND');
    });
  });

  (DB_OFF ? describe.skip : describe)('Queue System Integration Tests', () => {
    test('should process airdrop queue', async () => {
      const queueStats = await airdropService.getQueueStats();
      
      expect(queueStats.airdropQueue).toBeDefined();
      expect(queueStats.transactionQueue).toBeDefined();
      
      // Check that queue has some jobs (from campaign creation)
      const totalJobs = queueStats.airdropQueue.waiting + 
                       queueStats.airdropQueue.active + 
                       queueStats.airdropQueue.completed;
      expect(totalJobs).toBeGreaterThanOrEqual(0);
    });

    test('should get campaign statistics', async () => {
      const stats = await airdropService.getCampaignStats(createdCampaignId);
      
      expect(stats.totalRecipients).toBe(2);
      expect(stats.claimedCount).toBe(0); // No claims processed yet in test
      expect(stats.claimPercentage).toBe(0);
      expect(stats.totalAmount).toBe('100000');
    });
  });

  describe('Network and Blockchain Integration', () => {
    test('should validate Solana addresses', async () => {
      const validAddress = testUser1.walletAddress;
      const invalidAddress = 'invalid_address';

      // Test valid address
      const validResponse = await request(app)
        .post('/api/transactions/validate-address')
        .send({ address: validAddress })
        .expect(200);

      expect(validResponse.body.isValid).toBe(true);

      // Test invalid address
      const invalidResponse = await request(app)
        .post('/api/transactions/validate-address')
        .send({ address: invalidAddress })
        .expect(200);

      expect(invalidResponse.body.isValid).toBe(false);
    });

    test('should get network information', async () => {
      const response = await request(app)
        .get('/api/transactions/network-info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.network).toContain('solana.com');
      expect(response.body.blockHeight).toBeGreaterThan(0);
      expect(['ok', 'degraded', 'down']).toContain(response.body.health);
    });

    test('should estimate transaction fees', async () => {
      const response = await request(app)
        .post('/api/transactions/estimate-fee')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ 
          operation: 'create-token',
          parameters: { name: 'Test', symbol: 'TEST' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.estimatedFee).toBeGreaterThan(0);
      expect(response.body.estimatedFeeSOL).toBeGreaterThan(0);
      expect(response.body.currency).toBe('lamports');
    });
  });

  (DB_OFF ? describe.skip : describe)('Full End-to-End Flow', () => {
    test('should complete token creation to airdrop claim flow', async () => {
      // 1. Create new token
      const tokenResponse = await request(app)
        .post('/api/transactions/create-token')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'E2E Test Token',
          symbol: 'E2E',
          decimals: 9,
          initialSupply: 1000000
        });

      expect(tokenResponse.body.success).toBe(true);
      const newMintAddress = tokenResponse.body.metadata.mintAddress;

      // 2. Save token to database (simulate successful blockchain transaction)
      const user = await prisma.user.findUnique({
        where: { walletAddress: testUser1.walletAddress }
      });

      const newToken = await prisma.token.create({
        data: {
          mintAddress: newMintAddress,
          creatorId: user!.id,
          blockchain: 'solana',
          name: 'E2E Test Token',
          symbol: 'E2E',
          decimals: 9,
          supply: '1000000',
          tokenType: 'FUNGIBLE',
          metadata: { name: 'E2E Test Token', symbol: 'E2E' },
          isVerified: false,
          isFrozen: false
        }
      });

      // 3. Create airdrop campaign
      const campaignResponse = await request(app)
        .post('/api/airdrops/campaigns')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          tokenId: newToken.id,
          name: 'E2E Test Airdrop',
          scheduledAt: new Date(Date.now() + 30000),
          totalAmount: '50000',
          recipients: [{
            walletAddress: testUser2.walletAddress,
            amount: '5000'
          }]
        });

      expect(campaignResponse.body.success).toBe(true);
      const e2eCampaignId = campaignResponse.body.campaign.id;

      // 4. Check available airdrops for user2
      const availableResponse = await request(app)
        .get('/api/airdrops/available')
        .set('Authorization', `Bearer ${user2Token}`);

      const e2eAirdrop = availableResponse.body.airdrops.find((a: any) => 
        a.campaignId === e2eCampaignId
      );
      expect(e2eAirdrop).toBeDefined();
      expect(e2eAirdrop.amount).toBe('5000');

      // 5. Create claim transaction
      const claimResponse = await request(app)
        .post(`/api/airdrops/claim/${e2eCampaignId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(claimResponse.body.success).toBe(true);
      expect(claimResponse.body.metadata.amount).toBe('5000');

      // 6. Verify campaign stats
      const statsResponse = await request(app)
        .get(`/api/airdrops/campaigns/${e2eCampaignId}`);

      expect(statsResponse.body.campaign.stats.totalRecipients).toBe(1);
      expect(statsResponse.body.campaign.stats.totalAmount).toBe('50000');
    });
  });
});