# GraphQL Schema Documentation

## Overview

CryptoCraft API використовує GraphQL як основний інтерфейс для взаємодії з клієнтськими додатками. API підтримує операції для створення токенів, управління airdrop кампаніями, аналітики та інтеграції з Solana Pay.

## Base Types

### Scalar Types
```graphql
scalar DateTime
scalar BigInt
scalar Address  # Solana wallet address
scalar Hash     # Transaction hash
```

### Enums
```graphql
enum TokenType {
  FUNGIBLE
  NON_FUNGIBLE
  MEMECOIN
}

enum TransactionStatus {
  PENDING
  CONFIRMED
  FAILED
  CANCELLED
}

enum AirdropStatus {
  DRAFT
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum NetworkType {
  DEVNET
  TESTNET
  MAINNET
}
```

## Core Types

### User & Authentication
```graphql
type User {
  id: ID!
  walletAddress: Address!
  email: String
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  tokens: [Token!]!
  airdropCampaigns: [AirdropCampaign!]!
  transactions: [Transaction!]!
}

type AuthPayload {
  token: String!
  user: User!
  expiresAt: DateTime!
}
```

### Token Management
```graphql
type Token {
  id: ID!
  mintAddress: Address!
  creator: User!
  name: String!
  symbol: String!
  description: String
  imageUrl: String
  tokenType: TokenType!
  totalSupply: BigInt!
  decimals: Int!
  metadata: TokenMetadata
  createdAt: DateTime!
  
  # Statistics
  holdersCount: Int!
  transfersCount: Int!
  marketCap: Float
  price: Float
}

type TokenMetadata {
  website: String
  twitter: String
  telegram: String
  discord: String
  attributes: [TokenAttribute!]
}

type TokenAttribute {
  trait_type: String!
  value: String!
}

type NFTCollection {
  id: ID!
  collectionAddress: Address!
  creator: User!
  name: String!
  description: String
  imageUrl: String
  totalSupply: Int!
  mintedCount: Int!
  
  # NFTs in collection
  nfts: [NFT!]!
  createdAt: DateTime!
}

type NFT {
  id: ID!
  mintAddress: Address!
  collection: NFTCollection
  owner: Address!
  name: String!
  description: String
  imageUrl: String!
  attributes: [TokenAttribute!]
  metadata: String
  createdAt: DateTime!
}
```

### Airdrop Management
```graphql
type AirdropCampaign {
  id: ID!
  creator: User!
  token: Token!
  name: String!
  description: String
  totalAmount: BigInt!
  recipientsCount: Int!
  status: AirdropStatus!
  scheduledAt: DateTime
  startedAt: DateTime
  completedAt: DateTime
  createdAt: DateTime!
  
  # Recipients
  recipients: [AirdropRecipient!]!
  
  # Statistics
  distributedAmount: BigInt!
  successfulTransfers: Int!
  failedTransfers: Int!
}

type AirdropRecipient {
  id: ID!
  campaign: AirdropCampaign!
  address: Address!
  amount: BigInt!
  status: TransactionStatus!
  transactionHash: Hash
  processedAt: DateTime
  errorMessage: String
}
```

### Transactions & Analytics
```graphql
type Transaction {
  id: ID!
  hash: Hash!
  user: User
  type: TransactionType!
  status: TransactionStatus!
  amount: BigInt
  fromAddress: Address
  toAddress: Address
  token: Token
  blockHeight: BigInt
  fee: BigInt
  createdAt: DateTime!
  confirmedAt: DateTime
}

enum TransactionType {
  TOKEN_CREATE
  TOKEN_TRANSFER
  AIRDROP_DISTRIBUTE
  LIQUIDITY_ADD
  LIQUIDITY_REMOVE
  PAYMENT
}

type Analytics {
  period: TimePeriod!
  tokensCreated: Int!
  transactionsCount: Int!
  totalVolume: BigInt!
  activeUsers: Int!
  newUsers: Int!
  airdropCampaigns: Int!
  successRate: Float!
}

enum TimePeriod {
  HOUR
  DAY
  WEEK
  MONTH
  YEAR
}
```

### Liquidity & DEX
```graphql
type LiquidityPool {
  id: ID!
  address: Address!
  creator: User!
  tokenA: Token!
  tokenB: Token!
  reserveA: BigInt!
  reserveB: BigInt!
  lpTokenSupply: BigInt!
  fee: Float!
  createdAt: DateTime!
  
  # Statistics
  volume24h: BigInt!
  tvl: Float!
}

type SolanaPayTransaction {
  id: ID!
  reference: String!
  amount: BigInt!
  token: Token
  merchant: User!
  customer: Address
  status: TransactionStatus!
  memo: String
  createdAt: DateTime!
  paidAt: DateTime
}
```

## Queries

```graphql
type Query {
  # User queries
  me: User
  user(address: Address!): User
  
  # Token queries
  token(mintAddress: Address!): Token
  tokens(
    filters: TokenFilters
    orderBy: TokenOrderBy
    skip: Int
    take: Int
  ): [Token!]!
  
  tokensByOwner(address: Address!): [Token!]!
  
  # NFT queries
  nftCollection(address: Address!): NFTCollection
  nftCollections(
    filters: NFTCollectionFilters
    skip: Int
    take: Int
  ): [NFTCollection!]!
  
  nft(mintAddress: Address!): NFT
  nftsByOwner(address: Address!): [NFT!]!
  
  # Airdrop queries
  airdropCampaign(id: ID!): AirdropCampaign
  airdropCampaigns(
    filters: AirdropFilters
    orderBy: AirdropOrderBy
    skip: Int
    take: Int
  ): [AirdropCampaign!]!
  
  # Transaction queries
  transaction(hash: Hash!): Transaction
  transactions(
    filters: TransactionFilters
    orderBy: TransactionOrderBy
    skip: Int
    take: Int
  ): [Transaction!]!
  
  # Analytics queries
  analytics(period: TimePeriod!): Analytics!
  userAnalytics(address: Address!, period: TimePeriod!): UserAnalytics!
  
  # Liquidity queries
  liquidityPool(address: Address!): LiquidityPool
  liquidityPools(
    tokenA: Address
    tokenB: Address
    skip: Int
    take: Int
  ): [LiquidityPool!]!
  
  # Solana Pay queries
  solanaPayTransaction(reference: String!): SolanaPayTransaction
}
```

## Mutations

```graphql
type Mutation {
  # Authentication
  authenticate(
    walletAddress: Address!
    signature: String!
    message: String!
  ): AuthPayload!
  
  refreshToken(token: String!): AuthPayload!
  
  # Token operations
  createToken(input: CreateTokenInput!): Token!
  createNFTCollection(input: CreateNFTCollectionInput!): NFTCollection!
  mintNFT(input: MintNFTInput!): NFT!
  
  # Airdrop operations
  createAirdropCampaign(input: CreateAirdropInput!): AirdropCampaign!
  scheduleAirdrop(campaignId: ID!, scheduledAt: DateTime!): AirdropCampaign!
  startAirdrop(campaignId: ID!): AirdropCampaign!
  cancelAirdrop(campaignId: ID!): AirdropCampaign!
  
  # Batch operations
  batchCreateTokens(inputs: [CreateTokenInput!]!): [Token!]!
  batchAirdrop(input: BatchAirdropInput!): AirdropCampaign!
  
  # Liquidity operations
  createLiquidityPool(input: CreateLiquidityPoolInput!): LiquidityPool!
  addLiquidity(input: AddLiquidityInput!): Transaction!
  removeLiquidity(input: RemoveLiquidityInput!): Transaction!
  
  # Solana Pay operations
  createPaymentRequest(input: CreatePaymentInput!): SolanaPayTransaction!
  processPayment(reference: String!): SolanaPayTransaction!
}
```

## Input Types

### Token Creation
```graphql
input CreateTokenInput {
  name: String!
  symbol: String!
  description: String
  imageUrl: String
  tokenType: TokenType!
  totalSupply: BigInt!
  decimals: Int = 9
  metadata: TokenMetadataInput
  network: NetworkType = DEVNET
}

input TokenMetadataInput {
  website: String
  twitter: String
  telegram: String
  discord: String
  attributes: [TokenAttributeInput!]
}

input TokenAttributeInput {
  trait_type: String!
  value: String!
}

input CreateNFTCollectionInput {
  name: String!
  description: String
  imageUrl: String
  totalSupply: Int!
  metadata: TokenMetadataInput
}

input MintNFTInput {
  collectionId: ID!
  recipientAddress: Address!
  name: String!
  description: String
  imageUrl: String!
  attributes: [TokenAttributeInput!]
}
```

### Airdrop Creation
```graphql
input CreateAirdropInput {
  tokenId: ID!
  name: String!
  description: String
  recipients: [AirdropRecipientInput!]!
  scheduledAt: DateTime
}

input AirdropRecipientInput {
  address: Address!
  amount: BigInt!
}

input BatchAirdropInput {
  tokenId: ID!
  name: String!
  totalAmount: BigInt!
  recipientAddresses: [Address!]!
  equalDistribution: Boolean = true
  customAmounts: [BigInt!] # Only if equalDistribution = false
}
```

### Filter Types
```graphql
input TokenFilters {
  tokenType: TokenType
  creatorAddress: Address
  minSupply: BigInt
  maxSupply: BigInt
  search: String
}

input AirdropFilters {
  status: AirdropStatus
  creatorAddress: Address
  tokenId: ID
  minAmount: BigInt
  maxAmount: BigInt
}

input TransactionFilters {
  type: TransactionType
  status: TransactionStatus
  userAddress: Address
  tokenId: ID
  fromDate: DateTime
  toDate: DateTime
}
```

### Order Types
```graphql
enum TokenOrderBy {
  CREATED_AT_ASC
  CREATED_AT_DESC
  NAME_ASC
  NAME_DESC
  SUPPLY_ASC
  SUPPLY_DESC
}

enum AirdropOrderBy {
  CREATED_AT_ASC
  CREATED_AT_DESC
  AMOUNT_ASC
  AMOUNT_DESC
  STATUS_ASC
  STATUS_DESC
}

enum TransactionOrderBy {
  CREATED_AT_ASC
  CREATED_AT_DESC
  AMOUNT_ASC
  AMOUNT_DESC
}
```

## Subscriptions

```graphql
type Subscription {
  # Real-time transaction updates
  transactionUpdated(hash: Hash!): Transaction!
  
  # Airdrop progress updates
  airdropProgress(campaignId: ID!): AirdropProgress!
  
  # Token price updates
  tokenPriceUpdated(mintAddress: Address!): TokenPriceUpdate!
  
  # User notifications
  userNotifications: Notification!
}

type AirdropProgress {
  campaignId: ID!
  totalRecipients: Int!
  processed: Int!
  successful: Int!
  failed: Int!
  percentage: Float!
  estimatedCompletion: DateTime
}

type TokenPriceUpdate {
  mintAddress: Address!
  price: Float!
  change24h: Float!
  volume24h: BigInt!
  timestamp: DateTime!
}

type Notification {
  id: ID!
  type: NotificationType!
  title: String!
  message: String!
  data: String # JSON string
  createdAt: DateTime!
}

enum NotificationType {
  TOKEN_CREATED
  AIRDROP_COMPLETED
  TRANSACTION_CONFIRMED
  PAYMENT_RECEIVED
}
```

## Error Handling

GraphQL операції можуть повертати наступні типи помилок:

### Standard Errors
- `AUTHENTICATION_REQUIRED` - Потрібна аутентифікація
- `INSUFFICIENT_PERMISSIONS` - Недостатньо дозволів
- `VALIDATION_ERROR` - Помилки валідації вхідних даних
- `RATE_LIMIT_EXCEEDED` - Перевищено ліміт запитів

### Blockchain Errors
- `INSUFFICIENT_BALANCE` - Недостатньо коштів
- `TRANSACTION_FAILED` - Транзакція не вдалася
- `NETWORK_ERROR` - Помилка мережі
- `INVALID_ADDRESS` - Неправильна адреса

### Business Logic Errors
- `TOKEN_ALREADY_EXISTS` - Токен вже існує
- `AIRDROP_IN_PROGRESS` - Airdrop вже виконується
- `CAMPAIGN_NOT_FOUND` - Кампанія не знайдена

## Rate Limiting

GraphQL запити мають наступні обмеження:

- **Query Complexity**: максимум 1000 points
- **Query Depth**: максимум 10 рівнів
- **Rate Limits**: залежать від middleware конфігурації
- **Batch Operations**: максимум 100 операцій за один запит

## Authentication

Всі мутації вимагають аутентифікації через JWT токен в заголовку:
```
Authorization: Bearer <jwt_token>
```

Токен отримується через `authenticate` мутацію з підписом wallet'а.