/**
 * Unit Tests for BlockchainManager
 */

import { BlockchainManagerImpl } from '@/core/BlockchainManager';
import { AdapterFactoryImpl } from '@/core/AdapterFactory';
import { BlockchainAdapter } from '@/core/interfaces/BlockchainAdapter';
import Logger from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/logger');
jest.mock('@/core/AdapterFactory');

describe('BlockchainManager', () => {
  let blockchainManager: BlockchainManagerImpl;
  let mockAdapterFactory: jest.Mocked<AdapterFactoryImpl>;
  let mockAdapter: jest.Mocked<BlockchainAdapter>;

  beforeEach(() => {
    // Create mock adapter
    mockAdapter = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      getNetwork: jest.fn().mockReturnValue({
        name: 'devnet',
        rpcUrl: 'https://api.devnet.solana.com',
        isTestnet: true
      }),
      createToken: jest.fn(),
      createNFT: jest.fn(),
      createNFTCollection: jest.fn(),
      distributeAirdrop: jest.fn(),
      batchTransfer: jest.fn(),
      createLiquidityPool: jest.fn(),
      addLiquidity: jest.fn(),
      removeLiquidity: jest.fn(),
      getBalance: jest.fn(),
      getTransactionStatus: jest.fn(),
      getTokenInfo: jest.fn(),
      getNFTMetadata: jest.fn(),
      validateAddress: jest.fn().mockReturnValue(true),
      estimateGas: jest.fn(),
      getCurrentBlockNumber: jest.fn(),
      createPaymentRequest: jest.fn(),
      verifyPayment: jest.fn()
    };

    // Create mock adapter factory
    mockAdapterFactory = {
      createAdapter: jest.fn().mockResolvedValue(mockAdapter),
      getSupportedBlockchains: jest.fn().mockReturnValue(['solana']),
      isSupported: jest.fn().mockReturnValue(true),
      addBlockchainSupport: jest.fn(),
      removeBlockchainSupport: jest.fn(),
      getAdapterRequirements: jest.fn(),
      validateAdapterConfig: jest.fn(),
      getDefaultConfig: jest.fn()
    } as any;

    blockchainManager = new BlockchainManagerImpl(mockAdapterFactory, Logger);
  });

  describe('getAdapter', () => {
    it('should create and return new adapter for supported blockchain', async () => {
      const adapter = await blockchainManager.getAdapter('solana');

      expect(mockAdapterFactory.createAdapter).toHaveBeenCalledWith('solana');
      expect(mockAdapter.connect).toHaveBeenCalled();
      expect(adapter).toBe(mockAdapter);
    });

    it('should return existing adapter if already created', async () => {
      // First call
      await blockchainManager.getAdapter('solana');
      
      // Second call should return same adapter without creating new one
      const adapter = await blockchainManager.getAdapter('solana');

      expect(mockAdapterFactory.createAdapter).toHaveBeenCalledTimes(1);
      expect(adapter).toBe(mockAdapter);
    });

    it('should throw error for unsupported blockchain', async () => {
      mockAdapterFactory.isSupported.mockReturnValue(false);

      await expect(blockchainManager.getAdapter('ethereum')).rejects.toThrow(
        'Blockchain ethereum is not supported'
      );
    });

    it('should reconnect if adapter is disconnected', async () => {
      // First call to create adapter
      await blockchainManager.getAdapter('solana');
      
      // Mock adapter as disconnected
      mockAdapter.isConnected.mockReturnValue(false);
      
      // Second call should reconnect
      await blockchainManager.getAdapter('solana');

      expect(mockAdapter.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('addAdapter', () => {
    it('should add adapter to manager', () => {
      blockchainManager.addAdapter('solana', mockAdapter);

      expect(blockchainManager.hasAdapter('solana')).toBe(true);
    });

    it('should set as default if no default exists', () => {
      blockchainManager.addAdapter('solana', mockAdapter);

      expect(blockchainManager.getDefaultAdapter()).toBe(mockAdapter);
    });
  });

  describe('removeAdapter', () => {
    it('should remove adapter and disconnect', async () => {
      blockchainManager.addAdapter('solana', mockAdapter);
      
      await blockchainManager.removeAdapter('solana');

      expect(mockAdapter.disconnect).toHaveBeenCalled();
      expect(blockchainManager.hasAdapter('solana')).toBe(false);
    });

    it('should reset default if removed adapter was default', async () => {
      blockchainManager.addAdapter('solana', mockAdapter);
      blockchainManager.setDefaultAdapter('solana');
      
      await blockchainManager.removeAdapter('solana');

      expect(blockchainManager.getDefaultAdapter()).toBeNull();
    });
  });

  describe('setDefaultAdapter', () => {
    it('should set default adapter if exists', () => {
      blockchainManager.addAdapter('solana', mockAdapter);
      
      blockchainManager.setDefaultAdapter('solana');

      expect(blockchainManager.getDefaultAdapter()).toBe(mockAdapter);
    });

    it('should throw error if adapter does not exist', () => {
      expect(() => blockchainManager.setDefaultAdapter('ethereum')).toThrow(
        'Cannot set ethereum as default: adapter not found'
      );
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all adapters', async () => {
      blockchainManager.addAdapter('solana', mockAdapter);
      mockAdapter.getCurrentBlockNumber.mockResolvedValue(123456);

      const status = await blockchainManager.getHealthStatus();

      expect(status).toHaveProperty('defaultBlockchain');
      expect(status).toHaveProperty('adapters');
      expect(status).toHaveProperty('totalAdapters', 1);
      expect(status.adapters.solana).toMatchObject({
        connected: true,
        network: 'devnet',
        blockchainReachable: true
      });
    });

    it('should handle adapter errors in health check', async () => {
      blockchainManager.addAdapter('solana', mockAdapter);
      mockAdapter.getCurrentBlockNumber.mockRejectedValue(new Error('Network error'));

      const status = await blockchainManager.getHealthStatus();

      expect(status.adapters.solana).toMatchObject({
        connected: true,
        network: 'devnet',
        blockchainReachable: false,
        error: 'Network error'
      });
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all adapters and clear state', async () => {
      blockchainManager.addAdapter('solana', mockAdapter);
      
      await blockchainManager.disconnectAll();

      expect(mockAdapter.disconnect).toHaveBeenCalled();
      expect(blockchainManager.getActiveAdapters()).toHaveLength(0);
      expect(blockchainManager.getDefaultAdapter()).toBeNull();
    });
  });

  describe('getSupportedBlockchains', () => {
    it('should return supported blockchains from factory', () => {
      const supported = blockchainManager.getSupportedBlockchains();

      expect(mockAdapterFactory.getSupportedBlockchains).toHaveBeenCalled();
      expect(supported).toEqual(['solana']);
    });
  });
});