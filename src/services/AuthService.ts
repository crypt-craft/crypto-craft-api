/**
 * AuthService - Сервіс для авторизації та управління користувачами
 * 
 * Реалізує реєстрацію, вхід, управління ролями та Solana wallet підключення.
 */

import { prisma, User, CreateUserInput } from '@/database/prisma';
import { generateJWT, createUserSession, UserRole, JWTPayload, verifyJWT } from '@/middleware/auth';
import { redisSetJson } from '@/database/redis';
import Logger from '@/utils/logger';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';
import { createAndStoreNonce, consumeNonce } from '@/security/nonce';
import { buildCanonicalAuthMessage, isValidSolanaPublicKey, verifyEd25519Signature } from '@/security/signature';

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  sessionId?: string;
  error?: string;
}

export interface LoginRequest {
  walletAddress: string;
  signature: string;
  message: string;
  timestamp: number;
}

export interface RegisterRequest {
  walletAddress: string;
  signature: string;
  message: string;
  timestamp: number;
  username?: string;
  email?: string;
}

export class AuthService {
  private readonly MESSAGE_VALIDITY_WINDOW = 5 * 60 * 1000; // 5 хвилин

  /**
   * Генерація повідомлення для підпису wallet
   */
   generateAuthMessage(walletAddress: string, action: 'login' | 'register' = 'login', context?: { userAgent?: string; ip?: string; domain?: string }): Promise<{ message: string; timestamp: number; nonce: string }> {
    const domain = process.env.AUTH_DOMAIN || context?.domain || 'cryptocraft.local';
    if (!isValidSolanaPublicKey(walletAddress)) {
      throw new Error('Invalid wallet address');
    }
    return (async () => {
      const { nonce, timestamp } = await createAndStoreNonce({ walletAddress, action, userAgent: context?.userAgent, ip: context?.ip, ttlSeconds: 300 });
      const message = buildCanonicalAuthMessage({ walletAddress, action, timestamp, nonce, domain });
      Logger.info('Auth message generated', { walletAddress, action, timestamp });
      return { message, timestamp, nonce };
    })();
  }

  /**
   * Перевірка підпису Solana wallet
   */
  async verifyWalletSignature(
    walletAddress: string,
    signatureBase64: string,
    message: string,
    timestamp: number,
    options?: { nonce?: string; userAgent?: string; ip?: string; domain?: string; action?: 'login' | 'register' }
  ): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === 'production' && process.env.AUTH_TEST_MODE === 'true') {
        Logger.warn('AUTH_TEST_MODE is not allowed in production');
        return false;
      }
      const now = Date.now();
      if (now - timestamp > this.MESSAGE_VALIDITY_WINDOW) {
        Logger.warn('Message timestamp expired', { walletAddress, timestamp, now, maxAge: this.MESSAGE_VALIDITY_WINDOW });
        return false;
      }
      if (!isValidSolanaPublicKey(walletAddress)) {
        Logger.warn('Invalid wallet address format', { walletAddress });
        return false;
      }
      // Verify nonce binding if provided
      if (options?.nonce) {
        const consumed = await consumeNonce({ walletAddress, nonce: options.nonce, userAgent: options.userAgent, ip: options.ip });
        if (!consumed.ok) {
          Logger.warn('Nonce validation failed', { walletAddress, reason: consumed.reason });
          return false;
        }
      }
      // Ensure canonical formatting if domain provided
      if (options?.domain && options?.nonce) {
        const expected = buildCanonicalAuthMessage({ walletAddress, action: options.action || 'login', timestamp, nonce: options.nonce, domain: options.domain });
        if (expected !== message) {
          Logger.warn('Canonical message mismatch', { walletAddress });
          return false;
        }
      }
      const ok = verifyEd25519Signature({ walletAddress, message, signatureBase64 });
      if (!ok) {
        Logger.warn('ED25519 signature verification failed', { walletAddress });
      }
      return ok;
    } catch (error) {
      Logger.error('Signature verification failed', { error, walletAddress });
      return false;
    }
  }

  /**
   * Реєстрація нового користувача
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      // Перевірка підпису
      const isValidSignature = await this.verifyWalletSignature(
        request.walletAddress,
        request.signature,
        request.message,
        request.timestamp
      );

      if (!isValidSignature) {
        return {
          success: false,
          error: 'Invalid wallet signature'
        };
      }

      // Перевірка чи користувач вже існує
      let existingUser: User | null = null;
      try {
        existingUser = await prisma.user.findUnique({
          where: { walletAddress: request.walletAddress }
        });
      } catch (error) {
        Logger.warn('User existence check failed (DB error)', { error, walletAddress: request.walletAddress });
      }

      if (existingUser) {
        return {
          success: false,
          error: 'User already exists. Use login instead.'
        };
      }

      // Створення нового користувача
      const userData: CreateUserInput = {
        walletAddress: request.walletAddress,
        username: request.username,
        email: request.email,
        // поля, яких може не бути у фактичній БД, не заповнюємо
      } as unknown as CreateUserInput;

      const user = await prisma.user.create({
        data: userData
      });

      // Створення сесії
      const session = await createUserSession(user, UserRole.USER);
      // Cache snapshot for stateless fallback
      await redisSetJson(`session:user:${user.id}`, user, 24 * 60 * 60);

      Logger.info('User registered successfully', {
        userId: user.id,
        walletAddress: user.walletAddress,
        username: user.username
      });

      return {
        success: true,
        user,
        token: session.token,
        sessionId: session.sessionId
      };

    } catch (error) {
      Logger.error('Registration failed', {
        error,
        walletAddress: request.walletAddress
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  /**
   * Вхід користувача
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    // Public entry: must not assume prior authentication
    try {
      // Перевірка підпису
      const isValidSignature = await this.verifyWalletSignature(
        request.walletAddress,
        request.signature,
        request.message,
        request.timestamp
      );

      if (!isValidSignature) {
        return {
          success: false,
          error: 'Invalid wallet signature'
        };
      }

      // Якщо stateless режим — не використовуємо БД взагалі
      if (process.env.AUTH_STATELESS_MODE === 'true') {
        const syntheticUser: User = {
          id: request.walletAddress,
          walletAddress: request.walletAddress,
          email: null as any,
          username: null as any,
          profileImageUrl: null as any,
          bio: null as any,
          isVerified: false as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as User;
        const session = await createUserSession(syntheticUser, UserRole.USER);
        Logger.info('User logged in (stateless)', {
          userId: syntheticUser.id,
          walletAddress: syntheticUser.walletAddress
        });
        return {
          success: true,
          user: syntheticUser,
          token: session.token,
          sessionId: session.sessionId
        };
      }

      // Пошук користувача (БД-режим)
      let user: User | null = null;
      try {
        user = await prisma.user.findUnique({
          where: { walletAddress: request.walletAddress }
        });
      } catch (error) {
        Logger.warn('User lookup failed (DB error)', { error, walletAddress: request.walletAddress });
      }

      if (!user) {
        return {
          success: false,
          error: 'User not found. Please register first.'
        };
      }

      if ((user as any).isActive === false) {
        return {
          success: false,
          error: 'User account is deactivated'
        };
      }

      // Створення сесії (БД-режим)
      const session = await createUserSession(user, UserRole.USER);
      // Cache snapshot for stateless fallback
      await redisSetJson(`session:user:${user.id}`, user, 24 * 60 * 60);

      Logger.info('User logged in successfully', {
        userId: user.id,
        walletAddress: user.walletAddress
      });

      return {
        success: true,
        user,
        token: session.token,
        sessionId: session.sessionId
      };

    } catch (error) {
      Logger.error('Login failed', {
        error,
        walletAddress: request.walletAddress
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  /**
   * Оновлення профілю користувача
   */
  async updateProfile(
    userId: string,
    updates: {
      username?: string;
      email?: string;
      bio?: string;
      avatarUrl?: string;
    }
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      Logger.info('User profile updated', {
        userId,
        updates: Object.keys(updates)
      });

      return {
        success: true,
        user
      };

    } catch (error) {
      Logger.error('Profile update failed', { error, userId, updates });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile update failed'
      };
    }
  }

  /**
   * Отримання користувача за ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id: userId }
      });
    } catch (error) {
      Logger.error('Failed to get user by ID', { error, userId });
      return null;
    }
  }

  /**
   * Отримання користувача за wallet address
   */
  async getUserByWallet(walletAddress: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { walletAddress }
      });
    } catch (error) {
      Logger.error('Failed to get user by wallet', { error, walletAddress });
      return null;
    }
  }

  /**
   * Перевірка валідності токену
   */
  async validateToken(token: string): Promise<{
    valid: boolean;
    user?: User;
    payload?: JWTPayload;
    error?: string;
  }> {
    try {
      const payload = verifyJWT(token);
      
      // In DB_OFF_MODE we cannot read users from DB; return synthetic user
      if (process.env.DB_OFF_MODE === 'true') {
        const synthetic: User = ({
          id: payload.userId,
          walletAddress: payload.walletAddress,
          email: null,
          username: null,
          profileImageUrl: null,
          bio: null,
          isVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown) as User;
        return { valid: true, user: synthetic, payload };
      }

      const user = await this.getUserById(payload.userId);
      if (!user || (user as any).isActive === false) {
        return {
          valid: false,
          error: 'User not found or deactivated'
        };
      }

      return {
        valid: true,
        user,
        payload
      };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  /**
   * Деактивація користувача (адмін функція)
   */
  async deactivateUser(userId: string, adminId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Видалення всіх активних сесій користувача
      await prisma.userSession.deleteMany({
        where: { userId }
      });

      Logger.info('User deactivated', { userId, adminId });

      return { success: true };

    } catch (error) {
      Logger.error('User deactivation failed', { error, userId, adminId });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deactivation failed'
      };
    }
  }

  /**
   * Отримання статистики користувачів
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    newUsersToday: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalUsers, activeUsers, verifiedUsers, newUsersToday] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isVerified: true } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: today
            }
          }
        })
      ]);

      return {
        totalUsers,
        activeUsers,
        verifiedUsers,
        newUsersToday
      };

    } catch (error) {
      Logger.error('Failed to get user stats', { error });
      return {
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0,
        newUsersToday: 0
      };
    }
  }
}