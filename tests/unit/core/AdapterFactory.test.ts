/**
 * Unit Tests for AdapterFactory
 */

import { AdapterFactoryImpl } from '@/core/AdapterFactory';
import { SolanaAdapter } from '@/adapters/solana/SolanaAdapter';
import Logger from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/logger');
jest.mock('@/adapters/solana/SolanaAdapter');

describe('AdapterFactory', () => {
  let adapterFactory: AdapterFactoryImpl;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    adapterFactory = new AdapterFactoryImpl(Logger);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createAdapter', () => {
    it('should create Solana adapter when blockchain is solana', async () => {
      process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
      
      const adapter = await adapterFactory.createAdapter('solana');

      expect(SolanaAdapter).toHaveBeenCalledWith(Logger);
      expect(adapter).toBeInstanceOf(SolanaAdapter);
    });

    it('should handle case insensitive blockchain names', async () => {
      process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
      
      const adapter = await adapterFactory.createAdapter('SOLANA');

      expect(SolanaAdapter).toHaveBeenCalledWith(Logger);
    });

    it('should throw error for unsupported blockchain', async () => {
      await expect(adapterFactory.createAdapter('ethereum')).rejects.toThrow(
        'Blockchain ethereum is not supported'
      );
    });

    it('should throw error for Solana adapter without RPC URL', async () => {
      delete process.env.SOLANA_RPC_URL;

      await expect(adapterFactory.createAdapter('solana')).rejects.toThrow(
        'SOLANA_RPC_URL environment variable is required for Solana adapter'
      );
    });
  });

  describe('getSupportedBlockchains', () => {
    it('should return list of supported blockchains', () => {
      const supported = adapterFactory.getSupportedBlockchains();

      expect(supported).toContain('solana');
      expect(Array.isArray(supported)).toBe(true);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported blockchain', () => {
      expect(adapterFactory.isSupported('solana')).toBe(true);
    });

    it('should return false for unsupported blockchain', () => {
      expect(adapterFactory.isSupported('ethereum')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(adapterFactory.isSupported('SOLANA')).toBe(true);
      expect(adapterFactory.isSupported('Solana')).toBe(true);
    });
  });

  describe('addBlockchainSupport', () => {
    it('should add new blockchain to supported list', () => {
      adapterFactory.addBlockchainSupport('ethereum');

      expect(adapterFactory.isSupported('ethereum')).toBe(true);
      expect(adapterFactory.getSupportedBlockchains()).toContain('ethereum');
    });
  });

  describe('removeBlockchainSupport', () => {
    it('should remove blockchain from supported list', () => {
      adapterFactory.removeBlockchainSupport('solana');

      expect(adapterFactory.isSupported('solana')).toBe(false);
    });
  });

  describe('getAdapterRequirements', () => {
    it('should return requirements for Solana', () => {
      const requirements = adapterFactory.getAdapterRequirements('solana');

      expect(requirements).toContain('SOLANA_RPC_URL');
      expect(Array.isArray(requirements)).toBe(true);
    });

    it('should return empty array for unsupported blockchain', () => {
      const requirements = adapterFactory.getAdapterRequirements('ethereum');

      expect(requirements).toEqual([]);
    });
  });

  describe('validateAdapterConfig', () => {
    it('should validate Solana configuration successfully', () => {
      process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';

      const result = adapterFactory.validateAdapterConfig('solana');

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return missing requirements for incomplete configuration', () => {
      delete process.env.SOLANA_RPC_URL;

      const result = adapterFactory.validateAdapterConfig('solana');

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('SOLANA_RPC_URL');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration for Solana', () => {
      const config = adapterFactory.getDefaultConfig('solana');

      expect(config).toHaveProperty('network');
      expect(config).toHaveProperty('commitment');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('retries');
    });

    it('should return production network for production environment', () => {
      process.env.NODE_ENV = 'production';
      adapterFactory = new AdapterFactoryImpl(Logger);

      const config = adapterFactory.getDefaultConfig('solana');

      expect(config.network).toBe('mainnet');
    });

    it('should return empty config for unsupported blockchain', () => {
      const config = adapterFactory.getDefaultConfig('ethereum');

      expect(config).toEqual({});
    });
  });
});