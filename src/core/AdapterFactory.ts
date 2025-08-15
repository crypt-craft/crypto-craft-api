/**
 * Adapter Factory Implementation
 * Creates blockchain adapters based on blockchain type
 */

import { BlockchainAdapter, AdapterFactory } from './interfaces/BlockchainAdapter';
import { SolanaAdapter } from '@/adapters/solana/SolanaAdapter';
import Logger from '@/utils/logger';
import type { Logger as LoggerType } from 'winston';

export class CryptoAdapterFactoryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CryptoAdapterFactoryError';
  }
}

export class AdapterFactoryImpl implements AdapterFactory {
  private logger: LoggerType;
  private supportedBlockchains: Set<string> = new Set([
    'solana',
    // Future blockchains will be added here
    // 'ethereum',
    // 'polygon',
    // 'bsc'
  ]);

  constructor(logger: LoggerType) {
    this.logger = logger;
  }

  /**
   * Create adapter for specific blockchain
   */
  async createAdapter(blockchain: string): Promise<BlockchainAdapter> {
    const normalizedBlockchain = blockchain.toLowerCase();
    
    if (!this.isSupported(normalizedBlockchain)) {
      throw new CryptoAdapterFactoryError(
        `Blockchain ${blockchain} is not supported`,
        'UNSUPPORTED_BLOCKCHAIN'
      );
    }

    try {
      switch (normalizedBlockchain) {
        case 'solana':
          return await this.createSolanaAdapter();
        
        // Future blockchain adapters
        // case 'ethereum':
        //   return await this.createEthereumAdapter();
        // case 'polygon':
        //   return await this.createPolygonAdapter();
        
        default:
          throw new CryptoAdapterFactoryError(
            `No adapter implementation found for ${blockchain}`,
            'NO_ADAPTER_IMPLEMENTATION'
          );
      }
    } catch (error) {
      this.logger.error(`Failed to create adapter for ${blockchain}:`, error);
      
      if (error instanceof CryptoAdapterFactoryError) {
        throw error;
      }
      
      throw new CryptoAdapterFactoryError(
        `Failed to initialize adapter for ${blockchain}: ${(error as Error).message}`,
        'ADAPTER_INITIALIZATION_FAILED'
      );
    }
  }

  /**
   * Create Solana adapter
   */
  private async createSolanaAdapter(): Promise<SolanaAdapter> {
    this.logger.info('Creating Solana adapter...');
    
    const adapter = new SolanaAdapter(this.logger);
    
    // Basic validation
    if (!process.env.SOLANA_RPC_URL) {
      throw new CryptoAdapterFactoryError(
        'SOLANA_RPC_URL environment variable is required for Solana adapter',
        'MISSING_RPC_URL'
      );
    }
    
    this.logger.info('Solana adapter created successfully');
    return adapter;
  }

  /**
   * Get list of supported blockchains
   */
  getSupportedBlockchains(): string[] {
    return Array.from(this.supportedBlockchains);
  }

  /**
   * Check if blockchain is supported
   */
  isSupported(blockchain: string): boolean {
    return this.supportedBlockchains.has(blockchain.toLowerCase());
  }

  /**
   * Add support for new blockchain
   */
  addBlockchainSupport(blockchain: string): void {
    this.supportedBlockchains.add(blockchain.toLowerCase());
    this.logger.info(`Added support for blockchain: ${blockchain}`);
  }

  /**
   * Remove support for blockchain
   */
  removeBlockchainSupport(blockchain: string): void {
    this.supportedBlockchains.delete(blockchain.toLowerCase());
    this.logger.info(`Removed support for blockchain: ${blockchain}`);
  }

  /**
   * Get adapter configuration requirements
   */
  getAdapterRequirements(blockchain: string): string[] {
    const normalizedBlockchain = blockchain.toLowerCase();
    
    switch (normalizedBlockchain) {
      case 'solana':
        return [
          'SOLANA_RPC_URL',
          'SOLANA_PRIVATE_KEY (optional for read-only operations)',
          'SOLANA_PUBLIC_KEY (optional for read-only operations)'
        ];
      
      // Future blockchain requirements
      // case 'ethereum':
      //   return [
      //     'ETHEREUM_RPC_URL',
      //     'ETHEREUM_PRIVATE_KEY',
      //     'ETHEREUM_CHAIN_ID'
      //   ];
      
      default:
        return [];
    }
  }

  /**
   * Validate adapter configuration
   */
  validateAdapterConfig(blockchain: string): { valid: boolean; missing: string[] } {
    const normalizedBlockchain = blockchain.toLowerCase();
    const missing: string[] = [];
    
    switch (normalizedBlockchain) {
      case 'solana':
        if (!process.env.SOLANA_RPC_URL) {
          missing.push('SOLANA_RPC_URL');
        }
        break;
      
      // Future blockchain validations
      // case 'ethereum':
      //   if (!process.env.ETHEREUM_RPC_URL) missing.push('ETHEREUM_RPC_URL');
      //   if (!process.env.ETHEREUM_PRIVATE_KEY) missing.push('ETHEREUM_PRIVATE_KEY');
      //   break;
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get default configuration for blockchain
   */
  getDefaultConfig(blockchain: string): Record<string, any> {
    const normalizedBlockchain = blockchain.toLowerCase();
    
    switch (normalizedBlockchain) {
      case 'solana':
        return {
          network: process.env.NODE_ENV === 'production' ? 'mainnet' : 'devnet',
          commitment: 'confirmed',
          timeout: 30000,
          retries: 3
        };
      
      default:
        return {};
    }
  }
}