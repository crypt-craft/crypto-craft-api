import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { prisma, User } from '@/database/prisma';
import { redisGetJson, redisSetJson, redisDel } from '@/database/redis';
import Logger from '@/utils/logger';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  DEVELOPER = 'DEVELOPER',
}

export class AuthError extends Error {
  public code: string;
  public statusCode: number;
  constructor(message: string, code: string, statusCode: number = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AuthError';
  }
}

export type JWTPayload = {
  userId: string;
  walletAddress: string;
  role: UserRole;
  jti: string;
  iat?: number;
  exp?: number;
};

export type AuthenticatedUser = User & { role: UserRole };

export type AuthRequest = Request & { user?: AuthenticatedUser };

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// duplicate import removed

export function generateJWT(user: User, role: UserRole = UserRole.USER): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  const jti = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const payload: JWTPayload = {
    userId: user.id,
    walletAddress: user.walletAddress,
    role,
    jti,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });

  Logger.info('JWT token generated', {
    userId: user.id,
    walletAddress: user.walletAddress,
    role,
  });

  return token;
}

async function isTokenRevoked(jti: string): Promise<boolean> {
  const revoked = await redisGetJson<boolean>(`jwt:revoked:${jti}`);
  return revoked === true;
}

async function revokeTokenByJti(jti: string, ttlSec: number): Promise<void> {
  await redisSetJson(`jwt:revoked:${jti}`, true, ttlSec);
}

export async function revokeJWT(token: string): Promise<void> {
  try {
    const payload = verifyJWT(token);
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = Math.max(1, (payload.exp || nowSec) - nowSec);
    await revokeTokenByJti(payload.jti, ttl);
  } catch {}
}

export function verifyJWT(token: string): JWTPayload {
  try {
    if (!process.env.JWT_SECRET) {
      throw new AuthError('JWT_SECRET not configured', 'JWT_SECRET_MISSING', 500);
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    return payload;
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('Token expired', 'TOKEN_EXPIRED', 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid token', 'INVALID_TOKEN', 401);
    } else {
      throw new AuthError('Token verification failed', 'TOKEN_VERIFICATION_FAILED', 401);
    }
  }
}

export function authenticateJWT(optional: boolean = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        if (optional) return next();
        return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;
      if (!token) {
        if (optional) return next();
        return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      }

      const payload = verifyJWT(token);
      if (await isTokenRevoked(payload.jti)) {
        return res.status(401).json({ error: 'Token revoked', code: 'TOKEN_REVOKED' });
      }

      // Attempt DB lookup first (skip when DB_OFF_MODE)
      let user: User | null = null;
      if (process.env.DB_OFF_MODE !== 'true') {
        user = await prisma.user.findUnique({ where: { id: payload.userId } }).catch(() => null as User | null);
      }

      // Fallback to Redis snapshot if DB not available or user missing
      if (!user) {
        const cached = await redisGetJson<User>(`session:user:${payload.userId}`);
        if (cached) {
          user = cached as User;
        }
      }

      if (!user) {
        if (process.env.AUTH_STATELESS_MODE === 'true' || process.env.DB_OFF_MODE === 'true') {
          // Synthesize minimal user in stateless mode
          const synthetic: Partial<User> = {
            id: payload.userId,
            walletAddress: payload.walletAddress,
            // The rest of fields may be null/undefined in stateless mode
          } as Partial<User>;
          req.user = { ...(synthetic as User), role: payload.role };
          Logger.debug('User authenticated in stateless mode', { userId: payload.userId, walletAddress: payload.walletAddress });
          return next();
        }
        return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      }

      if ((user as any).isActive === false) {
        return res.status(401).json({ error: 'User account is deactivated', code: 'USER_DEACTIVATED' });
      }

      req.user = { ...user, role: payload.role };
      // Best-effort update lastLoginAt when DB available
      try {
        if (process.env.DB_OFF_MODE !== 'true') {
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        }
      } catch {}
      Logger.debug('User authenticated successfully', { userId: user.id, walletAddress: user.walletAddress, role: payload.role });

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      Logger.error('Authentication error', { error });
      return res.status(500).json({ error: 'Internal authentication error', code: 'AUTH_INTERNAL_ERROR' });
    }
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }
    next();
  };
}

export function requireOwnership(getResourceUserId: (req: Request) => Promise<string> | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    try {
      const resourceUserId = await getResourceUserId(req);
      if ([UserRole.ADMIN, UserRole.MODERATOR].includes(req.user.role)) {
        return next();
      }
      if (req.user.id !== resourceUserId) {
        return res.status(403).json({ error: 'Access denied: not resource owner', code: 'NOT_RESOURCE_OWNER' });
      }
      next();
    } catch (error) {
      Logger.error('Ownership check error', { error });
      return res.status(500).json({ error: 'Ownership verification failed', code: 'OWNERSHIP_CHECK_FAILED' });
    }
  };
}

export async function createUserSession(user: User, role: UserRole = UserRole.USER): Promise<{ token: string; sessionId: string }> {
  const token = generateJWT(user, role);
  const ttlSec = 24 * 60 * 60;
  if (process.env.AUTH_STATELESS_MODE === 'true') {
    const sessionId = `stateless:${user.id}:${Date.now()}`;
    await redisSetJson(`session:token:${token}`, { userId: user.id, role }, ttlSec);
    await redisSetJson(`session:user:${user.id}`, user, ttlSec);
    Logger.info('Stateless session created (Redis)', { userId: user.id, sessionId });
    return { token, sessionId };
  }
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + ttlSec * 1000),
    },
  });
  Logger.info('User session created', { userId: user.id, sessionId: session.id, expiresAt: session.expiresAt });
  return { token, sessionId: session.id };
}

export async function destroyUserSession(token: string): Promise<void> {
  try {
    if (process.env.AUTH_STATELESS_MODE === 'true') {
      await redisDel(`session:token:${token}`);
      Logger.info('Stateless session destroyed', { token: token.substring(0, 10) + '...' });
      return;
    }
    await prisma.userSession.deleteMany({ where: { token } });
    // Revoke JWT by jti
    try {
      const payload = verifyJWT(token);
      const nowSec = Math.floor(Date.now() / 1000);
      const ttl = Math.max(1, (payload.exp || nowSec) - nowSec);
      await redisSetJson(`jwt:revoked:${payload.jti}`, true, ttl);
    } catch {}
    Logger.info('User session destroyed', { token: token.substring(0, 10) + '...' });
  } catch (error) {
    Logger.error('Failed to destroy session', { error });
  }
}

export function handleLogout() {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
        await destroyUserSession(token);
      }
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      Logger.error('Logout error', { error });
      res.status(500).json({ error: 'Logout failed', code: 'LOGOUT_FAILED' });
    }
  };
}

