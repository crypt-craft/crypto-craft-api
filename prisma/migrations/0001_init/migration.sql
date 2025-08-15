-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('FUNGIBLE', 'NON_FUNGIBLE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NetworkType" AS ENUM ('DEVNET', 'TESTNET', 'MAINNET');

-- CreateEnum
CREATE TYPE "AirdropStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AirdropPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "wallet_address" VARCHAR(44) NOT NULL,
    "username" VARCHAR(50),
    "email" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_image_url" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "mint_address" VARCHAR(44) NOT NULL,
    "creator_id" UUID NOT NULL,
    "blockchain" VARCHAR(20) NOT NULL DEFAULT 'solana',
    "network" "NetworkType" NOT NULL DEFAULT 'DEVNET',
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 9,
    "supply" DECIMAL(20,9) NOT NULL,
    "token_type" "TokenType" NOT NULL DEFAULT 'FUNGIBLE',
    "metadata" JSONB,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tx_hash" VARCHAR(128),
    "user_id" UUID NOT NULL,
    "token_id" UUID,
    "transaction_type" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(20,9),
    "fee" DECIMAL(20,9),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "blockchain" VARCHAR(20) NOT NULL DEFAULT 'solana',
    "network" "NetworkType" NOT NULL DEFAULT 'DEVNET',
    "block_height" BIGINT,
    "metadata" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airdrop_campaigns" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "creator_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "total_amount" DECIMAL(20,9) NOT NULL,
    "recipients_count" INTEGER NOT NULL DEFAULT 0,
    "status" "AirdropStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "AirdropPriority" NOT NULL DEFAULT 'NORMAL',
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airdrop_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airdrop_recipients" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "campaign_id" UUID NOT NULL,
    "address" VARCHAR(44) NOT NULL,
    "amount" DECIMAL(20,9) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" VARCHAR(128),
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airdrop_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_mint_address_key" ON "tokens"("mint_address");

-- CreateIndex
CREATE INDEX "tokens_creator_id_idx" ON "tokens"("creator_id");

-- CreateIndex
CREATE INDEX "tokens_blockchain_network_idx" ON "tokens"("blockchain", "network");

-- CreateIndex
CREATE INDEX "tokens_symbol_idx" ON "tokens"("symbol");

-- CreateIndex
CREATE INDEX "tokens_is_verified_idx" ON "tokens"("is_verified");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tx_hash_key" ON "transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_token_id_idx" ON "transactions"("token_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_blockchain_network_idx" ON "transactions"("blockchain", "network");

-- CreateIndex
CREATE INDEX "airdrop_campaigns_creator_id_idx" ON "airdrop_campaigns"("creator_id");

-- CreateIndex
CREATE INDEX "airdrop_campaigns_token_id_idx" ON "airdrop_campaigns"("token_id");

-- CreateIndex
CREATE INDEX "airdrop_campaigns_status_idx" ON "airdrop_campaigns"("status");

-- CreateIndex
CREATE INDEX "airdrop_campaigns_scheduled_at_idx" ON "airdrop_campaigns"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "airdrop_recipients_campaign_id_address_key" ON "airdrop_recipients"("campaign_id", "address");

-- CreateIndex
CREATE INDEX "airdrop_recipients_campaign_id_idx" ON "airdrop_recipients"("campaign_id");

-- CreateIndex
CREATE INDEX "airdrop_recipients_status_idx" ON "airdrop_recipients"("status");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airdrop_campaigns" ADD CONSTRAINT "airdrop_campaigns_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airdrop_campaigns" ADD CONSTRAINT "airdrop_campaigns_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airdrop_recipients" ADD CONSTRAINT "airdrop_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "airdrop_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;