/**
 * TransactionBuilder Service
 * 
 * Безпечний підхід до Web3 взаємодії:
 * - НІКОЛИ не отримує приватні ключі
 * - Створює unsigned транзакції на сервері
 * - Клієнт підписує локально в браузері
 * - Сервер тільки відправляє підписані транзакції
 */

import { 
  Connection, 
  Transaction, 
  PublicKey, 
  SystemProgram,
  TransactionInstruction,
  Keypair
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token';
import * as mpl from '@metaplex-foundation/mpl-token-metadata';
import Logger from '@/utils/logger';
import { validateCreateToken } from '@/utils/validation';

// Типи для безпечної взаємодії
export interface UnsignedTransactionRequest {
  userPublicKey: string;
  instructions: TransactionInstructionData[];
  recentBlockhash?: string;
  feePayer?: string;
}

export interface TransactionInstructionData {
  programId: string;
  keys: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string; // base64
}

export interface CreateTokenTransactionParams {
  userPublicKey: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  description?: string;
  imageUrl?: string;
  externalUrl?: string;
}

// Додати типи для спрощеної metadata
interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
}

export interface SubmitTransactionRequest {
  signedTransaction: string; // base64 serialized
  originalTxHash?: string; // для верифікації
}

export interface TransactionResponse {
  success: boolean;
  signature?: string;
  error?: string;
  explorerUrl?: string;
}

export interface UnsignedTransactionResponse {
  success: boolean;
  transaction?: string; // base64 serialized unsigned transaction
  metadata?: {
    mintAddress?: string;
    tokenAccountAddress?: string;
    metadataAddress?: string;
    estimatedFee: number;
    instructions: string[];
    nonce?: string;
    expiresAt?: string;
  };
  error?: string;
}

export class TransactionBuilderService {
  private connection: Connection;
  private network: string;

  constructor() {
    this.network = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(this.network, 'confirmed');
  }

  /**
   * Create Pinata authorization headers using env configuration.
   */
  private getPinataAuthHeader(): { header: Record<string, string> } | null {
    const jwt = process.env.PINATA_JWT;
    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;
    if (jwt && jwt.trim() !== '') {
      return { header: { Authorization: `Bearer ${jwt}` } };
    }
    if (apiKey && apiSecret) {
      return {
        header: {
          pinata_api_key: apiKey,
          pinata_secret_api_key: apiSecret
        }
      };
    }
    return null;
  }

  /**
   * Pins JSON metadata to IPFS via Pinata and returns the CID.
   */
  private async pinJsonToIpfs(json: any): Promise<string | null> {
    try {
      const auth = this.getPinataAuthHeader();
      if (!auth) {
        Logger.warn('Pinata credentials not configured. Skipping metadata pin.');
        return null;
      }
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth.header
        } as any,
        body: JSON.stringify({ pinataContent: json })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        Logger.warn('pinJSONToIPFS failed', { status: res.status, body: text });
        return null;
      }
      const out = await res.json();
      return out?.IpfsHash || null;
    } catch (error) {
      Logger.error('pinJsonToIpfs error', { error });
      return null;
    }
  }

  /**
   * Створення unsigned SPL-token transfer транзакції
   * Якщо sourceTokenAccount та authorityPublicKey передані - додається інструкція transferChecked
   * У будь-якому випадку перевіряється/створюється ATA отримувача, щоб транзакція була корисною для claim-флоу
   */
  async createTokenTransferTransaction(params: {
    mintAddress: string;
    fromPublicKey?: string; // Deprecated, use sourceTokenAccount
    sourceTokenAccount?: string; // SPL Token Account PDA з балансом кампанії (treasury)
    authorityPublicKey?: string; // Публічний ключ того, хто має право списати токени з sourceTokenAccount
    toPublicKey: string; // гаманeць отримувача (буде використано ATA)
    amount: string; // в одиницях токену (десяткові через decimals)
    decimals: number;
  }): Promise<UnsignedTransactionResponse> {
    try {
      const mintPublicKey = new PublicKey(params.mintAddress);
      const recipientWallet = new PublicKey(params.toPublicKey);
      const sourceTokenAccount = params.sourceTokenAccount
        ? new PublicKey(params.sourceTokenAccount)
        : undefined;
      const authorityPublicKey = params.authorityPublicKey
        ? new PublicKey(params.authorityPublicKey)
        : undefined;

      // Обчислюємо ATA отримувача
      const recipientAta = await getAssociatedTokenAddress(
        mintPublicKey,
        recipientWallet
      );

      const transaction = new Transaction();

      // 1) Створення ATA отримувача якщо немає
      const recipientAtaInfo = await this.connection.getAccountInfo(recipientAta);
      if (!recipientAtaInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            recipientWallet, // payer
            recipientAta,
            recipientWallet, // owner
            mintPublicKey
          )
        );
      }

      // 2) Додаємо transferChecked якщо є вихідний акаунт і authority
     if (sourceTokenAccount && authorityPublicKey) {
        const amountInBaseUnits = this.parseAmountToBaseUnits(params.amount, params.decimals);

        const { createTransferCheckedInstruction } = await import('@solana/spl-token');

        transaction.add(
          createTransferCheckedInstruction(
            sourceTokenAccount, // source
            mintPublicKey,      // mint
            recipientAta,       // destination
            authorityPublicKey, // authority
            amountInBaseUnits,  // amount
            params.decimals
          )
        );
      }

      // Blockhash/fee payer
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = recipientWallet; // отримувач як платник комісії у claim-флоу

      // Не підписуємо – повертаємо unsigned
      const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });

      const estimatedFee = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed'
      );

      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      return {
        success: true,
        transaction: serialized.toString('base64'),
        metadata: {
          mintAddress: mintPublicKey.toString(),
          tokenAccountAddress: recipientAta.toString(),
          metadataAddress: PublicKey.default.toString(),
          estimatedFee: estimatedFee?.value || 0,
          instructions: [
            'Ensure recipient associated token account',
            sourceTokenAccount && authorityPublicKey ? 'TransferChecked' : 'No transfer (treasury not configured)'
          ],
          nonce,
          expiresAt
        }
      };
    } catch (error) {
      Logger.error('Failed to create token transfer transaction', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  /**
   * Create unsigned transaction to update Metaplex metadata for a fungible token
   */
  async createUpdateMetadataTransaction(params: {
    userPublicKey: string;
    mintAddress: string;
    name?: string;
    symbol?: string;
    uri: string;
  }): Promise<UnsignedTransactionResponse> {
    try {
      const userPk = new PublicKey(params.userPublicKey);
      const mintPk = new PublicKey(params.mintAddress);
      const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      const [metadataPda] = PublicKey.findProgramAddressSync([
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintPk.toBuffer()
      ], TOKEN_METADATA_PROGRAM_ID);

      // Validate URI availability (HEAD) and JSON schema (GET minimal)
      const uri = params.uri;
      try {
        const head = await fetch(uri, { method: 'HEAD' });
        if (!head.ok) {
          return { success: false, error: `Metadata URL not reachable (status ${head.status})` };
        }
        const getRes = await fetch(uri, { method: 'GET' });
        const contentType = getRes.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return { success: false, error: 'Metadata URL must return application/json' };
        }
        const json = await getRes.json();
        if (!json || typeof json !== 'object' || !json.name || !json.symbol) {
          return { success: false, error: 'Metadata JSON must include at least name and symbol' };
        }
      } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to validate metadata URL' };
      }

      const transaction = new Transaction();

      // Check if metadata account exists
      const metaInfo = await this.connection.getAccountInfo(metadataPda);
      if (!metaInfo) {
        // Try to create metadata if caller is mint authority
        try {
          const { getMint } = await import('@solana/spl-token');
          const mintAcc = await getMint(this.connection, mintPk);
          const mintAuthority = mintAcc.mintAuthority; // PublicKey | null
          if (!mintAuthority || !mintAuthority.equals(userPk)) {
            return { success: false, error: 'Metadata account not found and caller is not mint authority' };
          }

          const createIx = (mpl as any).createCreateMetadataAccountV3Instruction(
            {
              metadata: metadataPda,
              mint: mintPk,
              mintAuthority: userPk,
              payer: userPk,
              updateAuthority: userPk
            },
            {
              data: {
                name: (params.name || '').slice(0, 32),
                symbol: (params.symbol || '').slice(0, 10),
                uri: uri.slice(0, 200),
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null
              },
              isMutable: true,
              collectionDetails: null
            }
          );
          transaction.add(createIx);
        } catch (e) {
          return { success: false, error: 'Failed to prepare create metadata instruction' };
        }
      } else {
        // Update path
        const data = {
          name: (params.name || '').slice(0, 32),
          symbol: (params.symbol || '').slice(0, 10),
          uri: uri.slice(0, 200),
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null
        } as any;

        const ix = (mpl as any).createUpdateMetadataAccountV2Instruction({
          metadata: metadataPda,
          updateAuthority: userPk,
        }, {
          updateMetadataAccountArgsV2: {
            data,
            updateAuthority: null,
            primarySaleHappened: null,
            isMutable: null,
          }
        });
        transaction.add(ix);
      }

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPk;

      const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const estimatedFee = await this.connection.getFeeForMessage(transaction.compileMessage(), 'confirmed');

      return {
        success: true,
        transaction: serialized.toString('base64'),
        metadata: {
          mintAddress: mintPk.toString(),
          tokenAccountAddress: '',
          metadataAddress: metadataPda.toString(),
          estimatedFee: estimatedFee?.value || 0,
          instructions: ['Update Metadata Account V2']
        }
      };

    } catch (error) {
      Logger.error('Failed to create update metadata transaction', { error, params });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }

  private parseAmountToBaseUnits(amount: string, decimals: number): bigint {
    if (!/^(?:\d+)(?:\.(\d+))?$/.test(amount)) {
      throw new Error('Invalid amount format');
    }
    const [intPart, fracPart = ''] = amount.split('.');
    if (fracPart.length > decimals) {
      throw new Error('Amount has more decimal places than token supports');
    }
    const paddedFrac = fracPart.padEnd(decimals, '0');
    const normalized = `${intPart}${paddedFrac}`.replace(/^0+(\d)/, '$1');
    const digits = normalized.length === 0 ? '0' : normalized;
    return BigInt(digits);
  }
  /**
   * Створення unsigned транзакції для токену
   * Клієнт отримає цю транзакцію та підпише локально
   */
  async createTokenTransaction(params: CreateTokenTransactionParams): Promise<UnsignedTransactionResponse> {
    try {
      // Валідація параметрів
      const validatedParams = params; // Використовуємо params безпосередньо, валідація відбувається в REST endpoint
      
      const userPublicKey = new PublicKey(params.userPublicKey);
      
      // Генеруємо новий mint keypair на сервері
      const mintKeypair = Keypair.generate();
      const mintPublicKey = mintKeypair.publicKey;

      // Отримуємо або створюємо associated token account
      const tokenAccountAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        userPublicKey
      );

      // Підготовка Metaplex Metadata URI (пін на IPFS, якщо доступні ключі)
      let imageField = validatedParams.imageUrl || '';
      // Якщо це gateway URL до Pinata, сконвертуємо у ipfs://CID для кращої сумісності
      const pinataGatewayMatch = imageField.match(/https?:\/\/[^/]*pinata[^/]*\/ipfs\/([^/?#]+)/i);
      if (pinataGatewayMatch) {
        imageField = `ipfs://${pinataGatewayMatch[1]}`;
      }

      const offchainMetadata = {
        name: validatedParams.name,
        symbol: validatedParams.symbol,
        description: validatedParams.description || '',
        image: imageField || '',
        external_url: validatedParams.externalUrl || '',
        // Minimal compliant fields for fungible token metadata
        properties: {
          category: 'token'
        }
      } as Record<string, any>;

      let metadataUri = '';
      const ipfsCid = await this.pinJsonToIpfs(offchainMetadata);
      if (ipfsCid) {
        // Використовуємо канонічний ipfs:// CID для максимальної сумісності з екосистемою
        metadataUri = `https://gateway.pinata.cloud/ipfs/${ipfsCid}`;
      } else {
        // Фолбек: спробуємо використати image як URI (не рекомендовано, але краще ніж порожньо)
        metadataUri = offchainMetadata.image || '';
      }

      // Обчислюємо Metadata PDA
      const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintPublicKey.toBuffer()
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Створюємо транзакцію
      const transaction = new Transaction();

      // 1. Створення mint account
      const mintLamports = await this.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: userPublicKey,
          newAccountPubkey: mintPublicKey,
          lamports: mintLamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // 2. Ініціалізація mint
      transaction.add(
        createInitializeMintInstruction(
          mintPublicKey,
          validatedParams.decimals,
          userPublicKey, // mint authority
          userPublicKey  // freeze authority
        )
      );

      // 3. Створення associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey, // payer
          tokenAccountAddress,
          userPublicKey, // owner
          mintPublicKey
        )
      );

      // 3.1 Створення Metaplex Metadata Account (оновлена підтримка)
      try {
        const createMetaIx = (mpl as any).createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataPda,
            mint: mintPublicKey,
            mintAuthority: userPublicKey,
            payer: userPublicKey,
            updateAuthority: userPublicKey
          },
          {
            data: {
              name: validatedParams.name,
              symbol: validatedParams.symbol,
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null
            },
            isMutable: true,
            collectionDetails: null
          }
        );
        transaction.add(createMetaIx);
      } catch (e) {
        Logger.warn('Failed to add create metadata instruction', { error: (e as Error)?.message });
      }

      // 4. Mint початкової кількості токенів
      if (validatedParams.initialSupply > 0) {
        transaction.add(
          createMintToInstruction(
            mintPublicKey,
            tokenAccountAddress,
            userPublicKey, // mint authority
            BigInt(validatedParams.initialSupply * Math.pow(10, validatedParams.decimals))
          )
        );
      }

      // 4.1. (Опційно) Відкликання mint authority для кращої безпеки (клієнт підпише)
      transaction.add(
        createSetAuthorityInstruction(
          mintPublicKey,
          userPublicKey, // current authority
          AuthorityType.MintTokens,
          null // revoke
        )
      );

      // 5. (Застаріло) Локальні метадані тепер публікуються на IPFS і записуються в on-chain Metadata

      // Отримуємо recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;

      // Підписуємо частини транзакції, які потребують серверного підпису (mint keypair)
      transaction.partialSign(mintKeypair);

      // Серіалізуємо unsigned транзакцію
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false, // Важливо: дозволяємо часткове підписання
        verifySignatures: false
      });

      // Оцінка комісії
      const estimatedFee = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed'
      );

      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      Logger.info('Unsigned token transaction created', {
        mintAddress: mintPublicKey.toString(),
        tokenAccount: tokenAccountAddress.toString(),
        estimatedFee: estimatedFee?.value || 'unknown',
        userPublicKey: params.userPublicKey
      });

      return {
        success: true,
        transaction: serializedTransaction.toString('base64'),
        metadata: {
          mintAddress: mintPublicKey.toString(),
          tokenAccountAddress: tokenAccountAddress.toString(),
          metadataAddress: metadataPda.toString(),
          estimatedFee: estimatedFee?.value || 0,
          instructions: [
            'Create Mint Account',
            'Initialize Mint',
            'Create Token Account', 
            'Create Metadata Account',
            'Mint Initial Supply',
            'Revoke Mint Authority'
          ],
          nonce,
          expiresAt
        }
      };

    } catch (error) {
      Logger.error('Failed to create token transaction', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Відправка підписаної транзакції в мережу
   */
  async submitSignedTransaction(request: SubmitTransactionRequest): Promise<TransactionResponse> {
    try {
      const transactionBuffer = Buffer.from(request.signedTransaction, 'base64');
      
      // Відправляємо транзакцію
      const signature = await this.connection.sendRawTransaction(transactionBuffer, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });

      // Очікуємо підтвердження
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      const cluster = this.network.includes('devnet') ? 'devnet' : 'mainnet-beta';
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;

      Logger.info('Transaction submitted successfully', {
        signature,
        explorerUrl
      });

      return {
        success: true,
        signature,
        explorerUrl
      };

    } catch (error) {
      Logger.error('Failed to submit transaction', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction submission failed'
      };
    }
  }

  /**
   * Перевірка статусу транзакції
   */
  async getTransactionStatus(signature: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed' | 'not_found';
    confirmations?: number;
    error?: string;
  }> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      
      if (!status.value) {
        return { status: 'not_found' };
      }

      if (status.value.err) {
        return { 
          status: 'failed', 
          error: JSON.stringify(status.value.err) 
        };
      }

      if (status.value.confirmationStatus === 'confirmed' || 
          status.value.confirmationStatus === 'finalized') {
        return { 
          status: 'confirmed',
          confirmations: status.value.confirmations || 0
        };
      }

      return { status: 'pending' };

    } catch (error) {
      Logger.error('Failed to get transaction status', { error, signature });
      return { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Status check failed' 
      };
    }
  }

  /**
   * Отримання поточної мережі та її статусу
   */
  async getNetworkInfo(): Promise<{
    network: string;
    blockHeight: number;
    health: 'ok' | 'degraded' | 'down';
  }> {
    try {
      const blockHeight = await this.connection.getBlockHeight();
      
      return {
        network: this.network,
        blockHeight,
        health: 'ok'
      };

    } catch (error) {
      Logger.error('Failed to get network info', { error });
      return {
        network: this.network,
        blockHeight: 0,
        health: 'down'
      };
    }
  }

  /**
   * Валідація публічного ключа
   */
  validatePublicKey(publicKeyString: string): boolean {
    try {
      new PublicKey(publicKeyString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Оцінка комісії для транзакції
   */
  async estimateTransactionFee(instructions: TransactionInstruction[]): Promise<number> {
    try {
      const transaction = new Transaction();
      instructions.forEach(ix => transaction.add(ix));
      
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = Keypair.generate().publicKey; // Dummy fee payer
      
      const fee = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed'
      );

      return fee?.value || 5000; // Default fallback

    } catch (error) {
      Logger.error('Failed to estimate transaction fee', { error });
      return 5000; // Default fee
    }
  }
}