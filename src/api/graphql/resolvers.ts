/**
 * GraphQL Resolvers
 * Реалізація resolvers для безпечної Web3 взаємодії
 */

import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import { TransactionBuilderService } from '@/services/TransactionBuilder';
import { TokenService } from '@/services/TokenService';
import { AuthService } from '@/services/AuthService';
import { validateCreateToken, validateUserUpdate } from '@/utils/validation';
import { UserRole } from '@/middleware/auth';
import { prisma, TokenType } from '@/database/prisma';
import Logger from '@/utils/logger';
import type { Context } from '@/app';

// Типи для resolvers
interface CreateTokenInput {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  description?: string;
  imageUrl?: string;
  externalUrl?: string;
  tokenType?: TokenType;
}

interface UpdateProfileInput {
  username?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
}

interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

interface TokenFilterInput {
  tokenType?: TokenType;
  verified?: boolean;
  creatorId?: string;
  search?: string;
}

// Helper функції
function requireAuth(context: Context) {
  if (!context.user) {
    throw new AuthenticationError('Authentication required');
  }
  return context.user;
}

function requireRole(context: Context, allowedRoles: UserRole[]) {
  const user = requireAuth(context);
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }
  return user;
}

// Пагінація helper
function buildPaginationQuery(pagination?: PaginationInput) {
  const take = pagination?.first || pagination?.last || 20;
  const skip = pagination?.after ? 1 : 0;
  
  return {
    take: Math.min(take, 100), // Максимум 100 records
    skip,
    cursor: pagination?.after ? { id: pagination.after } : undefined
  };
}

export const resolvers = {
  // Queries
  Query: {
    // Basic test queries expected by integration tests
    hello: () => 'Hello from CryptoCraft API!',
    healthCheck: async (_: any, __: any, context: Context) => {
      const healthStatus = await context.blockchainManager.getHealthStatus();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        blockchains: Object.entries(healthStatus.adapters).map(([name, status]: [string, any]) => ({
          name,
          connected: status.connected,
          network: status.network
        }))
      };
    },
    // Поточний користувач
    me: async (_: any, __: any, context: Context) => {
      return context.user || null;
    },

    // Користувач за ID
    user: async (_: any, { id }: { id: string }, context: Context) => {
      return await prisma.user.findUnique({
        where: { id },
        include: {
          tokens: true
        }
      });
    },

    // Список користувачів з пагінацією
    users: async (_: any, { pagination, search }: { 
      pagination?: PaginationInput; 
      search?: string; 
    }, context: Context) => {
      requireRole(context, [UserRole.ADMIN, UserRole.MODERATOR]);

      const query = buildPaginationQuery(pagination);
      const where = search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { walletAddress: { contains: search, mode: 'insensitive' as const } }
        ]
      } : {};

      const users = await prisma.user.findMany({
        ...query,
        where,
        include: { tokens: true }
      });

      const totalCount = await prisma.user.count({ where });

      return {
        edges: users.map(user => ({
          node: user,
          cursor: user.id
        })),
        pageInfo: {
          hasNextPage: users.length === query.take,
          hasPreviousPage: !!pagination?.after,
          startCursor: users[0]?.id,
          endCursor: users[users.length - 1]?.id
        },
        totalCount
      };
    },

    // Токен за ID або mint address
    token: async (_: any, { id }: { id?: string }, context: Context) => {
      if (!id) return null;

      return await prisma.token.findUnique({
        where: { id },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });
    },

    tokenByMint: async (_: any, { mintAddress }: { mintAddress: string }, context: Context) => {
      return await prisma.token.findUnique({
        where: { mintAddress },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });
    },

    // Список токенів з фільтрацією та пагінацією
    tokens: async (_: any, { 
      pagination, 
      filter, 
      sortBy = 'createdAt', 
      sortOrder = 'DESC' 
    }: {
      pagination?: PaginationInput;
      filter?: TokenFilterInput;
      sortBy?: string;
      sortOrder?: string;
    }, context: Context) => {
      const query = buildPaginationQuery(pagination);
      
      const where: any = {};
      if (filter?.tokenType) where.tokenType = filter.tokenType;
      if (filter?.verified !== undefined) where.isVerified = filter.verified;
      if (filter?.creatorId) where.creatorId = filter.creatorId;
      if (filter?.search) {
        where.OR = [
          { name: { contains: filter.search, mode: 'insensitive' as const } },
          { symbol: { contains: filter.search, mode: 'insensitive' as const } },
          { mintAddress: { contains: filter.search, mode: 'insensitive' as const } }
        ];
      }

      const orderBy: any = {};
      orderBy[sortBy] = sortOrder.toLowerCase();

      const tokens = await prisma.token.findMany({
        ...query,
        where,
        orderBy,
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });

      const totalCount = await prisma.token.count({ where });

      return {
        edges: tokens.map(token => ({
          node: token,
          cursor: token.id
        })),
        pageInfo: {
          hasNextPage: tokens.length === query.take,
          hasPreviousPage: !!pagination?.after,
          startCursor: tokens[0]?.id,
          endCursor: tokens[tokens.length - 1]?.id
        },
        totalCount
      };
    },

    // Trending токени
    trendingTokens: async (_: any, { limit = 10 }: { limit?: number }, context: Context) => {
      // Поки що повертаємо останні створені токени
      // TODO: Додати реальну логіку trending на основі volume, holders, тощо
      return await prisma.token.findMany({
        take: Math.min(limit, 50),
        orderBy: { createdAt: 'desc' },
        where: { isVerified: true },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });
    },

    // Нові токени
    recentTokens: async (_: any, { limit = 10 }: { limit?: number }, context: Context) => {
      return await prisma.token.findMany({
        take: Math.min(limit, 50),
        orderBy: { createdAt: 'desc' },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });
    },

    // Мої токени
    myTokens: async (_: any, { pagination }: { pagination?: PaginationInput }, context: Context) => {
      const user = requireAuth(context);
      const query = buildPaginationQuery(pagination);

      const tokens = await prisma.token.findMany({
        ...query,
        where: { creatorId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });

      const totalCount = await prisma.token.count({
        where: { creatorId: user.id }
      });

      return {
        edges: tokens.map(token => ({
          node: token,
          cursor: token.id
        })),
        pageInfo: {
          hasNextPage: tokens.length === query.take,
          hasPreviousPage: !!pagination?.after,
          startCursor: tokens[0]?.id,
          endCursor: tokens[tokens.length - 1]?.id
        },
        totalCount
      };
    },

    // Статистика платформи
    platformStats: async (_: any, __: any, context: Context) => {
      const [totalUsers, activeUsers, totalTokens, totalAirdrops] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.token.count(),
        prisma.airdropCampaign.count()
      ]);

      return {
        totalUsers,
        activeUsers,
        totalTokens,
        totalAirdrops,
        totalTransactions: 0, // TODO: Додати Transaction model
        totalVolume: "0" // TODO: Обчислити total volume
      };
    },

    // Інформація про мережу
    networkInfo: async (_: any, __: any, context: Context) => {
      const transactionBuilder = new TransactionBuilderService();
      return await transactionBuilder.getNetworkInfo();
    },

    // Валідація адреси
    validateAddress: async (_: any, { address }: { address: string }, context: Context) => {
      const transactionBuilder = new TransactionBuilderService();
      return transactionBuilder.validatePublicKey(address);
    }
  },

  // Mutations
  Mutation: {
    // Створення unsigned транзакції для токену
    createTokenTransaction: async (_: any, { input }: { input: CreateTokenInput }, context: Context) => {
      const user = requireAuth(context);

      try {
        // Валідація input
        validateCreateToken(input);

        const transactionBuilder = new TransactionBuilderService();
        const result = await transactionBuilder.createTokenTransaction({
          userPublicKey: user.walletAddress,
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          initialSupply: input.initialSupply,
          description: input.description,
          imageUrl: input.imageUrl,
          externalUrl: input.externalUrl
        });

        if (!result.success) {
          throw new UserInputError(result.error || 'Failed to create transaction');
        }

        return {
          transaction: result.transaction!,
          metadata: {
            mintAddress: result.metadata?.mintAddress,
            tokenAccountAddress: result.metadata?.tokenAccountAddress,
            estimatedFee: result.metadata?.estimatedFee || 0,
            instructions: result.metadata?.instructions || [],
            network: (process.env.SOLANA_RPC_URL || '').includes('devnet') ? 'devnet' : 'mainnet-beta'
          },
          signingInstructions: [
            'Your wallet will prompt you to sign this transaction',
            'Review the transaction details carefully',
            'Sign the transaction in your wallet',
            'Send the signed transaction back to complete the process',
            'NEVER share your private key with anyone!'
          ]
        };

      } catch (error) {
        Logger.error('GraphQL createTokenTransaction error', { error, userId: user.id });
        throw new UserInputError(
          error instanceof Error ? error.message : 'Failed to create token transaction'
        );
      }
    },

    // Відправка підписаної транзакції
    submitSignedTransaction: async (_: any, { 
      signedTransaction, 
      metadata 
    }: { 
      signedTransaction: string; 
      metadata?: any; 
    }, context: Context) => {
      const user = requireAuth(context);

      try {
        const transactionBuilder = new TransactionBuilderService();
        const result = await transactionBuilder.submitSignedTransaction({
          signedTransaction,
          originalTxHash: metadata?.txHash
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error
          };
        }

        return {
          success: true,
          signature: result.signature,
          explorerUrl: result.explorerUrl
        };

      } catch (error) {
        Logger.error('GraphQL submitSignedTransaction error', { error, userId: user.id });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transaction submission failed'
        };
      }
    },

    // Створення unsigned транзакції для оновлення метаданих токену
    createUpdateMetadataTransaction: async (_: any, { input }: { input: { mintAddress: string; name?: string; symbol?: string; uri: string; } }, context: Context) => {
      const user = requireAuth(context);
      try {
        const transactionBuilder = new TransactionBuilderService();
        const result = await transactionBuilder.createUpdateMetadataTransaction({
          userPublicKey: user.walletAddress,
          mintAddress: input.mintAddress,
          name: input.name,
          symbol: input.symbol,
          uri: input.uri
        });

        if (!result.success) {
          throw new UserInputError(result.error || 'Failed to create update metadata transaction');
        }

        return {
          transaction: result.transaction!,
          metadata: {
            mintAddress: result.metadata?.mintAddress,
            tokenAccountAddress: result.metadata?.tokenAccountAddress,
            metadataAddress: result.metadata?.metadataAddress,
            estimatedFee: result.metadata?.estimatedFee || 0,
            instructions: result.metadata?.instructions || [],
            network: (process.env.SOLANA_RPC_URL || '').includes('devnet') ? 'devnet' : 'mainnet-beta'
          },
          signingInstructions: [
            'Your wallet will prompt you to sign this transaction',
            'Review the transaction details carefully',
            'Sign the transaction in your wallet',
            'Send the signed transaction back to complete the process'
          ]
        };
      } catch (error) {
        Logger.error('GraphQL createUpdateMetadataTransaction error', { error, userId: user.id });
        throw new UserInputError(error instanceof Error ? error.message : 'Failed to create update metadata transaction');
      }
    },

    // Збереження метаданих токену після створення
    saveTokenMetadata: async (_: any, {
      mintAddress,
      transactionSignature,
      tokenData
    }: {
      mintAddress: string;
      transactionSignature: string;
      tokenData: CreateTokenInput;
    }, context: Context) => {
      const user = requireAuth(context);

      try {
        const tokenService = new TokenService(context.blockchainManager);
        const DB_OFF = process.env.DB_OFF_MODE === 'true';

        if (DB_OFF) {
          const token = {
            id: mintAddress,
            mintAddress,
            blockchain: 'solana',
            name: tokenData.name,
            symbol: tokenData.symbol,
            decimals: tokenData.decimals,
            supply: tokenData.initialSupply.toString(),
            tokenType: tokenData.tokenType || TokenType.FUNGIBLE,
            metadata: {
              name: tokenData.name,
              symbol: tokenData.symbol,
              description: tokenData.description,
              image: tokenData.imageUrl,
              external_url: tokenData.externalUrl
            },
            isVerified: false,
            isFrozen: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            creator: user,
            creatorId: user.id
          } as any;

          Logger.info('DB_OFF_MODE: returning in-memory token metadata', {
            mintAddress,
            transactionSignature,
            userId: user.id
          });

          return token;
        }

        // Поки що використаємо створення токену напряму через Prisma
        // TODO: Додати правильний метод saveTokenMetadata в TokenService
        const userRecord = await prisma.user.findUnique({
          where: { walletAddress: user.walletAddress }
        });

        if (!userRecord) {
          throw new UserInputError('User not found');
        }

        const token = await prisma.token.create({
          data: {
            mintAddress,
            creatorId: userRecord.id,
            blockchain: 'solana',
            name: tokenData.name,
            symbol: tokenData.symbol,
            decimals: tokenData.decimals,
            supply: tokenData.initialSupply.toString(),
            tokenType: tokenData.tokenType || TokenType.FUNGIBLE,
            metadata: {
              name: tokenData.name,
              symbol: tokenData.symbol,
              description: tokenData.description,
              image: tokenData.imageUrl,
              external_url: tokenData.externalUrl
            },
            isVerified: false,
            isFrozen: false
          },
          include: {
            creator: true
          }
        });

        Logger.info('Token metadata saved via GraphQL', {
          tokenId: token.id,
          mintAddress,
          transactionSignature,
          userId: user.id
        });

        return token;

      } catch (error) {
        Logger.error('GraphQL saveTokenMetadata error', { error, userId: user.id });
        throw new UserInputError(
          error instanceof Error ? error.message : 'Failed to save token metadata'
        );
      }
    },

    // Оновлення профілю
    updateProfile: async (_: any, { input }: { input: UpdateProfileInput }, context: Context) => {
      const user = requireAuth(context);

      try {
        validateUserUpdate(input);

        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...input,
            updatedAt: new Date()
          },
          include: {
            tokens: true
          }
        });

        Logger.info('User profile updated via GraphQL', {
          userId: user.id,
          updates: Object.keys(input)
        });

        return updatedUser;

      } catch (error) {
        Logger.error('GraphQL updateProfile error', { error, userId: user.id });
        throw new UserInputError(
          error instanceof Error ? error.message : 'Profile update failed'
        );
      }
    },

    // Верифікація токену (тільки адміни)
    verifyToken: async (_: any, { tokenId }: { tokenId: string }, context: Context) => {
      requireRole(context, [UserRole.ADMIN, UserRole.MODERATOR]);

      const token = await prisma.token.update({
        where: { id: tokenId },
        data: { 
          isVerified: true,
          updatedAt: new Date()
        },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });

      Logger.info('Token verified', { tokenId, adminId: context.user!.id });
      return token;
    },

    // Заморозка токену (тільки адміни)
    freezeToken: async (_: any, { tokenId }: { tokenId: string }, context: Context) => {
      requireRole(context, [UserRole.ADMIN]);

      const token = await prisma.token.update({
        where: { id: tokenId },
        data: { 
          isFrozen: true,
          updatedAt: new Date()
        },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });

      Logger.info('Token frozen', { tokenId, adminId: context.user!.id });
      return token;
    }
  },

  // Field resolvers
  User: {
    role: (parent: any, _args: any, context: Context) => {
      if (context.user && context.user.id === parent.id) {
        return context.user.role;
      }
      return UserRole.USER;
    },
    isActive: (parent: any) => {
      if (typeof parent.isActive === 'boolean') return parent.isActive;
      return true;
    },
    lastLoginAt: (parent: any) => parent.lastLoginAt || null,
    createdTokensCount: async (parent: any) => {
      return await prisma.token.count({
        where: { creatorId: parent.id }
      });
    },
    tokens: async (parent: any) => {
      return await prisma.token.findMany({
        where: { creatorId: parent.id },
        include: {
          creator: true,
          // airdrops: true // TODO: Додати коли буде AirdropCampaign model
        }
      });
    }
  },

  Token: {
    creator: async (parent: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.creatorId }
      });
    },

    // TODO: Додати airdrops relation коли буде створена AirdropCampaign model
    // airdrops: async (parent: any) => {
    //   return await prisma.airdropCampaign.findMany({
    //     where: { tokenId: parent.id }
    //   });
    // }
  }
};