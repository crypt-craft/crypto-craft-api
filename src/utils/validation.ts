/**
 * Validation Utilities
 * Joi schemas and validation functions for the application
 */

import Joi from 'joi';
import { CreateTokenParams, CreateNFTParams, AirdropParams } from '@/core/interfaces/BlockchainAdapter';

// Custom Solana address validator
const solanaAddressSchema = Joi.string().length(44).pattern(/^[1-9A-HJ-NP-Za-km-z]{44}$/);

// Token validation schemas
export const createTokenSchema = Joi.object<CreateTokenParams>({
  name: Joi.string().min(1).max(32).required(),
  symbol: Joi.string().min(1).max(10).uppercase().required(),
  decimals: Joi.number().integer().min(0).max(18).required(),
  initialSupply: Joi.number().min(0).required(),
  mintAuthority: solanaAddressSchema.optional(),
  freezeAuthority: solanaAddressSchema.optional(),
  metadata: Joi.object({
    name: Joi.string().required(),
    symbol: Joi.string().required(),
    description: Joi.string().optional(),
    image: Joi.string().uri().optional(),
    externalUrl: Joi.string().uri().optional(),
    properties: Joi.object().optional()
  }).optional()
}).unknown(true);

// NFT validation schemas
export const createNFTSchema = Joi.object<CreateNFTParams>({
  name: Joi.string().min(1).max(100).required(),
  symbol: Joi.string().min(1).max(10).uppercase().required(),
  description: Joi.string().max(1000).optional(),
  image: Joi.string().uri().required(),
  externalUrl: Joi.string().uri().optional(),
  attributes: Joi.array().items(
    Joi.object({
      trait_type: Joi.string().required(),
      value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      display_type: Joi.string().optional()
    })
  ).optional(),
  collection: solanaAddressSchema.optional()
});

// Airdrop validation schemas
export const airdropSchema = Joi.object<AirdropParams>({
  tokenAddress: solanaAddressSchema.required(),
  recipients: Joi.array().items(
    Joi.object({
      address: solanaAddressSchema.required(),
      amount: Joi.number().positive().required()
    })
  ).min(1).max(10000).required(),
  batchSize: Joi.number().integer().min(1).max(100).optional()
});

// User validation schemas
export const userRegistrationSchema = Joi.object({
  walletAddress: solanaAddressSchema.required(),
  email: Joi.string().email().optional(),
  username: Joi.string().alphanum().min(3).max(30).optional()
});

export const userUpdateSchema = Joi.object({
  email: Joi.string().email().optional(),
  username: Joi.string().alphanum().min(3).max(30).optional(),
  bio: Joi.string().max(500).optional(),
  avatarUrl: Joi.string().uri().optional()
});

// Campaign validation schemas
export const airdropCampaignSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(1000).optional(),
  tokenId: Joi.string().uuid().required(),
  totalAmount: Joi.number().positive().required(),
  recipients: Joi.array().items(
    Joi.object({
      address: solanaAddressSchema.required(),
      amount: Joi.number().positive().required()
    })
  ).min(1).max(10000).required(),
  scheduledAt: Joi.date().greater('now').optional(),
  batchSize: Joi.number().integer().min(1).max(100).optional(),
  priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT').optional(),
  conditions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('MIN_BALANCE', 'NFT_HOLDER', 'WHITELIST', 'CUSTOM').required(),
      value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      tokenAddress: solanaAddressSchema.when('type', {
        is: Joi.string().valid('MIN_BALANCE', 'NFT_HOLDER'),
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      description: Joi.string().max(200).optional()
    })
  ).optional()
});

// Validation functions
export class ValidationError extends Error {
  constructor(message: string, public details: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateCreateToken(data: any): CreateTokenParams {
  const { error, value } = createTokenSchema.validate(data);
  if (error) {
    throw new ValidationError('Token validation failed', error.details);
  }
  return value;
}

export function validateCreateNFT(data: any): CreateNFTParams {
  const { error, value } = createNFTSchema.validate(data);
  if (error) {
    throw new ValidationError('NFT validation failed', error.details);
  }
  return value;
}

export function validateAirdrop(data: any): AirdropParams {
  const { error, value } = airdropSchema.validate(data);
  if (error) {
    throw new ValidationError('Airdrop validation failed', error.details);
  }
  return value;
}

export function validateUserRegistration(data: any) {
  const { error, value } = userRegistrationSchema.validate(data);
  if (error) {
    throw new ValidationError('User registration validation failed', error.details);
  }
  return value;
}

export function validateUserUpdate(data: any) {
  const { error, value } = userUpdateSchema.validate(data);
  if (error) {
    throw new ValidationError('User update validation failed', error.details);
  }
  return value;
}

export function validateAirdropCampaign(data: any) {
  const { error, value } = airdropCampaignSchema.validate(data);
  if (error) {
    throw new ValidationError('Airdrop campaign validation failed', error.details);
  }
  return value;
}

// Address validation utilities
export function isValidSolanaAddress(address: string): boolean {
  try {
    const { error } = solanaAddressSchema.validate(address);
    return !error;
  } catch {
    return false;
  }
}

export function validateSolanaAddresses(addresses: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  
  for (const address of addresses) {
    if (isValidSolanaAddress(address)) {
      valid.push(address);
    } else {
      invalid.push(address);
    }
  }
  
  return { valid, invalid };
}

// Amount validation utilities
export function validateTokenAmount(amount: number, decimals: number): boolean {
  if (amount <= 0) return false;
  
  // Check if amount has more decimal places than token supports
  const amountStr = amount.toString();
  const decimalPlaces = amountStr.includes('.') ? amountStr.split('.')[1]?.length || 0 : 0;
  
  return decimalPlaces <= decimals;
}

export function normalizeTokenAmount(amount: number, decimals: number): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

// Batch validation for large operations
export function validateAirdropBatch(recipients: Array<{ address: string; amount: number }>, maxBatchSize: number = 100) {
  if (recipients.length === 0) {
    throw new ValidationError('Recipients list cannot be empty', null);
  }
  
  if (recipients.length > maxBatchSize) {
    throw new ValidationError(`Batch size cannot exceed ${maxBatchSize}`, null);
  }
  
  const { valid, invalid } = validateSolanaAddresses(recipients.map(r => r.address));
  
  if (invalid.length > 0) {
    throw new ValidationError('Invalid Solana addresses found', { invalidAddresses: invalid });
  }
  
  const invalidAmounts = recipients.filter(r => r.amount <= 0);
  if (invalidAmounts.length > 0) {
    throw new ValidationError('Invalid amounts found', { invalidAmounts });
  }
  
  return true;
}