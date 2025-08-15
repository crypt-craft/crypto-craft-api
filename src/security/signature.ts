import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

export function isValidSolanaPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function buildCanonicalAuthMessage(params: {
  walletAddress: string;
  action: 'login' | 'register';
  timestamp: number;
  nonce: string;
  domain: string;
}): string {
  return [
    `CryptoCraft - ${params.action.toUpperCase()}`,
    `Domain: ${params.domain}`,
    `Wallet: ${params.walletAddress}`,
    `Timestamp: ${params.timestamp}`,
    `Nonce: ${params.nonce}`,
    '',
    'By signing this message, you prove control over the wallet.',
    'Only sign if you trust this application.'
  ].join('\n');
}

export function verifyEd25519Signature(params: {
  walletAddress: string;
  message: string;
  signatureBase64: string;
}): boolean {
  const publicKey = new PublicKey(params.walletAddress);
  const messageBytes = new TextEncoder().encode(params.message);
  const signatureBytes = Buffer.from(params.signatureBase64, 'base64');
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
}


