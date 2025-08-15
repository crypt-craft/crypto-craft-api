/**
 * Token Service Interface
 * Defines all token-related operations for the platform
 */

import { BlockchainAdapter, CreateTokenParams, CreateNFTParams, TransactionResult } from './BlockchainAdapter';

export interface TokenCreationRequest {
  userId: string;
  blockchain: string;
  tokenParams: CreateTokenParams;
  paymentReference?: string;
}

export interface NFTCreationRequest {
  userId: string;
  blockchain: string;
  nftParams: CreateNFTParams;
  collectionId?: string;
}

export interface TokenUpdateRequest {
  tokenId: string;
  metadata?: Partial<TokenMetadata>;
  supply?: number;
  frozen?: boolean;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  properties?: Record<string, any>;
  tags?: string[];
}

export interface Token {
  id: string;
  mintAddress: string;
  creator: string;
  blockchain: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: number;
  metadata: TokenMetadata;
  isVerified: boolean;
  isFrozen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NFT {
  id: string;
  mintAddress: string;
  owner: string;
  creator: string;
  blockchain: string;
  collectionId?: string;
  metadata: TokenMetadata;
  attributes: NFTAttribute[];
  rarity?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
  display_type?: string;
  rarity?: number;
}

export interface TokenCollection {
  id: string;
  address: string;
  creator: string;
  blockchain: string;
  name: string;
  description: string;
  image: string;
  totalSupply: number;
  mintedCount: number;
  floorPrice?: number;
  volume24h?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenBalance {
  userId: string;
  tokenAddress: string;
  balance: string;
  decimals: number;
  usdValue?: number;
  lastUpdated: Date;
}

export interface TokenPriceData {
  tokenAddress: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  lastUpdated: Date;
}

export interface TokenSearchFilters {
  creator?: string;
  blockchain?: string;
  tokenType?: 'FUNGIBLE' | 'NON_FUNGIBLE' | 'MEMECOIN';
  isVerified?: boolean;
  minSupply?: number;
  maxSupply?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  tags?: string[];
}

export interface TokenAnalytics {
  tokenId: string;
  totalHolders: number;
  transactionsCount: number;
  volume24h: number;
  priceChange24h: number;
  liquidityUsd?: number;
  marketCap?: number;
  fdv?: number; // Fully Diluted Valuation
}

/**
 * Main Token Service Interface
 */
export interface ITokenService {
  // Token Creation
  createToken(request: TokenCreationRequest): Promise<Token>;
  createNFT(request: NFTCreationRequest): Promise<NFT>;
  createNFTCollection(request: NFTCreationRequest): Promise<TokenCollection>;
  
  // Token Management
  updateToken(request: TokenUpdateRequest): Promise<Token>;
  freezeToken(tokenId: string): Promise<boolean>;
  unfreezeToken(tokenId: string): Promise<boolean>;
  burnTokens(tokenId: string, amount: number): Promise<TransactionResult>;
  mintAdditionalTokens(tokenId: string, amount: number): Promise<TransactionResult>;
  
  // Token Queries
  getTokenById(tokenId: string): Promise<Token | null>;
  getTokenByAddress(address: string): Promise<Token | null>;
  getTokensByCreator(creatorId: string): Promise<Token[]>;
  getTokensByOwner(ownerId: string): Promise<Token[]>;
  searchTokens(filters: TokenSearchFilters): Promise<Token[]>;
  
  // NFT Queries
  getNFTById(nftId: string): Promise<NFT | null>;
  getNFTsByCollection(collectionId: string): Promise<NFT[]>;
  getNFTsByOwner(ownerId: string): Promise<NFT[]>;
  
  // Collections
  getCollectionById(collectionId: string): Promise<TokenCollection | null>;
  getCollectionsByCreator(creatorId: string): Promise<TokenCollection[]>;
  
  // Balances & Analytics
  getUserTokenBalances(userId: string): Promise<TokenBalance[]>;
  getTokenAnalytics(tokenId: string): Promise<TokenAnalytics>;
  getTokenPriceData(tokenAddress: string): Promise<TokenPriceData | null>;
  
  // Verification
  submitForVerification(tokenId: string): Promise<boolean>;
  verifyToken(tokenId: string, isVerified: boolean): Promise<boolean>;
  
  // Metadata Management
  uploadMetadata(metadata: TokenMetadata): Promise<string>; // Returns IPFS hash
  updateMetadata(tokenId: string, metadata: Partial<TokenMetadata>): Promise<boolean>;
  
  // Utilities
  validateTokenParams(params: CreateTokenParams): Promise<boolean>;
  estimateCreationCost(params: CreateTokenParams): Promise<number>;
  getCreationStatus(transactionId: string): Promise<TransactionResult>;
}