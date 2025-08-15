/**
 * AirdropService з Queue System
 * 
 * Використовує Bull Queue з Redis для асинхронної обробки airdrop операцій.
 * Безпечна архітектура: створює unsigned транзакції для клієнтського підписання.
 */

import Bull, { Queue, Job } from 'bull';
import { prisma, AirdropCampaign, AirdropRecipient } from '@/database/prisma';
import { TransactionBuilderService } from '@/services/TransactionBuilder';
import Logger from '@/utils/logger';

// Типи для airdrop операцій
export interface CreateAirdropParams {
  tokenId: string;
  creatorWalletAddress: string;
  name: string;
  description?: string;
  scheduledAt: Date;
  totalAmount: string;
  recipients: AirdropRecipientInput[];
}

export interface AirdropRecipientInput {
  walletAddress: string;
  amount: string;
}

export interface ProcessAirdropJobData {
  campaignId: string;
  batchSize?: number;
}

export interface CreateAirdropTransactionJobData {
  campaignId: string;
  recipientWalletAddress: string;
  amount: string;
  tokenMintAddress: string;
}

export interface AirdropServiceResponse {
  success: boolean;
  campaign?: AirdropCampaign;
  jobId?: string;
  error?: string;
}

export interface ClaimAirdropResponse {
  success: boolean;
  transaction?: string; // unsigned transaction
  metadata?: {
    campaignId: string;
    amount: string;
    estimatedFee: number;
    instructions: string[];
    nonce?: string;
    expiresAt?: string;
  };
  error?: string;
}

export class AirdropService {
  private airdropQueue: Queue;
  private transactionQueue: Queue;
  private transactionBuilder: TransactionBuilderService;

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0
    };

    // Створюємо дві черги: для airdrop обробки та транзакцій
    this.airdropQueue = new Bull('airdrop processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // Зберігаємо останні 100 завершених jobs
        removeOnFail: 50,      // Зберігаємо останні 50 невдалих jobs
        attempts: 3,           // 3 спроби при помилці
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.transactionQueue = new Bull('airdrop transactions', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    });

    this.transactionBuilder = new TransactionBuilderService();

    // Налаштовуємо обробники черг
    try {
      this.setupQueueProcessors();
      this.setupQueueEvents();
    } catch (error) {
      Logger.warn('Airdrop queue setup failed; continuing without queue events in dev', { error: (error as any)?.message });
    }
  }

  /**
   * Створення нової airdrop кампанії
   */
  async createAirdropCampaign(params: CreateAirdropParams): Promise<AirdropServiceResponse> {
    try {
      // Валідація параметрів
      if (!params.tokenId || !params.recipients.length) {
        return {
          success: false,
          error: 'Token ID and recipients are required'
        };
      }

      const maxRecipients = 10000; // Встановлюємо максимум
      if (params.recipients.length > maxRecipients) {
        return {
          success: false,
          error: `Too many recipients. Maximum: ${maxRecipients}`
        };
      }

      // Перевірка що токен існує
      const token = await prisma.token.findUnique({
        where: { id: params.tokenId },
        include: { creator: true }
      });

      if (!token) {
        return {
          success: false,
          error: 'Token not found'
        };
      }

      // Перевірка що користувач є власником токену або має права
      if (token.creator?.walletAddress !== params.creatorWalletAddress) {
        return {
          success: false,
          error: 'Only token creator can create airdrops'
        };
      }

      // Створення кампанії в базі даних
      const campaign = await prisma.airdropCampaign.create({
        data: {
          tokenId: params.tokenId,
          creatorId: token.creatorId || '',
          name: params.name,
          description: params.description,
          scheduledAt: params.scheduledAt,
          totalAmount: params.totalAmount,
          recipientsCount: params.recipients.length,
          status: 'SCHEDULED'
        },
        include: {
          token: true,
          creator: true
        }
      });

      // Додавання отримувачів
      const recipientsData = params.recipients.map(recipient => ({
        campaignId: campaign.id,
        address: recipient.walletAddress,
        amount: recipient.amount,
        status: 'PENDING' as const
      }));

      await prisma.airdropRecipient.createMany({
        data: recipientsData
      });

      // Додавання job в чергу для обробки airdrop
      const job = await this.airdropQueue.add('process-airdrop', {
        campaignId: campaign.id,
        batchSize: 50 // Обробляємо по 50 отримувачів за раз
      } as ProcessAirdropJobData, {
        delay: Math.max(0, new Date(params.scheduledAt).getTime() - Date.now()) // Запуск в scheduledAt
      });

      Logger.info('Airdrop campaign created', {
        campaignId: campaign.id,
        tokenId: params.tokenId,
        recipientsCount: params.recipients.length,
        jobId: job.id
      });

      return {
        success: true,
        campaign,
        jobId: job.id.toString()
      };

    } catch (error) {
      Logger.error('Failed to create airdrop campaign', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Claim airdrop - створення unsigned транзакції для користувача
   */
  async claimAirdrop(campaignId: string, userWalletAddress: string | null | undefined): Promise<ClaimAirdropResponse> {
    try {
      if (!userWalletAddress) {
        return {
          success: false,
          error: 'Wallet address is required'
        };
      }

      // Пошук airdrop recipient
      const recipient = await prisma.airdropRecipient.findFirst({
        where: {
          campaignId,
          address: userWalletAddress,
          status: 'PENDING'
        }
      });

      if (!recipient) {
        return {
          success: false,
          error: 'Airdrop not found or already claimed'
        };
      }

      // Отримуємо кампанію та токен окремо
      const campaign = await prisma.airdropCampaign.findUnique({
        where: { id: campaignId },
        include: { token: true }
      });

      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found'
        };
      }

      // Перевірка що кампанія активна
      if (!['SCHEDULED', 'IN_PROGRESS'].includes(campaign.status)) {
        return {
          success: false,
          error: 'Airdrop campaign is not active'
        };
      }

      // Витягаємо джерело токенів казначейства з конфігурації
      const sourceTokenAccountEnv = process.env.AIRDROP_TREASURY_TOKEN_ACCOUNT;
      const authorityPubkeyEnv = process.env.AIRDROP_TREASURY_AUTHORITY_PUBKEY;

      const unsignedTx = await this.transactionBuilder.createTokenTransferTransaction({
        mintAddress: campaign.token.mintAddress,
        sourceTokenAccount: sourceTokenAccountEnv,
        authorityPublicKey: authorityPubkeyEnv,
        toPublicKey: userWalletAddress,
        amount: recipient.amount.toString(),
        decimals: campaign.token.decimals
      });

      Logger.info('Airdrop claim initiated', {
        campaignId,
        recipientWallet: userWalletAddress,
        amount: recipient.amount,
        tokenSymbol: campaign.token.symbol
      });

      if (!unsignedTx.success || !unsignedTx.transaction) {
        return { success: false, error: unsignedTx.error || 'Failed to create transfer transaction' };
      }

      return {
        success: true,
        transaction: unsignedTx.transaction,
        metadata: {
          campaignId,
          amount: recipient.amount.toString(),
          estimatedFee: unsignedTx.metadata?.estimatedFee || 0,
          instructions: unsignedTx.metadata?.instructions || [
            'Transfer SPL tokens from campaign treasury to recipient'
          ],
          nonce: unsignedTx.metadata?.nonce,
          expiresAt: unsignedTx.metadata?.expiresAt
        }
      };

    } catch (error) {
      Logger.error('Failed to claim airdrop', { error, campaignId, userWalletAddress });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Claim failed'
      };
    }
  }

  /**
   * Отримання статистики кампанії
   */
  async getCampaignStats(campaignId: string): Promise<{
    totalRecipients: number;
    claimedCount: number;
    claimPercentage: number;
    totalAmount: string;
    claimedAmount: string;
  }> {
    const [totalRecipients, claimedCount, claimedRecipients] = await Promise.all([
      prisma.airdropRecipient.count({ where: { campaignId } }),
      prisma.airdropRecipient.count({ where: { campaignId, status: 'CONFIRMED' } }),
      prisma.airdropRecipient.findMany({ 
        where: { campaignId, status: 'CONFIRMED' },
        select: { amount: true }
      })
    ]);

    const campaign = await prisma.airdropCampaign.findUnique({
      where: { id: campaignId },
      select: { totalAmount: true }
    });

    const claimedAmount = claimedRecipients
      .reduce((sum, recipient) => sum + parseFloat(recipient.amount.toString()), 0)
      .toString();

    return {
      totalRecipients,
      claimedCount,
      claimPercentage: totalRecipients > 0 ? (claimedCount / totalRecipients) * 100 : 0,
      totalAmount: campaign?.totalAmount.toString() || '0',
      claimedAmount
    };
  }

  /**
   * Налаштування обробників черг
   */
  private setupQueueProcessors(): void {
    // Обробник airdrop кампаній
    this.airdropQueue.process('process-airdrop', 5, async (job: Job<ProcessAirdropJobData>) => {
      const { campaignId, batchSize = 50 } = job.data;

      Logger.info('Processing airdrop campaign', { campaignId, jobId: job.id });

      try {
        // Отримуємо непроцесованих отримувачів
        const recipients = await prisma.airdropRecipient.findMany({
          where: {
            campaignId,
            status: 'PENDING'
          },
          take: batchSize
        });

        if (recipients.length === 0) {
          Logger.info('No more recipients to process', { campaignId });
          return { processed: 0 };
        }

        // Отримуємо інформацію про кампанію та токен
        const campaign = await prisma.airdropCampaign.findUnique({
          where: { id: campaignId },
          include: { token: true }
        });

        if (!campaign) {
          throw new Error(`Campaign ${campaignId} not found`);
        }

        // Створюємо jobs для кожного отримувача
        const transactionJobs = recipients.map(recipient => ({
          campaignId,
          recipientWalletAddress: recipient.address,
          amount: recipient.amount.toString(),
          tokenMintAddress: campaign.token.mintAddress
        } as CreateAirdropTransactionJobData));

        // Додаємо в чергу транзакцій
        await this.transactionQueue.addBulk(
          transactionJobs.map(jobData => ({
            name: 'create-airdrop-transaction',
            data: jobData,
            opts: {
              delay: Math.random() * 5000 // Розподіляємо навантаження
            }
          }))
        );

        Logger.info('Airdrop batch processed', {
          campaignId,
          batchSize: recipients.length,
          jobId: job.id
        });

        return { processed: recipients.length };

      } catch (error) {
        Logger.error('Airdrop processing failed', { error, campaignId, jobId: job.id });
        throw error;
      }
    });

    // Обробник створення транзакцій
    this.transactionQueue.process('create-airdrop-transaction', 10, async (job: Job<CreateAirdropTransactionJobData>) => {
      const { campaignId, recipientWalletAddress, amount, tokenMintAddress } = job.data;

      try {
        const unsigned = await this.transactionBuilder.createTokenTransferTransaction({
          mintAddress: tokenMintAddress,
          sourceTokenAccount: process.env.AIRDROP_TREASURY_TOKEN_ACCOUNT,
          authorityPublicKey: process.env.AIRDROP_TREASURY_AUTHORITY_PUBKEY,
          toPublicKey: recipientWalletAddress,
          amount,
          decimals: 9
        });

        if (!unsigned.success) {
          throw new Error(unsigned.error || 'Failed to create unsigned transfer');
        }

        Logger.info('Airdrop transaction draft created', {
          campaignId,
          recipient: recipientWalletAddress,
          amount,
          jobId: job.id
        });

        return { 
          transactionCreated: true,
          recipient: recipientWalletAddress,
          amount,
          unsignedTransaction: unsigned.transaction
        };

      } catch (error) {
        Logger.error('Airdrop transaction creation failed', { 
          error, 
          campaignId, 
          recipientWalletAddress,
          jobId: job.id 
        });
        throw error;
      }
    });
  }

  /**
   * Налаштування event listeners для черг
   */
  private setupQueueEvents(): void {
    // Airdrop queue events
    this.airdropQueue.on('completed', (job, result) => {
      Logger.info('Airdrop job completed', { 
        jobId: job.id, 
        campaignId: job.data.campaignId,
        result 
      });
    });

    this.airdropQueue.on('failed', (job, err) => {
      Logger.error('Airdrop job failed', { 
        jobId: job.id, 
        campaignId: job?.data?.campaignId,
        error: err.message 
      });
    });

    // Transaction queue events
    this.transactionQueue.on('completed', (job, result) => {
      Logger.info('Airdrop transaction job completed', { 
        jobId: job.id, 
        recipient: job.data.recipientWalletAddress,
        result 
      });
    });

    this.transactionQueue.on('failed', (job, err) => {
      Logger.error('Airdrop transaction job failed', { 
        jobId: job.id, 
        recipient: job?.data?.recipientWalletAddress,
        error: err.message 
      });
    });

    Logger.info('Airdrop queue events configured');
  }

  /**
   * Отримання статистики черг
   */
  async getQueueStats(): Promise<{
    airdropQueue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    transactionQueue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    const [airdropCounts, transactionCounts] = await Promise.all([
      this.airdropQueue.getJobCounts(),
      this.transactionQueue.getJobCounts()
    ]);

    return {
      airdropQueue: airdropCounts,
      transactionQueue: transactionCounts
    };
  }

  /**
   * Graceful shutdown черг
   */
  async shutdown(): Promise<void> {
    Logger.info('Shutting down airdrop queues...');

    await Promise.all([
      this.airdropQueue.close(),
      this.transactionQueue.close()
    ]);

    Logger.info('Airdrop queues shut down successfully');
  }
}