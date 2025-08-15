# Auth Flow (Wallet-based)

Ціль: отримати JWT для подальших GraphQL/REST запитів.

## 1) Отримати повідомлення для підпису
```ts
import { apiGet } from '../src/lib/api';

export async function getAuthMessage(walletAddress: string, action: 'login'|'register'='login') {
  return apiGet(`/api/auth/message?walletAddress=${walletAddress}&action=${action}`);
}
```

## 2) Підписати повідомлення (Phantom)
```ts
// Phantom injected provider
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { solana?: any } }

export async function signMessagePhantom(message: string): Promise<string> {
  if (!window.solana?.isPhantom) throw new Error('Phantom not found');
  const enc = new TextEncoder();
  const signed = await window.solana.signMessage(enc.encode(message), 'utf8');
  // Some wallets return Uint8Array => base58/base64. Backend expects a string signature; use base64
  return Buffer.from(signed.signature).toString('base64');
}
```

## 3) Register/Login
```ts
import { apiPost } from '../src/lib/api';

export async function register({ walletAddress, signature, message, timestamp, username, email }: any) {
  return apiPost('/api/auth/register', { walletAddress, signature, message, timestamp, username, email });
}

export async function login({ walletAddress, signature, message, timestamp }: any) {
  return apiPost('/api/auth/login', { walletAddress, signature, message, timestamp });
}
```

## 4) Збірка разом (React hook приклад)
```ts
// src/hooks/useAuth.ts
import { useState } from 'react';
import { getAuthMessage, signMessagePhantom, register, login } from './authHelpers';

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('cc_jwt'));

  async function authenticate(walletAddress: string, action: 'login'|'register'='login', extra?: {username?: string; email?: string}) {
    const { message, timestamp } = await getAuthMessage(walletAddress, action);
    const signature = await signMessagePhantom(message);

    const res = action === 'register'
      ? await register({ walletAddress, signature, message, timestamp, ...extra })
      : await login({ walletAddress, signature, message, timestamp });

    if (res?.token) {
      localStorage.setItem('cc_jwt', res.token);
      setToken(res.token);
    }

    return res;
  }

  return { token, authenticate };
}
```

Після цього додавайте JWT у заголовок `Authorization: Bearer <token>`.
