/**
 * Core adapter contracts and DTOs for blockchain operations.
 * Kept broad to accommodate tests and multiple chains. Optional methods are
 * used so concrete adapters can implement only what they need.
 */

export type NetworkInfo = {
  name: string;
  isTestnet: boolean;
  rpcUrl?: string;
};

export interface BlockchainAdapter {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Network/health
  getNetwork(): NetworkInfo | null;
  getCurrentBlockNumber(): Promise<number>;

  // Generic tx helpers
  buildUnsignedTx?(input: unknown): Promise<string>;
  submitSignedTx?(signed: string): Promise<string>;

  // Utilities (commonly mocked in tests)
  validateAddress?(address: string): boolean;
  estimateGas?(input?: unknown): Promise<number>;
  getTransactionStatus?(signature: string): Promise<{ status: string; error?: string }>;

  // Token/NFT operations (optional for specific chains)
  createToken?(params: CreateTokenParams): Promise<any>;
  createNFT?(params: CreateNFTParams): Promise<any>;
  createNFTCollection?(params: any): Promise<any>;
  getTokenInfo?(mintAddress: string): Promise<any>;
  getNFTMetadata?(mintAddress: string): Promise<any>;

  // Airdrop / transfers
  distributeAirdrop?(params: AirdropParams): Promise<any>;
  batchTransfer?(params: any): Promise<any>;

  // Liquidity (not implemented for Solana yet, here for completeness/tests)
  createLiquidityPool?(params: any): Promise<any>;
  addLiquidity?(params: any): Promise<any>;
  removeLiquidity?(params: any): Promise<any>;

  // Balances
  getBalance?(address: string): Promise<string | number>;

  // Payments (generic)
  createPaymentRequest?(params: any): Promise<any>;
  verifyPayment?(params: any): Promise<boolean>;
}

export interface AdapterFactory {
  createAdapter(blockchain: string): Promise<BlockchainAdapter>;
  getSupportedBlockchains(): string[];
  isSupported(blockchain: string): boolean;
  addBlockchainSupport(blockchain: string): void;
  removeBlockchainSupport(blockchain: string): void;
  getAdapterRequirements(blockchain: string): string[];
  validateAdapterConfig(blockchain: string): { valid: boolean; missing: string[] };
  getDefaultConfig(blockchain: string): Record<string, any>;
}

export interface BlockchainManager {
  getAdapter(blockchain: string): Promise<BlockchainAdapter>;
  addAdapter(blockchain: string, adapter: BlockchainAdapter): void;
  removeAdapter(blockchain: string): Promise<void>;
  getDefaultAdapter(): BlockchainAdapter | null;
  setDefaultAdapter(blockchain: string): void;
  getSupportedBlockchains(): string[];
  getActiveAdapters(): string[];
  hasAdapter(blockchain: string): boolean;
  getAdapterStatus(blockchain: string): 'connected' | 'disconnected' | 'not_found';
  reconnectAll(): Promise<void>;
  disconnectAll(): Promise<void>;
  getHealthStatus(): Promise<Record<string, any>>;
}

// DTOs expected by validation and tests
export type CreateTokenParams = {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  mintAuthority?: string;
  freezeAuthority?: string;
  metadata?: {
    name: string;
    symbol: string;
    description?: string;
    image?: string;
    externalUrl?: string;
    properties?: Record<string, unknown>;
  };
};

export type CreateNFTParams = {
  name: string;
  symbol: string;
  description?: string;
  image: string;
  externalUrl?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  collection?: string;
};

export type AirdropParams = {
  tokenAddress: string;
  recipients: Array<{ address: string; amount: number }>;
  batchSize?: number;
};
