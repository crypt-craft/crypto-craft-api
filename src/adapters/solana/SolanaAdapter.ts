import { Connection, clusterApiUrl } from '@solana/web3.js';
import type { Logger as LoggerType } from 'winston';

export interface BlockchainAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getNetwork(): { name: string; isTestnet: boolean } | null;
  getCurrentBlockNumber(): Promise<number>;
}

export class SolanaAdapter implements BlockchainAdapter {
  private logger: LoggerType;
  private connection: Connection | null = null;
  private network: { name: string; isTestnet: boolean } | null = null;

  constructor(logger: LoggerType) {
    this.logger = logger;
  }

  async connect(): Promise<void> {
    const rpc = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
    this.connection = new Connection(rpc, 'confirmed');
    this.network = {
      name: rpc.includes('devnet') ? 'devnet' : rpc.includes('mainnet') ? 'mainnet' : 'custom',
      isTestnet: !rpc.includes('mainnet')
    };
    this.logger.info('SolanaAdapter connected', { rpc });
  }

  async disconnect(): Promise<void> {
    this.connection = null;
    this.logger.info('SolanaAdapter disconnected');
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  getNetwork(): { name: string; isTestnet: boolean } | null {
    return this.network;
  }

  async getCurrentBlockNumber(): Promise<number> {
    if (!this.connection) throw new Error('Not connected');
    const slot = await this.connection.getSlot();
    return slot;
  }
}
