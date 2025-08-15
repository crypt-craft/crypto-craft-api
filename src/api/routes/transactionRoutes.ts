/**
 * Transaction Routes - Безпечна Web3 взаємодія
 * 
 * Архітектура:
 * 1. POST /transactions/create-token - створення unsigned транзакції
 * 2. POST /transactions/submit - відправка підписаної транзакції
 * 3. GET /transactions/status/:signature - статус транзакції
 */

import { Router, Request, Response } from 'express';
import { TransactionBuilderService } from '@/services/TransactionBuilder';
import { authenticateJWT, AuthRequest } from '@/middleware/auth';
import { validateCreateToken } from '@/utils/validation';
import Logger from '@/utils/logger';

const router = Router();
const transactionBuilder = new TransactionBuilderService();

/**
 * POST /transactions/create-token
 * Створення unsigned транзакції для токену (БЕЗПЕЧНО)
 */
router.post('/create-token', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    const { name, symbol, decimals, initialSupply, description, imageUrl, externalUrl } = req.body;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Валідація параметрів токену
    try {
      validateCreateToken({ name, symbol, decimals, initialSupply, description, imageUrl, externalUrl });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid parameters',
        code: 'VALIDATION_FAILED'
      });
    }

    // Валідація публічного ключа з wallet
    const userWalletAddress = req.user.walletAddress;
    if (!transactionBuilder.validatePublicKey(userWalletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address',
        code: 'INVALID_WALLET'
      });
    }

    // Створення unsigned транзакції
    const result = await transactionBuilder.createTokenTransaction({
      userPublicKey: userWalletAddress,
      name,
      symbol,
      decimals,
      initialSupply,
      description,
      imageUrl,
      externalUrl
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'TRANSACTION_CREATION_FAILED'
      });
    }

    // Логування для аудиту
    Logger.info('Unsigned token transaction created for user', {
      userId: req.user.id,
      walletAddress: userWalletAddress,
      tokenName: name,
      mintAddress: result.metadata?.mintAddress,
      estimatedFee: result.metadata?.estimatedFee
    });

      return res.json({
      success: true,
        message: 'Unsigned transaction created. Please sign with your wallet.',
      transaction: result.transaction,
      metadata: {
        mintAddress: result.metadata?.mintAddress,
        tokenAccountAddress: result.metadata?.tokenAccountAddress,
        estimatedFee: result.metadata?.estimatedFee,
          instructions: result.metadata?.instructions,
        network: 'devnet' // або з конфігурації
      },
      signingInstructions: [
        '1. Your wallet will prompt you to sign this transaction',
        '2. Review the transaction details carefully',
        '3. Sign the transaction in your wallet',
        '4. Send the signed transaction to /transactions/submit',
        '5. NEVER share your private key with anyone!'
      ]
    });

  } catch (error) {
    Logger.error('Create token transaction error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: 'Failed to create token transaction',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /transactions/submit
 * Відправка підписаної транзакції в мережу
 */
router.post('/submit', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    const { signedTransaction, metadata } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!signedTransaction) {
      return res.status(400).json({
        success: false,
        error: 'Signed transaction is required',
        code: 'MISSING_SIGNED_TRANSACTION'
      });
    }

    // Відправка підписаної транзакції
    const result = await transactionBuilder.submitSignedTransaction({
      signedTransaction,
      originalTxHash: metadata?.txHash
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        code: 'TRANSACTION_SUBMISSION_FAILED'
      });
    }

    // Логування успішної транзакції
    Logger.info('Transaction submitted successfully', {
      userId: req.user.id,
      walletAddress: req.user.walletAddress,
      signature: result.signature,
      explorerUrl: result.explorerUrl
    });

    return res.json({
      success: true,
      message: 'Transaction submitted successfully',
      signature: result.signature,
      explorerUrl: result.explorerUrl,
      status: 'pending',
      statusCheckUrl: `/api/transactions/status/${result.signature}`
    });

  } catch (error) {
    Logger.error('Submit transaction error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: 'Failed to submit transaction',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /transactions/status/:signature
 * Перевірка статусу транзакції
 */
router.get('/status/:signature', async (req: Request, res: Response) => {
  try {
    const { signature } = req.params;

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Transaction signature is required',
        code: 'MISSING_SIGNATURE'
      });
    }

    const status = await transactionBuilder.getTransactionStatus(signature);

    return res.json({
      success: true,
      signature,
      status: status.status,
      confirmations: status.confirmations,
      error: status.error,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    });

  } catch (error) {
    Logger.error('Get transaction status error', { error, signature: req.params.signature });
    return res.status(500).json({
      success: false,
      error: 'Failed to get transaction status',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /transactions/network-info
 * Інформація про мережу
 */
router.get('/network-info', async (req: Request, res: Response) => {
  try {
    const networkInfo = await transactionBuilder.getNetworkInfo();

    return res.json({
      success: true,
      network: networkInfo.network,
      blockHeight: networkInfo.blockHeight,
      health: networkInfo.health,
      isDevnet: networkInfo.network.includes('devnet'),
      explorerUrl: networkInfo.network.includes('devnet') 
        ? 'https://explorer.solana.com/?cluster=devnet'
        : 'https://explorer.solana.com/'
    });

  } catch (error) {
    Logger.error('Get network info error', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get network information',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /transactions/validate-address
 * Валідація Solana адреси
 */
router.post('/validate-address', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required',
        code: 'MISSING_ADDRESS'
      });
    }

    const isValid = transactionBuilder.validatePublicKey(address);

    return res.json({
      success: true,
      address,
      isValid,
      message: isValid ? 'Valid Solana address' : 'Invalid Solana address format'
    });

  } catch (error) {
    Logger.error('Validate address error', { error });
    return res.status(500).json({
      success: false,
      error: 'Address validation failed',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /transactions/estimate-fee
 * Оцінка комісії для операції (без створення транзакції)
 */
router.post('/estimate-fee', authenticateJWT(), async (req: AuthRequest, res: Response) => {
  try {
    const { operation, parameters } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Базова оцінка комісії для різних операцій
    let estimatedFee = 5000; // Default SOL lamports

    switch (operation) {
      case 'create-token':
        estimatedFee = 15000; // Створення токену дорожче
        break;
      case 'transfer':
        estimatedFee = 5000;
        break;
      case 'mint':
        estimatedFee = 5000;
        break;
      default:
        estimatedFee = 5000;
    }

    return res.json({
      success: true,
      operation,
      estimatedFee,
      estimatedFeeSOL: estimatedFee / 1e9, // Конвертація в SOL
      currency: 'lamports',
      note: 'This is an estimate. Actual fee may vary based on network conditions.'
    });

  } catch (error) {
    Logger.error('Estimate fee error', { error });
    return res.status(500).json({
      success: false,
      error: 'Fee estimation failed',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;