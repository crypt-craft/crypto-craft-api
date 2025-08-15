/**
 * Authentication REST Routes
 * 
 * REST API endpoints для авторизації, реєстрації та управління користувачами.
 */

import { Router, Request, Response } from 'express';
import { AuthService } from '@/services/AuthService';
import { 
  authenticateJWT, 
  requireRole, 
  UserRole, 
  destroyUserSession,
  createUserSession
} from '@/middleware/auth';
import Logger from '@/utils/logger';
import { validateUserRegistration, validateUserUpdate } from '@/utils/validation';

const router = Router();
const authService = new AuthService();

/**
 * GET /auth/message
 * Генерація повідомлення для підпису wallet
 */
router.get('/message', async (req: Request, res: Response) => {
  try {
    const { walletAddress, action = 'login' } = req.query;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({
        error: 'Wallet address is required',
        code: 'MISSING_WALLET_ADDRESS'
      });
    }

    // Додаткова перевірка формату адреси для негативного кейсу
    const { isValidSolanaPublicKey } = await import('@/security/signature');
    if (!isValidSolanaPublicKey(walletAddress)) {
      return res.status(400).json({
        error: 'Wallet address is required',
        code: 'MISSING_WALLET_ADDRESS'
      });
    }

    if (!['login', 'register'].includes(action as string)) {
      return res.status(400).json({
        error: 'Action must be either "login" or "register"',
        code: 'INVALID_ACTION'
      });
    }

    const domain = process.env.AUTH_DOMAIN || req.headers.host || 'cryptocraft.local';
    const { message, timestamp, nonce } = await authService.generateAuthMessage(
      walletAddress,
      action as 'login' | 'register',
      { userAgent: req.headers['user-agent'], ip: req.ip, domain }
    );

    return res.json({
      success: true,
      message,
      timestamp,
      nonce,
      instructions: [
        '1. Sign this message with your Solana wallet',
        '2. Send the signature along with wallet address to /auth/login or /auth/register',
        '3. Message expires in 5 minutes'
      ]
    });

  } catch (error) {
    Logger.error('Failed to generate auth message', { error });
    return res.status(500).json({
      error: 'Failed to generate authentication message',
      code: 'MESSAGE_GENERATION_FAILED'
    });
  }
});

/**
 * POST /auth/register
 * Реєстрація нового користувача
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message, timestamp, username, email, nonce } = req.body;

    // Валідація обов'язкових полів
    if (!walletAddress || !signature || !message || !timestamp) {
      return res.status(400).json({
        error: 'Required fields: walletAddress, signature, message, timestamp',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Валідація додаткових полів
    if (username || email) {
      try {
        // Ensure walletAddress participates in validation per schema requirements
        validateUserRegistration({ walletAddress, username, email });
      } catch (validationError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Unknown validation error',
          code: 'VALIDATION_FAILED'
        });
      }
    }

    // Full DB-off mode: bypass DB and create stateless session
    if (process.env.DB_OFF_MODE === 'true') {
      const isValidSignature = await authService.verifyWalletSignature(walletAddress, signature, message, timestamp, { nonce, userAgent: req.headers['user-agent'], ip: req.ip, domain: process.env.AUTH_DOMAIN || req.headers.host, action: 'register' });
      if (!isValidSignature) {
        return res.status(401).json({ error: 'Invalid wallet signature', code: 'INVALID_SIGNATURE' });
      }
      const syntheticUser: any = {
        id: walletAddress,
        walletAddress,
        username: username || null,
        email: email || null,
        isVerified: false,
        createdAt: new Date(),
      };
      const session = await createUserSession(syntheticUser, UserRole.USER);
      return res.status(201).json({
        success: true,
        message: 'User registered successfully (stateless, DB_OFF_MODE)',
        user: {
          id: syntheticUser.id,
          walletAddress: syntheticUser.walletAddress,
          username: syntheticUser.username,
          email: syntheticUser.email,
          isVerified: syntheticUser.isVerified,
          createdAt: syntheticUser.createdAt
        },
        token: session.token,
        sessionId: session.sessionId
      });
    }

    const result = await authService.register({
      walletAddress,
      signature,
      message,
      timestamp,
      username,
      email
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: 'REGISTRATION_FAILED'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: result.user!.id,
        walletAddress: result.user!.walletAddress,
        username: result.user!.username,
        email: result.user!.email,
        isVerified: result.user!.isVerified,
        createdAt: result.user!.createdAt
      },
      token: result.token,
      sessionId: result.sessionId
    });

  } catch (error) {
    Logger.error('Registration endpoint error', { error });
    return res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /auth/login
 * Вхід користувача
 */
// Ensure login is PUBLIC (no auth middleware). It already is; keep it explicit and minimal.
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message, timestamp, nonce } = req.body;

    // Валідація обов'язкових полів
    if (!walletAddress || !signature || !message || !timestamp) {
      return res.status(400).json({
        error: 'Required fields: walletAddress, signature, message, timestamp',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // DB_OFF_MODE allows full stateless login
    if (process.env.DB_OFF_MODE === 'true') {
      const isValidSignature = await authService.verifyWalletSignature(walletAddress, signature, message, timestamp, { nonce, userAgent: req.headers['user-agent'], ip: req.ip, domain: process.env.AUTH_DOMAIN || req.headers.host, action: 'login' });
      if (!isValidSignature) {
        return res.status(401).json({ error: 'Invalid wallet signature', code: 'LOGIN_FAILED' });
      }
      const syntheticUser: any = {
        id: walletAddress,
        walletAddress,
        isVerified: false,
        createdAt: new Date(),
      };
      const session = await createUserSession(syntheticUser, UserRole.USER);
      return res.json({
        success: true,
        message: 'Login (DB_OFF_MODE stateless)',
        user: { id: syntheticUser.id, walletAddress: syntheticUser.walletAddress },
        token: session.token,
        sessionId: session.sessionId,
      });
    }

    const result = await authService.login({
      walletAddress,
      signature,
      message,
      timestamp
    });

    if (!result.success) {
      // Auto-register on first login if user not found
      if (result.error?.includes('User not found') && process.env.AUTH_STATELESS_MODE !== 'true') {
        const reg = await authService.register({ walletAddress, signature, message, timestamp });
        if (reg.success) {
          return res.json({
            success: true,
            message: 'Registered and logged in',
            user: {
              id: reg.user!.id,
              walletAddress: reg.user!.walletAddress,
              username: reg.user!.username,
              email: reg.user!.email,
              isVerified: reg.user!.isVerified
            },
            token: reg.token,
            sessionId: reg.sessionId
          });
        }
      }
      // In stateless mode, if signature was valid but DB failed or user missing, mint ephemeral token
      if (
        process.env.AUTH_STATELESS_MODE === 'true' &&
        result.error &&
        !/invalid wallet signature/i.test(result.error)
      ) {
        const nowUser = {
          id: walletAddress,
          walletAddress,
        } as any;
        const { generateJWT, UserRole } = await import('@/middleware/auth');
        const token = generateJWT(nowUser, UserRole.USER);
        return res.json({ success: true, message: 'Login (stateless)', user: { id: walletAddress, walletAddress }, token });
      }
      return res.status(401).json({ error: result.error, code: 'LOGIN_FAILED' });
    }

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: result.user!.id,
        walletAddress: result.user!.walletAddress,
        username: result.user!.username,
        email: result.user!.email,
        isVerified: result.user!.isVerified,
        lastLoginAt: result.user!.lastLoginAt
      },
      token: result.token,
      sessionId: result.sessionId
    });

  } catch (error) {
    Logger.error('Login endpoint error', { error });
    return res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * POST /auth/logout
 * Вихід користувача
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;
      await destroyUserSession(token);
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    Logger.error('Logout error', { error });
    res.status(500).json({ error: 'Logout failed', code: 'LOGOUT_FAILED' });
  }
});

/**
 * GET /auth/me
 * Отримання інформації про поточного користувача
 */
router.get('/me', authenticateJWT(), async (req: Request, res: Response) => {
  try {
    if (!(req as any).user) {
      return res.status(401).json({
        error: 'User not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
    }

    return res.json({
      success: true,
      user: {
        id: (req as any).user.id,
        walletAddress: (req as any).user.walletAddress,
        username: (req as any).user.username,
        email: (req as any).user.email,
        bio: (req as any).user.bio,
        avatarUrl: (req as any).user.avatarUrl,
        isVerified: (req as any).user.isVerified,
        isActive: (req as any).user.isActive,
        role: (req as any).user.role,
        createdAt: (req as any).user.createdAt,
        lastLoginAt: (req as any).user.lastLoginAt
      }
    });

  } catch (error) {
    Logger.error('Get current user error', { error });
    return res.status(500).json({
      error: 'Failed to get user information',
      code: 'GET_USER_FAILED'
    });
  }
});

/**
 * PUT /auth/profile
 * Оновлення профілю користувача
 */
router.put('/profile', authenticateJWT(), async (req: Request, res: Response) => {
  try {
    if (!(req as any).user) {
      return res.status(401).json({
        error: 'User not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const { username, email, bio, avatarUrl } = req.body;

    // Валідація даних
    try {
      validateUserUpdate({ username, email, bio, avatarUrl });
    } catch (validationError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationError instanceof Error ? validationError.message : 'Unknown validation error',
        code: 'VALIDATION_FAILED'
      });
    }

    const result = await authService.updateProfile((req as any).user.id, {
      username,
      email,
      bio,
      avatarUrl
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: 'PROFILE_UPDATE_FAILED'
      });
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: result.user!.id,
        walletAddress: result.user!.walletAddress,
        username: result.user!.username,
        email: result.user!.email,
        bio: result.user!.bio,
        avatarUrl: result.user!.avatarUrl,
        updatedAt: result.user!.updatedAt
      }
    });

  } catch (error) {
    Logger.error('Profile update error', { error });
    return res.status(500).json({
      error: 'Profile update failed',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
});

/**
 * GET /auth/validate
 * Перевірка валідності токену
 */
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    const result = await authService.validateToken(token);

    if (!result.valid) {
      return res.status(401).json({
        valid: false,
        error: result.error,
        code: 'INVALID_TOKEN'
      });
    }

    return res.json({
      valid: true,
      user: {
        id: result.user?.id,
        walletAddress: result.user?.walletAddress,
        username: result.user?.username,
        role: result.payload?.role,
        isActive: (result.user as any)?.isActive
      },
      expiresAt: result.payload?.exp ? new Date(result.payload.exp * 1000) : null
    });

  } catch (error) {
    Logger.error('Token validation error', { error });
    return res.status(500).json({
      valid: false,
      error: 'Token validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
});

/**
 * GET /auth/stats
 * Статистика користувачів (тільки для адмінів)
 */
router.get('/stats', 
  authenticateJWT(), 
  requireRole(UserRole.ADMIN, UserRole.MODERATOR),
  async (req: Request, res: Response) => {
    try {
      const stats = await authService.getUserStats();

      return res.json({
        success: true,
        stats
      });

    } catch (error) {
      Logger.error('Get user stats error', { error });
      return res.status(500).json({
        error: 'Failed to get user statistics',
        code: 'STATS_ERROR'
      });
    }
  }
);

/**
 * POST /auth/admin/deactivate/:userId
 * Деактивація користувача (тільки для адмінів)
 */
router.post('/admin/deactivate/:userId',
  authenticateJWT(),
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      const result = await authService.deactivateUser(userId, (req as any).user!.id);

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: 'DEACTIVATION_FAILED'
        });
      }

      return res.json({
        success: true,
        message: 'User deactivated successfully'
      });

    } catch (error) {
      Logger.error('User deactivation error', { error });
      return res.status(500).json({
        error: 'User deactivation failed',
        code: 'DEACTIVATION_ERROR'
      });
    }
  }
);

export default router;