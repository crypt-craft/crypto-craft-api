/**
 * Airdrop Service Interface
 * Defines all airdrop-related operations for the platform
 */

import { TransactionResult, AirdropRecipient } from './BlockchainAdapter';

export interface AirdropCampaignRequest {
  userId: string;
  tokenId: string;
  name: string;
  description?: string;
  totalAmount: number;
  recipients: AirdropRecipient[];
  scheduledAt?: Date;
  batchSize?: number;
  priority?: AirdropPriority;
  conditions?: AirdropCondition[];
}

export interface AirdropCondition {
  type: 'MIN_BALANCE' | 'NFT_HOLDER' | 'WHITELIST' | 'CUSTOM';
  value: string | number;
  tokenAddress?: string;
  description?: string;
}

export enum AirdropPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum AirdropStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface AirdropCampaign {
  id: string;
  userId: string;
  tokenId: string;
  name: string;
  description?: string;
  totalAmount: number;
  distributedAmount: number;
  recipientsCount: number;
  successfulRecipients: number;
  failedRecipients: number;
  status: AirdropStatus;
  priority: AirdropPriority;
  batchSize: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  conditions: AirdropCondition[];
  estimatedCost: number;
  actualCost?: number;
}

export interface AirdropRecipientResult {
  campaignId: string;
  recipientAddress: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  transactionSignature?: string;
  errorMessage?: string;
  processedAt?: Date;
  retryCount: number;
}

export interface AirdropBatch {
  id: string;
  campaignId: string;
  batchNumber: number;
  recipients: AirdropRecipient[];
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  startedAt?: Date;
  completedAt?: Date;
  successCount: number;
  failedCount: number;
  totalGasUsed?: number;
}

export interface AirdropAnalytics {
  campaignId: string;
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  totalCost: number;
  averageCostPerRecipient: number;
  averageProcessingTime: number;
  gasEfficiency: number;
  retryRate: number;
}

export interface AirdropFilters {
  userId?: string;
  tokenId?: string;
  status?: AirdropStatus[];
  priority?: AirdropPriority[];
  createdAfter?: Date;
  createdBefore?: Date;
  minAmount?: number;
  maxAmount?: number;
  hasConditions?: boolean;
}

export interface BulkRecipientValidation {
  validRecipients: AirdropRecipient[];
  invalidRecipients: InvalidRecipient[];
  duplicateRecipients: string[];
  totalValidAmount: number;
  totalInvalidAmount: number;
}

export interface InvalidRecipient {
  address: string;
  amount: number;
  reason: string;
}

export interface AirdropEstimate {
  totalCost: number;
  gasCost: number;
  platformFee: number;
  estimatedDuration: number; // in minutes
  recommendedBatchSize: number;
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AirdropProgress {
  campaignId: string;
  totalBatches: number;
  completedBatches: number;
  currentBatch?: number;
  progressPercentage: number;
  estimatedTimeRemaining: number; // in minutes
  averageTimePerBatch: number;
  lastUpdated: Date;
}

/**
 * Main Airdrop Service Interface
 */
export interface IAirdropService {
  // Campaign Management
  createCampaign(request: AirdropCampaignRequest): Promise<AirdropCampaign>;
  updateCampaign(campaignId: string, updates: Partial<AirdropCampaignRequest>): Promise<AirdropCampaign>;
  deleteCampaign(campaignId: string): Promise<boolean>;
  
  // Campaign Execution
  startCampaign(campaignId: string): Promise<boolean>;
  pauseCampaign(campaignId: string): Promise<boolean>;
  resumeCampaign(campaignId: string): Promise<boolean>;
  cancelCampaign(campaignId: string): Promise<boolean>;
  
  // Campaign Queries
  getCampaignById(campaignId: string): Promise<AirdropCampaign | null>;
  getCampaignsByUser(userId: string): Promise<AirdropCampaign[]>;
  getCampaignsByToken(tokenId: string): Promise<AirdropCampaign[]>;
  searchCampaigns(filters: AirdropFilters): Promise<AirdropCampaign[]>;
  
  // Recipient Management
  addRecipients(campaignId: string, recipients: AirdropRecipient[]): Promise<boolean>;
  removeRecipients(campaignId: string, addresses: string[]): Promise<boolean>;
  validateRecipients(recipients: AirdropRecipient[]): Promise<BulkRecipientValidation>;
  
  // Batch Processing
  processBatch(batchId: string): Promise<AirdropBatch>;
  retryFailedRecipients(campaignId: string): Promise<boolean>;
  getBatchesByCampaign(campaignId: string): Promise<AirdropBatch[]>;
  
  // Progress Tracking
  getCampaignProgress(campaignId: string): Promise<AirdropProgress>;
  getRecipientResults(campaignId: string): Promise<AirdropRecipientResult[]>;
  getFailedRecipients(campaignId: string): Promise<AirdropRecipientResult[]>;
  
  // Analytics
  getCampaignAnalytics(campaignId: string): Promise<AirdropAnalytics>;
  getUserAirdropStats(userId: string): Promise<{
    totalCampaigns: number;
    totalDistributed: number;
    totalRecipients: number;
    averageSuccessRate: number;
  }>;
  
  // Utilities
  estimateAirdropCost(request: AirdropCampaignRequest): Promise<AirdropEstimate>;
  validateAirdropRequest(request: AirdropCampaignRequest): Promise<boolean>;
  optimizeBatchSize(recipients: AirdropRecipient[]): Promise<number>;
  
  // Scheduling
  scheduleAirdrop(campaignId: string, scheduledAt: Date): Promise<boolean>;
  getScheduledAirdrops(): Promise<AirdropCampaign[]>;
  
  // Conditional Airdrops
  checkEligibility(address: string, conditions: AirdropCondition[]): Promise<boolean>;
  getEligibleRecipients(
    addresses: string[], 
    conditions: AirdropCondition[]
  ): Promise<string[]>;
}