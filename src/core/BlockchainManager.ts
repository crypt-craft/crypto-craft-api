/**
 * Blockchain Manager Implementation
 * Manages multiple blockchain adapters and provides unified access
 */

import { BlockchainAdapter, BlockchainManager, AdapterFactory } from './interfaces/BlockchainAdapter';
import Logger from '@/utils/logger';
import type { Logger as LoggerType } from 'winston';

export class CryptoManagerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CryptoManagerError';
  }
}

export class BlockchainManagerImpl implements BlockchainManager {
  private adapters: Map<string, BlockchainAdapter> = new Map();
  private defaultBlockchain: string | null = null;
  private logger: LoggerType;
  private adapterFactory: AdapterFactory;

  constructor(adapterFactory: AdapterFactory, logger: LoggerType) {
    this.adapterFactory = adapterFactory;
    this.logger = logger;
  }

  /**
   * Get adapter for specific blockchain
   */
  async getAdapter(blockchain: string): Promise<BlockchainAdapter> {
    const normalizedBlockchain = blockchain.toLowerCase();
    
    // Return existing adapter if available
    if (this.adapters.has(normalizedBlockchain)) {
      const adapter = this.adapters.get(normalizedBlockchain)!;
      
      // Verify adapter is still connected
      if (!adapter.isConnected()) {
        this.logger.warn(`Adapter for ${blockchain} is disconnected, reconnecting...`);
        await adapter.connect();
      }
      
      return adapter;
    }

    // Create new adapter if not exists
    if (!this.adapterFactory.isSupported(normalizedBlockchain)) {
      throw new CryptoManagerError(
        `Blockchain ${blockchain} is not supported`,
        'UNSUPPORTED_BLOCKCHAIN'
      );
    }

    try {
      const adapter = await this.adapterFactory.createAdapter(normalizedBlockchain);
      await adapter.connect();
      
      this.adapters.set(normalizedBlockchain, adapter);
      this.logger.info(`Successfully created and connected adapter for ${blockchain}`);
      
      // Set as default if no default is set
      if (!this.defaultBlockchain) {
        this.defaultBlockchain = normalizedBlockchain;
        this.logger.info(`Set ${blockchain} as default blockchain`);
      }
      
      return adapter;
    } catch (error) {
      this.logger.error(`Failed to create adapter for ${blockchain}:`, error);
      throw new CryptoManagerError(
        `Failed to create adapter for blockchain ${blockchain}`,
        'ADAPTER_CREATION_FAILED'
      );
    }
  }

  /**
   * Add existing adapter to manager
   */
  addAdapter(blockchain: string, adapter: BlockchainAdapter): void {
    const normalizedBlockchain = blockchain.toLowerCase();
    
    if (this.adapters.has(normalizedBlockchain)) {
      this.logger.warn(`Replacing existing adapter for ${blockchain}`);
    }
    
    this.adapters.set(normalizedBlockchain, adapter);
    this.logger.info(`Added adapter for ${blockchain}`);
    
    // Set as default if no default is set
    if (!this.defaultBlockchain) {
      this.defaultBlockchain = normalizedBlockchain;
    }
  }

  /**
   * Remove adapter from manager
   */
  async removeAdapter(blockchain: string): Promise<void> {
    const normalizedBlockchain = blockchain.toLowerCase();
    
    if (this.adapters.has(normalizedBlockchain)) {
      const adapter = this.adapters.get(normalizedBlockchain)!;
      
      try {
        await adapter.disconnect();
      } catch (error) {
        this.logger.warn(`Error disconnecting adapter for ${blockchain}:`, error);
      }
      
      this.adapters.delete(normalizedBlockchain);
      this.logger.info(`Removed adapter for ${blockchain}`);
      
      // Reset default if it was the removed blockchain
      if (this.defaultBlockchain === normalizedBlockchain) {
        this.defaultBlockchain = this.adapters.size > 0 
          ? this.adapters.keys().next().value || null
          : null;
      }
    }
  }

  /**
   * Get default adapter
   */
  getDefaultAdapter(): BlockchainAdapter | null {
    if (!this.defaultBlockchain) {
      return null;
    }
    
    return this.adapters.get(this.defaultBlockchain) || null;
  }

  /**
   * Set default blockchain
   */
  setDefaultAdapter(blockchain: string): void {
    const normalizedBlockchain = blockchain.toLowerCase();
    
    if (!this.adapters.has(normalizedBlockchain)) {
      throw new CryptoManagerError(
        `Cannot set ${blockchain} as default: adapter not found`,
        'ADAPTER_NOT_FOUND'
      );
    }
    
    this.defaultBlockchain = normalizedBlockchain;
    this.logger.info(`Set ${blockchain} as default blockchain`);
  }

  /**
   * Get list of supported blockchains
   */
  getSupportedBlockchains(): string[] {
    return this.adapterFactory.getSupportedBlockchains();
  }

  /**
   * Get list of active adapters
   */
  getActiveAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if adapter exists for blockchain
   */
  hasAdapter(blockchain: string): boolean {
    return this.adapters.has(blockchain.toLowerCase());
  }

  /**
   * Get adapter connection status
   */
  getAdapterStatus(blockchain: string): 'connected' | 'disconnected' | 'not_found' {
    const adapter = this.adapters.get(blockchain.toLowerCase());
    
    if (!adapter) {
      return 'not_found';
    }
    
    return adapter.isConnected() ? 'connected' : 'disconnected';
  }

  /**
   * Reconnect all adapters
   */
  async reconnectAll(): Promise<void> {
    const reconnectPromises = Array.from(this.adapters.entries()).map(
      async ([blockchain, adapter]) => {
        try {
          if (!adapter.isConnected()) {
            await adapter.connect();
            this.logger.info(`Reconnected adapter for ${blockchain}`);
          }
        } catch (error) {
          this.logger.error(`Failed to reconnect adapter for ${blockchain}:`, error);
        }
      }
    );
    
    await Promise.all(reconnectPromises);
  }

  /**
   * Disconnect all adapters
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.entries()).map(
      async ([blockchain, adapter]) => {
        try {
          await adapter.disconnect();
          this.logger.info(`Disconnected adapter for ${blockchain}`);
        } catch (error) {
          this.logger.error(`Failed to disconnect adapter for ${blockchain}:`, error);
        }
      }
    );
    
    await Promise.all(disconnectPromises);
    
    this.adapters.clear();
    this.defaultBlockchain = null;
  }

  /**
   * Get health status of all adapters
   */
  async getHealthStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};
    
    for (const [blockchain, adapter] of this.adapters.entries()) {
      try {
        const isConnected = adapter.isConnected();
        const network = adapter.getNetwork();
        
        status[blockchain] = {
          connected: isConnected,
          network: network?.name || 'unknown',
          isTestnet: network?.isTestnet || false,
          lastChecked: new Date()
        };
        
        if (isConnected) {
          // Additional health checks can be added here
          try {
            await adapter.getCurrentBlockNumber();
            status[blockchain].blockchainReachable = true;
          } catch (error) {
            status[blockchain].blockchainReachable = false;
            status[blockchain].error = (error as Error).message;
          }
        }
      } catch (error) {
        status[blockchain] = {
          connected: false,
          error: (error as Error).message,
          lastChecked: new Date()
        };
      }
    }
    
    return {
      defaultBlockchain: this.defaultBlockchain,
      adapters: status,
      totalAdapters: this.adapters.size,
      supportedBlockchains: this.getSupportedBlockchains()
    };
  }
}