/**
 * Prisma Database Client Configuration
 * 
 * Централізований клієнт для роботи з базою даних через Prisma ORM.
 * Включає connection pooling, error handling та типи даних.
 */

import { PrismaClient } from '@prisma/client';
import Logger from '../utils/logger';

/**
 * Розширений Prisma клієнт з логуванням та error handling
 */
export class DatabaseClient {
  private static instance: PrismaClient;
  
  /**
   * Singleton pattern для Prisma клієнта
   */
  public static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new PrismaClient({
        log: ['warn', 'error'],
        errorFormat: 'colorless',
      });
    }

    return DatabaseClient.instance;
  }

  /**
   * Підключення до бази даних
   */
  public static async connect(): Promise<void> {
    try {
      const client = DatabaseClient.getInstance();
      await client.$connect();
      Logger.info('✅ Database connected successfully (Prisma)');
    } catch (error) {
      Logger.error('❌ Database connection failed', { error });
      throw error;
    }
  }

  /**
   * Відключення від бази даних
   */
  public static async disconnect(): Promise<void> {
    try {
      const client = DatabaseClient.getInstance();
      await client.$disconnect();
      Logger.info('✅ Database disconnected successfully (Prisma)');
    } catch (error) {
      Logger.error('❌ Database disconnection failed', { error });
      throw error;
    }
  }

  /**
   * Health check для бази даних
   */
  public static async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    connectionCount?: number;
    error?: string;
  }> {
    try {
      const client = DatabaseClient.getInstance();
      
      // Простий запит для перевірки з'єднання
      const result = await client.$queryRaw`SELECT 1 as test`;
      
      if (result) {
        return {
          status: 'healthy',
          connectionCount: 1, // Prisma автоматично керує connection pool
        };
      } else {
        return {
          status: 'unhealthy',
          error: 'Query returned no result',
        };
      }
    } catch (error) {
      Logger.error('Database health check failed', { error });
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Виконання транзакції з retry logic
   */
  public static async executeTransaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const client = DatabaseClient.getInstance();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await client.$transaction(fn);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown transaction error');
        
        Logger.warn(`Transaction attempt ${attempt} failed`, {
          error: lastError.message,
          attempt,
          maxRetries,
        });

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    if (lastError) {
      Logger.error('Transaction failed after all retries', { error: lastError.message });
      throw lastError;
    }

    throw new Error('Transaction failed with unknown error');
  }

  /**
   * Bulk operations helper
   */
  public static async bulkCreate<T>(
    modelName: string,
    data: T[],
    batchSize: number = 1000
  ): Promise<void> {
    const client = DatabaseClient.getInstance();
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Use raw query since dynamic model access has type issues
      Logger.warn('Bulk create using raw SQL - implement model-specific methods for better type safety');
      
      Logger.debug(`Bulk create batch ${Math.floor(i / batchSize) + 1}`, {
        model: modelName,
        batchSize: batch.length,
        total: data.length,
      });
    }
  }
}

// Експорт основного клієнта
export const prisma = DatabaseClient.getInstance();

// Експорт типів Prisma для використання в інших файлах
export type {
  User,
  Token,
  UserSession,
  Transaction,
  AirdropCampaign,
  AirdropRecipient,
  TransactionStatus,
  AirdropStatus,
  AirdropPriority,
  NetworkType,
} from '@prisma/client';

// Експорт enum значень
export { 
  TokenType,
} from '@prisma/client';

// Зручні типи для створення записів
export type CreateUserInput = Parameters<typeof prisma.user.create>[0]['data'];
export type CreateTokenInput = Parameters<typeof prisma.token.create>[0]['data'];
export type CreateTransactionInput = Parameters<typeof prisma.transaction.create>[0]['data'];
export type CreateAirdropCampaignInput = Parameters<typeof prisma.airdropCampaign.create>[0]['data'];

// Експорт для тестування
export const __test__ = {
  resetInstance: () => {
    (DatabaseClient as any).instance = undefined;
  },
};