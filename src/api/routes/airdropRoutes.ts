/**
 * Airdrop REST Routes
 * 
 * API endpoints для управління airdrop кампаніями з queue system
 */

import { Router, Request, Response } from 'express';
import { AirdropService } from '@/services/AirdropService';
import { TransactionBuilderService } from '@/services/TransactionBuilder';
import { authenticateJWT, requireRole, UserRole, AuthRequest } from '@/middleware/auth';
import { prisma } from '@/database/prisma';
import Logger from '@/utils/logger';

const router = Router();
const airdropService = new AirdropService();
const transactionBuilder = new TransactionBuilderService();

/**
 * POST /airdrops/campaigns
 * Створення нової airdrop кампанії
 */
router.post('/campaigns', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    if (process.env.DB_OFF_MODE === 'true') {
      return res.status(503).json({
        success: false,
        error: 'Airdrop campaigns are disabled in DB_OFF_MODE',
        code: 'DB_OFF_MODE'
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const {
      tokenId,
      name,
      description,
      scheduledAt,
      totalAmount,
      recipients
    } = req.body;

    // Валідація обов'язкових полів
    if (!tokenId || !name || !scheduledAt || !totalAmount || !recipients || !recipients.length) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: tokenId, name, scheduledAt, totalAmount, recipients',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Валідація дати
    const scheduled = new Date(scheduledAt);
    const now = new Date();

    if (scheduled <= now) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled date must be in the future',
        code: 'INVALID_SCHEDULED_DATE'
      });
    }

    // Валідація recipients
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients must be a non-empty array',
        code: 'INVALID_RECIPIENTS'
      });
    }

    const maxRecipients = 10000; // Встановлюємо максимум
    if (recipients.length > maxRecipients) {
      return res.status(400).json({
        success: false,
        error: `Too many recipients. Maximum: ${maxRecipients}`,
        code: 'TOO_MANY_RECIPIENTS'
      });
    }

    // Валідація кожного отримувача
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      if (!recipient.walletAddress || !recipient.amount) {
        return res.status(400).json({
          success: false,
          error: `Invalid recipient at index ${i}: walletAddress and amount are required`,
          code: 'INVALID_RECIPIENT_DATA'
        });
      }

      if (isNaN(parseFloat(recipient.amount)) || parseFloat(recipient.amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid amount for recipient at index ${i}`,
          code: 'INVALID_RECIPIENT_AMOUNT'
        });
      }
    }

    // Створення кампанії
    const result = await airdropService.createAirdropCampaign({
      tokenId,
      creatorWalletAddress: req.user.walletAddress,
      name,
      description,
      scheduledAt: scheduled,
      totalAmount: totalAmount.toString(),
      recipients
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'CAMPAIGN_CREATION_FAILED'
      });
    }

    Logger.info('Airdrop campaign created via API', {
      campaignId: result.campaign?.id,
      creatorId: req.user.id,
      tokenId,
      recipientsCount: recipients.length
    });

    return res.status(201).json({
      success: true,
      message: 'Airdrop campaign created successfully',
      campaign: {
        id: result.campaign!.id,
        name: result.campaign!.name,
        description: result.campaign!.description,
        scheduledAt: result.campaign!.scheduledAt,
        totalAmount: result.campaign!.totalAmount,
        status: result.campaign!.status,
        createdAt: result.campaign!.createdAt
      },
      jobId: result.jobId,
      recipientsCount: recipients.length
    });

  } catch (error) {
    Logger.error('Create airdrop campaign error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: 'Failed to create airdrop campaign',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /airdrops/campaigns
 * Список всіх airdrop кампаній з фільтрацією
 */
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    if (process.env.DB_OFF_MODE === 'true') {
      return res.json({ success: true, campaigns: [], pagination: { page: 1, limit: 0, total: 0, pages: 0 } });
    }
    const { 
      status, 
      tokenId, 
      creatorId, 
      page = '1', 
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (tokenId) where.tokenId = tokenId;
    if (creatorId) where.creatorId = creatorId;

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === 'asc' ? 'asc' : 'desc';

    const [campaigns, totalCount] = await Promise.all([
      prisma.airdropCampaign.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          token: {
            select: {
              id: true,
              name: true,
              symbol: true,
              mintAddress: true
            }
          },
          creator: {
            select: {
              id: true,
              username: true,
              walletAddress: true
            }
          },
          _count: {
            select: {
              recipients: true
            }
          }
        }
      }),
      prisma.airdropCampaign.count({ where })
    ]);

    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const stats = await airdropService.getCampaignStats(campaign.id);
        return {
          ...campaign,
          stats
        };
      })
    );

    return res.json({
      success: true,
      campaigns: campaignsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (error) {
    Logger.error('Get airdrop campaigns error', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get airdrop campaigns',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /airdrops/campaigns/:id
 * Деталі конкретної airdrop кампанії
 */
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    if (process.env.DB_OFF_MODE === 'true') {
      return res.status(404).json({ success: false, error: 'Airdrop campaign not found', code: 'CAMPAIGN_NOT_FOUND' });
    }
    const { id } = req.params;

    const campaign = await prisma.airdropCampaign.findUnique({
      where: { id },
      include: {
        token: true,
        creator: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        },
        recipients: {
          select: {
            id: true,
            address: true,
            amount: true,
            status: true,
            processedAt: true,
            txHash: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Airdrop campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    const stats = await airdropService.getCampaignStats(campaign.id);

    return res.json({
      success: true,
      campaign: {
        ...campaign,
        stats
      }
    });

  } catch (error) {
    Logger.error('Get airdrop campaign error', { error, campaignId: req.params.id });
    return res.status(500).json({
      success: false,
      error: 'Failed to get airdrop campaign',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /airdrops/claim/:campaignId
 * Claim airdrop - створення unsigned транзакції
 */
router.post('/claim/:campaignId', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    if (process.env.DB_OFF_MODE === 'true') {
      return res.status(503).json({
        success: false,
        error: 'Claiming from DB campaigns is disabled in DB_OFF_MODE',
        code: 'DB_OFF_MODE'
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
        code: 'MISSING_CAMPAIGN_ID'
      });
    }

    if (!req.user.walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found in user session',
        code: 'MISSING_WALLET_ADDRESS'
      });
    }

    const result = await airdropService.claimAirdrop(campaignId, req.user.walletAddress!);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'CLAIM_FAILED'
      });
    }

    Logger.info('Airdrop claim initiated via API', {
      campaignId,
      userId: req.user.id,
      walletAddress: req.user.walletAddress
    });

    return res.json({
      success: true,
      message: 'Airdrop claim transaction created. Please sign with your wallet.',
      transaction: result.transaction,
      metadata: result.metadata,
      signingInstructions: [
        'Your wallet will prompt you to sign the airdrop claim transaction',
        'Review the transaction details carefully',
        'Sign the transaction to claim your airdrop',
        'Submit the signed transaction to complete the claim'
      ]
    });

  } catch (error) {
    Logger.error('Claim airdrop error', { 
      error, 
      userId: req.user?.id, 
      campaignId: req.params.campaignId 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to claim airdrop',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /airdrops/my-campaigns
 * Мої airdrop кампанії
 */
router.get('/my-campaigns', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    if (process.env.DB_OFF_MODE === 'true') {
      return res.json({ success: true, campaigns: [], pagination: { page: 1, limit: 0, total: 0, pages: 0 } });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const skip = (pageNum - 1) * limitNum;

    const [campaigns, totalCount] = await Promise.all([
      prisma.airdropCampaign.findMany({
        where: { creatorId: req.user.id },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          token: {
            select: {
              id: true,
              name: true,
              symbol: true,
              mintAddress: true
            }
          },
          _count: {
            select: {
              recipients: true
            }
          }
        }
      }),
      prisma.airdropCampaign.count({ where: { creatorId: req.user.id } })
    ]);

    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const stats = await airdropService.getCampaignStats(campaign.id);
        return {
          ...campaign,
          stats
        };
      })
    );

    return res.json({
      success: true,
      campaigns: campaignsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (error) {
    Logger.error('Get my airdrop campaigns error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: 'Failed to get your airdrop campaigns',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /airdrops/available
 * Доступні airdrops для поточного користувача
 */
router.get('/available', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    if (process.env.DB_OFF_MODE === 'true') {
      return res.json({ success: true, airdrops: [] });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const availableAirdrops = await prisma.airdropRecipient.findMany({
      where: {
        address: req.user.walletAddress,
        status: 'PENDING'
      }
    });

    // Отримуємо кампанії окремо
    const campaignIds = availableAirdrops.map(r => r.campaignId);
    const campaigns = await prisma.airdropCampaign.findMany({
      where: {
        id: { in: campaignIds },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
      },
      include: {
        token: {
          select: {
            id: true,
            name: true,
            symbol: true,
            mintAddress: true
          }
        }
      }
    });

    // Об'єднуємо дані
    const airdropsWithCampaigns = availableAirdrops
      .map(recipient => {
        const campaign = campaigns.find(c => c.id === recipient.campaignId);
        return campaign ? {
          campaignId: recipient.campaignId,
          amount: recipient.amount.toString(),
          campaign: {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            scheduledAt: campaign.scheduledAt,
            status: campaign.status,
            token: campaign.token
          }
        } : null;
      })
      .filter(Boolean);

    return res.json({
      success: true,
      airdrops: airdropsWithCampaigns
    });

  } catch (error) {
    Logger.error('Get available airdrops error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: 'Failed to get available airdrops',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /airdrops/queue-stats
 * Статистика черг (тільки для адмінів)
 */
router.get('/queue-stats', 
  authenticateJWT(), 
  requireRole(UserRole.ADMIN, UserRole.MODERATOR),
  async (req: AuthRequest, res: Response) => {
    try {
      if (process.env.DB_OFF_MODE === 'true') {
        return res.json({ success: true, queueStats: { airdropQueue: { waiting: 0, active: 0, completed: 0, failed: 0 }, transactionQueue: { waiting: 0, active: 0, completed: 0, failed: 0 } } });
      }
      const stats = await airdropService.getQueueStats();

      return res.json({
        success: true,
        queueStats: stats
      });

    } catch (error) {
      Logger.error('Get queue stats error', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to get queue statistics',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * POST /airdrops/campaigns/:id/activate
 * Активація/деактивація кампанії (тільки для власника або адміна)
 */
router.post('/campaigns/:id/activate', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    if (process.env.DB_OFF_MODE === 'true') {
      return res.status(503).json({ success: false, error: 'Campaign status management disabled in DB_OFF_MODE', code: 'DB_OFF_MODE' });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const { id } = req.params;
    const { status: newStatus } = req.body;

    const validStatuses = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }

    // Перевірка прав доступу
    const campaign = await prisma.airdropCampaign.findUnique({
      where: { id },
      include: { creator: true }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
        code: 'CAMPAIGN_NOT_FOUND'
      });
    }

    const canModify = 
      campaign.creatorId === req.user.id || 
      [UserRole.ADMIN, UserRole.MODERATOR].includes(req.user.role);

    if (!canModify) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Оновлення статусу
    const updatedCampaign = await prisma.airdropCampaign.update({
      where: { id },
      data: { 
        status: newStatus,
        updatedAt: new Date()
      },
      include: {
        token: true,
        creator: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        }
      }
    });

    Logger.info('Airdrop campaign status updated', {
      campaignId: id,
      newStatus,
      updatedBy: req.user.id
    });

    return res.json({
      success: true,
      message: `Campaign status updated to ${newStatus} successfully`,
      campaign: updatedCampaign
    });

  } catch (error) {
    Logger.error('Update campaign status error', { 
      error, 
      userId: req.user?.id, 
      campaignId: req.params.id 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to update campaign status',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;

/**
 * POST /airdrops/claim-direct
 * Статлес-флоу: згенерувати unsigned transfer SPL токенів з treasury до поточного користувача
 * Не вимагає БД, перевіряє тільки вхідні параметри та використовує ENV для treasury
 */
router.post('/claim-direct', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const { mintAddress, amount, decimals } = req.body || {};
    if (!mintAddress || !amount || (decimals === undefined || decimals === null)) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: mintAddress, amount, decimals',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const sourceTokenAccountEnv = process.env.AIRDROP_TREASURY_TOKEN_ACCOUNT;
    const authorityPubkeyEnv = process.env.AIRDROP_TREASURY_AUTHORITY_PUBKEY;

    const unsignedTx = await transactionBuilder.createTokenTransferTransaction({
      mintAddress,
      sourceTokenAccount: sourceTokenAccountEnv,
      authorityPublicKey: authorityPubkeyEnv,
      toPublicKey: req.user.walletAddress!,
      amount: String(amount),
      decimals: Number(decimals)
    });

    if (!unsignedTx.success || !unsignedTx.transaction) {
      return res.status(500).json({ success: false, error: unsignedTx.error || 'Failed to build transfer', code: 'CLAIM_BUILD_FAILED' });
    }

    return res.json({
      success: true,
      message: 'Unsigned transfer transaction created. Please sign with your wallet.',
      transaction: unsignedTx.transaction,
      metadata: unsignedTx.metadata,
      signingInstructions: [
        'Your wallet will prompt you to sign the transfer transaction',
        'Review the transaction details carefully',
        'Sign to claim your airdrop',
      ]
    });
  } catch (error) {
    Logger.error('Claim direct airdrop error', { error, userId: req.user?.id });
    return res.status(500).json({ success: false, error: 'Failed to create direct claim', code: 'INTERNAL_ERROR' });
  }
});