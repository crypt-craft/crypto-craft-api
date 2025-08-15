# Database Schema Documentation

## Overview

CryptoCraft використовує PostgreSQL як основну базу даних для зберігання метаданих, аналітики та кешування blockchain даних. База даних спроектована для високої продуктивності, масштабованості та підтримки складних запитів для аналітики.

## Database Configuration

### Connection Settings
```env
# Local Development
DATABASE_URL=postgresql://cryptocraft_user:password@localhost:5432/cryptocraft_dev

# Staging
DATABASE_URL=postgresql://cryptocraft_user:secure_password@staging-db:5432/cryptocraft_staging

# Production
DATABASE_URL=postgresql://cryptocraft_user:very_secure_password@prod-db:5432/cryptocraft_prod
```

### Connection Pool Settings
```typescript
const config = {
  max: 20,           // максимальна кількість з'єднань
  idleTimeoutMillis: 30000,  // час простою перед закриттям
  connectionTimeoutMillis: 2000,  // таймаут підключення
}
```

## Core Tables

### 1. Users & Authentication

#### users
Основна таблиця користувачів.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Indexes
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### user_sessions
Сесії користувачів для JWT токенів.

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
```

#### api_keys
API ключі для бізнес-інтеграцій.

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    rate_limit_per_hour INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

### 2. Tokens & NFTs

#### tokens
Основна таблиця токенів.

```sql
CREATE TYPE token_type AS ENUM ('fungible', 'non_fungible', 'memecoin');
CREATE TYPE token_status AS ENUM ('pending', 'active', 'frozen', 'burned');

CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mint_address VARCHAR(44) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    description TEXT,
    image_url TEXT,
    token_type token_type NOT NULL,
    status token_status DEFAULT 'pending',
    total_supply NUMERIC(78, 0) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 9,
    mint_authority VARCHAR(44),
    freeze_authority VARCHAR(44),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_tokens_mint_address ON tokens(mint_address);
CREATE INDEX idx_tokens_creator_id ON tokens(creator_id);
CREATE INDEX idx_tokens_type ON tokens(token_type);
CREATE INDEX idx_tokens_status ON tokens(status);
CREATE INDEX idx_tokens_created_at ON tokens(created_at);
CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_tokens_name_gin ON tokens USING gin(to_tsvector('english', name));
```

#### nft_collections
NFT колекції.

```sql
CREATE TABLE nft_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_address VARCHAR(44) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    total_supply INTEGER NOT NULL,
    minted_count INTEGER DEFAULT 0,
    royalty_percentage DECIMAL(5,2) DEFAULT 0,
    royalty_address VARCHAR(44),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_nft_collections_creator_id ON nft_collections(creator_id);
CREATE INDEX idx_nft_collections_collection_address ON nft_collections(collection_address);
```

#### nfts
Індивідуальні NFT.

```sql
CREATE TABLE nfts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mint_address VARCHAR(44) UNIQUE NOT NULL,
    collection_id UUID REFERENCES nft_collections(id),
    owner_address VARCHAR(44) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    attributes JSONB,
    metadata JSONB,
    rarity_rank INTEGER,
    last_sale_price NUMERIC(78, 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_nfts_mint_address ON nfts(mint_address);
CREATE INDEX idx_nfts_collection_id ON nfts(collection_id);
CREATE INDEX idx_nfts_owner_address ON nfts(owner_address);
CREATE INDEX idx_nfts_rarity_rank ON nfts(rarity_rank);
```

### 3. Transactions

#### transactions
Основна таблиця транзакцій.

```sql
CREATE TYPE transaction_type AS ENUM (
    'token_create', 'token_transfer', 'token_burn',
    'nft_mint', 'nft_transfer', 'nft_burn',
    'airdrop_distribute', 'liquidity_add', 'liquidity_remove',
    'payment', 'swap'
);

CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed', 'cancelled');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash VARCHAR(88) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    type transaction_type NOT NULL,
    status transaction_status DEFAULT 'pending',
    amount NUMERIC(78, 0),
    from_address VARCHAR(44),
    to_address VARCHAR(44),
    token_id UUID REFERENCES tokens(id),
    fee NUMERIC(78, 0),
    block_height BIGINT,
    slot BIGINT,
    confirmations INTEGER DEFAULT 0,
    metadata JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_transactions_hash ON transactions(hash);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_from_address ON transactions(from_address);
CREATE INDEX idx_transactions_to_address ON transactions(to_address);
CREATE INDEX idx_transactions_token_id ON transactions(token_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_confirmed_at ON transactions(confirmed_at);
CREATE INDEX idx_transactions_block_height ON transactions(block_height);
```

### 4. Airdrop Management

#### airdrop_campaigns
Airdrop кампанії.

```sql
CREATE TYPE airdrop_status AS ENUM ('draft', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled');

CREATE TABLE airdrop_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    total_amount NUMERIC(78, 0) NOT NULL,
    recipients_count INTEGER NOT NULL,
    status airdrop_status DEFAULT 'draft',
    distributed_amount NUMERIC(78, 0) DEFAULT 0,
    successful_transfers INTEGER DEFAULT 0,
    failed_transfers INTEGER DEFAULT 0,
    batch_size INTEGER DEFAULT 100,
    fee_per_recipient NUMERIC(78, 0),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_airdrop_campaigns_creator_id ON airdrop_campaigns(creator_id);
CREATE INDEX idx_airdrop_campaigns_token_id ON airdrop_campaigns(token_id);
CREATE INDEX idx_airdrop_campaigns_status ON airdrop_campaigns(status);
CREATE INDEX idx_airdrop_campaigns_scheduled_at ON airdrop_campaigns(scheduled_at);
CREATE INDEX idx_airdrop_campaigns_created_at ON airdrop_campaigns(created_at);
```

#### airdrop_recipients
Отримувачі airdrop.

```sql
CREATE TABLE airdrop_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES airdrop_campaigns(id) ON DELETE CASCADE,
    address VARCHAR(44) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    status transaction_status DEFAULT 'pending',
    transaction_hash VARCHAR(88),
    batch_number INTEGER,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_airdrop_recipients_campaign_id ON airdrop_recipients(campaign_id);
CREATE INDEX idx_airdrop_recipients_address ON airdrop_recipients(address);
CREATE INDEX idx_airdrop_recipients_status ON airdrop_recipients(status);
CREATE INDEX idx_airdrop_recipients_batch_number ON airdrop_recipients(batch_number);
CREATE INDEX idx_airdrop_recipients_transaction_hash ON airdrop_recipients(transaction_hash);

-- Unique constraint for campaign + address
CREATE UNIQUE INDEX idx_airdrop_recipients_campaign_address ON airdrop_recipients(campaign_id, address);
```

### 5. Liquidity & DEX

#### liquidity_pools
Пули ліквідності.

```sql
CREATE TABLE liquidity_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(44) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    token_a_id UUID NOT NULL REFERENCES tokens(id),
    token_b_id UUID NOT NULL REFERENCES tokens(id),
    reserve_a NUMERIC(78, 0) NOT NULL DEFAULT 0,
    reserve_b NUMERIC(78, 0) NOT NULL DEFAULT 0,
    lp_token_supply NUMERIC(78, 0) NOT NULL DEFAULT 0,
    fee_percentage DECIMAL(10, 6) NOT NULL DEFAULT 0.003,
    total_volume NUMERIC(78, 0) DEFAULT 0,
    total_fees NUMERIC(78, 0) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_liquidity_pools_address ON liquidity_pools(address);
CREATE INDEX idx_liquidity_pools_creator_id ON liquidity_pools(creator_id);
CREATE INDEX idx_liquidity_pools_token_a_id ON liquidity_pools(token_a_id);
CREATE INDEX idx_liquidity_pools_token_b_id ON liquidity_pools(token_b_id);
CREATE INDEX idx_liquidity_pools_is_active ON liquidity_pools(is_active);

-- Unique constraint for token pair
CREATE UNIQUE INDEX idx_liquidity_pools_token_pair ON liquidity_pools(
    LEAST(token_a_id, token_b_id),
    GREATEST(token_a_id, token_b_id)
);
```

### 6. Solana Pay

#### solana_pay_transactions
Solana Pay транзакції.

```sql
CREATE TABLE solana_pay_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(100) UNIQUE NOT NULL,
    merchant_id UUID NOT NULL REFERENCES users(id),
    customer_address VARCHAR(44),
    amount NUMERIC(78, 0) NOT NULL,
    token_id UUID REFERENCES tokens(id),
    status transaction_status DEFAULT 'pending',
    transaction_hash VARCHAR(88),
    memo TEXT,
    payment_url TEXT,
    qr_code_data TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_solana_pay_reference ON solana_pay_transactions(reference);
CREATE INDEX idx_solana_pay_merchant_id ON solana_pay_transactions(merchant_id);
CREATE INDEX idx_solana_pay_customer_address ON solana_pay_transactions(customer_address);
CREATE INDEX idx_solana_pay_status ON solana_pay_transactions(status);
CREATE INDEX idx_solana_pay_expires_at ON solana_pay_transactions(expires_at);
```

### 7. Analytics & Metrics

#### analytics_daily
Щоденна аналітика.

```sql
CREATE TABLE analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    tokens_created INTEGER DEFAULT 0,
    nfts_minted INTEGER DEFAULT 0,
    transactions_count INTEGER DEFAULT 0,
    airdrop_campaigns INTEGER DEFAULT 0,
    total_volume NUMERIC(78, 0) DEFAULT 0,
    total_fees NUMERIC(78, 0) DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    unique_addresses INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX idx_analytics_daily_date ON analytics_daily(date);
CREATE INDEX idx_analytics_daily_created_at ON analytics_daily(created_at);
```

#### analytics_hourly
Погодинна аналітика для детального моніторингу.

```sql
CREATE TABLE analytics_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    transactions_count INTEGER DEFAULT 0,
    total_volume NUMERIC(78, 0) DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    error_rate DECIMAL(5, 2) DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX idx_analytics_hourly_timestamp ON analytics_hourly(timestamp);
CREATE INDEX idx_analytics_hourly_created_at ON analytics_hourly(created_at);
```

#### user_analytics
Аналітика по користувачах.

```sql
CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    tokens_created INTEGER DEFAULT 0,
    nfts_minted INTEGER DEFAULT 0,
    airdrops_initiated INTEGER DEFAULT 0,
    transactions_sent INTEGER DEFAULT 0,
    transactions_received INTEGER DEFAULT 0,
    volume_sent NUMERIC(78, 0) DEFAULT 0,
    volume_received NUMERIC(78, 0) DEFAULT 0,
    fees_paid NUMERIC(78, 0) DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_date ON user_analytics(date);
CREATE UNIQUE INDEX idx_user_analytics_user_date ON user_analytics(user_id, date);
```

### 8. System & Configuration

#### system_config
Системні налаштування.

```sql
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_system_config_key ON system_config(key);
CREATE INDEX idx_system_config_is_public ON system_config(is_public);
```

#### webhooks
Webhook конфігурації.

```sql
CREATE TYPE webhook_status AS ENUM ('active', 'inactive', 'failed');

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(255),
    status webhook_status DEFAULT 'active',
    retry_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_status ON webhooks(status);
CREATE INDEX idx_webhooks_events ON webhooks USING gin(events);
```

#### audit_logs
Аудит логи для безпеки.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Partitioning by month for better performance
CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Triggers & Functions

### Updated At Trigger
Автоматичне оновлення `updated_at` колонки.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at column
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tokens_updated_at 
    BEFORE UPDATE ON tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... (repeat for other tables)
```

### Analytics Aggregation Function
Функція для агрегації щоденної аналітики.

```sql
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(target_date DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO analytics_daily (
        date, tokens_created, transactions_count, total_volume,
        active_users, new_users, success_rate
    )
    SELECT
        target_date,
        COUNT(CASE WHEN t.type = 'token_create' THEN 1 END),
        COUNT(*),
        COALESCE(SUM(t.amount), 0),
        COUNT(DISTINCT t.user_id) FILTER (WHERE t.user_id IS NOT NULL),
        COUNT(DISTINCT u.id) FILTER (WHERE u.created_at::date = target_date),
        ROUND(
            COUNT(CASE WHEN t.status = 'confirmed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
        )
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.created_at::date = target_date
    ON CONFLICT (date) DO UPDATE SET
        tokens_created = EXCLUDED.tokens_created,
        transactions_count = EXCLUDED.transactions_count,
        total_volume = EXCLUDED.total_volume,
        active_users = EXCLUDED.active_users,
        new_users = EXCLUDED.new_users,
        success_rate = EXCLUDED.success_rate;
END;
$$ LANGUAGE plpgsql;
```

## Database Migrations

### Migration Structure
```
migrations/
├── 001_initial_schema.sql
├── 002_add_indexes.sql
├── 003_create_triggers.sql
├── 004_add_analytics_tables.sql
├── 005_add_solana_pay.sql
└── 006_add_audit_logs.sql
```

### Migration Example
```sql
-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema
-- Date: 2024-01-15

BEGIN;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create types
CREATE TYPE token_type AS ENUM ('fungible', 'non_fungible', 'memecoin');
-- ... (continue with table creation)

COMMIT;
```

## Performance Optimization

### Indexing Strategy
1. **Primary Keys**: Всі таблиці мають UUID primary keys
2. **Foreign Keys**: Індекси на всіх foreign key колонках
3. **Search Fields**: GIN індекси для full-text search
4. **Time Series**: Індекси на timestamp колонки
5. **Composite Indexes**: Для частих запитів з кількома умовами

### Query Optimization
1. **Connection Pooling**: Використання pgbouncer
2. **Read Replicas**: Для read-only запитів
3. **Partitioning**: Для великих таблиць (audit_logs, analytics)
4. **Materialized Views**: Для складних аналітичних запитів

### Monitoring Queries
```sql
-- Slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Backup & Recovery

### Backup Strategy
1. **Daily Full Backups**: pg_dump з компресією
2. **Continuous WAL Archiving**: Для point-in-time recovery
3. **Replica Backups**: З read replica для зменшення навантаження

### Backup Commands
```bash
# Full backup
pg_dump -h localhost -U cryptocraft_user -d cryptocraft_prod \
  --format=custom --compress=9 --no-owner --no-privileges \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump

# Restore
pg_restore -h localhost -U cryptocraft_user -d cryptocraft_prod \
  --clean --if-exists --no-owner --no-privileges backup.dump
```

## Security Considerations

1. **Row Level Security**: Для multi-tenant даних
2. **Encrypted Columns**: Для чутливих даних
3. **Audit Logging**: Всі критичні операції
4. **Connection Security**: SSL/TLS обов'язкові
5. **User Permissions**: Принцип найменших привілеїв

### RLS Example
```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own data
CREATE POLICY users_own_data ON users
    FOR ALL
    TO app_user
    USING (id = current_setting('app.current_user_id')::uuid);
```