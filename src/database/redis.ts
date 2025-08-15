import Redis from 'ioredis';
import Logger from '@/utils/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  try {
    if (redisClient) return redisClient;
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(url);
    const isTls = parsed.protocol === 'rediss:' || process.env.REDIS_TLS === 'true';
    const tlsOptions = isTls ? { rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' } : undefined;
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      tls: tlsOptions as any,
    });
    // Best-effort connect; do not throw in stateless mode
    redisClient.on('error', (err) => {
      Logger.warn('Redis client error', { error: err?.message });
    });
    return redisClient;
  } catch (error) {
    Logger.warn('Failed to initialize Redis client', { error });
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await client.set(key, payload);
    }
  } catch (error) {
    Logger.warn('Redis set json failed', { key, error });
  }
}

export async function redisGetJson<T = unknown>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    Logger.warn('Redis get json failed', { key, error });
    return null;
  }
}

export async function redisDel(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch (error) {
    Logger.warn('Redis del failed', { key, error });
  }
}

export async function pingRedis(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}


