-- Database Initialization Script
-- Creates initial schema for development
-- Note: database is already created by POSTGRES_DB env var

-- Database connection is already established

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE token_type AS ENUM ('FUNGIBLE', 'NON_FUNGIBLE', 'MEMECOIN');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');
CREATE TYPE airdrop_status AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE airdrop_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE network_type AS ENUM ('DEVNET', 'TESTNET', 'MAINNET');

-- Create basic tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50),
    avatar_url TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Create tokens table
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mint_address VARCHAR(44) UNIQUE NOT NULL,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blockchain VARCHAR(20) NOT NULL DEFAULT 'solana',
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 9,
    supply NUMERIC(20, 0) NOT NULL,
    token_type token_type NOT NULL DEFAULT 'FUNGIBLE',
    metadata JSONB,
    is_verified BOOLEAN DEFAULT false,
    is_frozen BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_tokens_creator_id ON tokens(creator_id);
CREATE INDEX IF NOT EXISTS idx_tokens_mint_address ON tokens(mint_address);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE cryptocraft_dev TO cryptocraft_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cryptocraft_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cryptocraft_user;

-- Insert test data
INSERT INTO users (wallet_address, email, username, bio) VALUES 
    ('11111111111111111111111111111112', 'test@example.com', 'testuser', 'Test user for development')
ON CONFLICT (wallet_address) DO NOTHING;

COMMIT;