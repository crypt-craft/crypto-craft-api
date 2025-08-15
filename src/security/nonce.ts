import crypto from 'crypto';
import { redisGetJson, redisSetJson, redisDel } from '@/database/redis';

export type NonceRecord = {
  walletAddress: string;
  action: 'login' | 'register';
  userAgentHash: string;
  ipSubnet?: string;
  createdAt: number;
  ttlMs: number;
  used?: boolean;
};

function hashUserAgent(ua: string | undefined): string {
  const input = ua || '';
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getSubnetFromIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  const parts = ip.split('.');
  if (parts.length !== 4) return undefined;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

export async function createAndStoreNonce(params: {
  walletAddress: string;
  action: 'login' | 'register';
  userAgent?: string;
  ip?: string;
  ttlSeconds?: number;
}): Promise<{ nonce: string; timestamp: number }> {
  const nonce = generateNonce();
  const timestamp = Date.now();
  const ttlSeconds = params.ttlSeconds && params.ttlSeconds > 0 ? params.ttlSeconds : 300;
  const record: NonceRecord = {
    walletAddress: params.walletAddress,
    action: params.action,
    userAgentHash: hashUserAgent(params.userAgent),
    ipSubnet: getSubnetFromIp(params.ip),
    createdAt: timestamp,
    ttlMs: ttlSeconds * 1000,
    used: false,
  };
  await redisSetJson(`nonce:${params.walletAddress}:${nonce}`, record, ttlSeconds);
  return { nonce, timestamp };
}

export async function consumeNonce(params: {
  walletAddress: string;
  nonce: string;
  userAgent?: string;
  ip?: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = `nonce:${params.walletAddress}:${params.nonce}`;
  const record = await redisGetJson<NonceRecord>(key);
  if (!record) {
    return { ok: false, reason: 'NONCE_NOT_FOUND_OR_EXPIRED' };
  }
  if (record.used) {
    return { ok: false, reason: 'NONCE_ALREADY_USED' };
  }
  if (Date.now() - record.createdAt > record.ttlMs) {
    return { ok: false, reason: 'NONCE_EXPIRED' };
  }
  const uaHash = hashUserAgent(params.userAgent);
  if (uaHash !== record.userAgentHash) {
    return { ok: false, reason: 'USER_AGENT_MISMATCH' };
  }
  const subnet = getSubnetFromIp(params.ip);
  if (record.ipSubnet && subnet && subnet !== record.ipSubnet) {
    return { ok: false, reason: 'IP_MISMATCH' };
  }
  await redisDel(key);
  return { ok: true };
}


