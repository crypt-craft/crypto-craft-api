# Token Creation Flow

Кроки: (1) createTokenTransaction → (2) sign (wallet) → (3) submitSignedTransaction → (4) saveTokenMetadata

## 1) GraphQL мутація: createTokenTransaction
```ts
import { gql } from '@apollo/client';
import { apollo } from '../src/lib/apollo';

const CREATE_TOKEN_TX = gql`
  mutation CreateToken($input: CreateTokenInput!) {
    createTokenTransaction(input: $input) {
      transaction
      metadata {
        mintAddress
        tokenAccountAddress
        estimatedFee
        instructions
        nonce
        expiresAt
      }
      signingInstructions
    }
  }
`;

export async function createTokenTx(input: {
  name: string; symbol: string; decimals: number; initialSupply: number;
  description?: string; imageUrl?: string; externalUrl?: string;
}) {
  const { data } = await apollo.mutate({ mutation: CREATE_TOKEN_TX, variables: { input } });
  return data.createTokenTransaction as {
    transaction: string; metadata: any; signingInstructions: string[];
  };
}
```

## 2) Підпис транзакції в браузері
```ts
import { Transaction } from '@solana/web3.js';

export async function signSerializedTransaction(base64Unsigned: string): Promise<string> {
  if (!window.solana?.isPhantom) throw new Error('Phantom not found');
  const tx = Transaction.from(Buffer.from(base64Unsigned, 'base64'));
  const signed = await window.solana.signTransaction(tx);
  return Buffer.from(signed.serialize()).toString('base64');
}
```

## 3) GraphQL мутація: submitSignedTransaction
```ts
const SUBMIT_SIGNED = gql`
  mutation Submit($tx: String!, $meta: JSON) {
    submitSignedTransaction(signedTransaction: $tx, metadata: $meta) {
      success
      signature
      explorerUrl
      error
    }
  }
`;

export async function submitSigned(signedBase64: string, originalMeta?: any) {
  const { data } = await apollo.mutate({ mutation: SUBMIT_SIGNED, variables: { tx: signedBase64, meta: originalMeta } });
  return data.submitSignedTransaction as { success: boolean; signature?: string; explorerUrl?: string; error?: string };
}
```

## 4) GraphQL мутація: saveTokenMetadata
```ts
const SAVE_METADATA = gql`
  mutation Save($mint: String!, $sig: String!, $data: CreateTokenInput!) {
    saveTokenMetadata(mintAddress: $mint, transactionSignature: $sig, tokenData: $data) {
      id
      mintAddress
      name
      symbol
      decimals
      supply
    }
  }
`;

export async function saveMetadata(mintAddress: string, signature: string, tokenData: any) {
  const { data } = await apollo.mutate({ mutation: SAVE_METADATA, variables: { mint: mintAddress, sig: signature, data: tokenData } });
  return data.saveTokenMetadata;
}
```

## 5) Все разом
```ts
export async function createTokenEndToEnd(input: any) {
  const step1 = await createTokenTx(input);
  const signed = await signSerializedTransaction(step1.transaction);
  const step3 = await submitSigned(signed, { txHash: step1.metadata?.nonce });
  if (!step3.success || !step3.signature) throw new Error(step3.error || 'Submit failed');
  const saved = await saveMetadata(step1.metadata.mintAddress, step3.signature, input);
  return { ...saved, explorerUrl: step3.explorerUrl };
}
```
