/**
 * GraphQL Schema Definition
 * Типи та схема для GraphQL API з безпечною Web3 взаємодією
 */

import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar Date
  scalar JSON

  type HealthStatus {
    status: String!
    timestamp: String!
    blockchains: [BlockchainStatus!]!
  }

  type BlockchainStatus {
    name: String!
    connected: Boolean!
    network: String
  }

  # Enum для типів токенів
  enum TokenType {
    FUNGIBLE
    NON_FUNGIBLE
    MEMECOIN
  }

  # Enum для статусу транзакцій
  enum TransactionStatus {
    PENDING
    CONFIRMED
    FAILED
  }

  # Enum для ролей користувачів
  enum UserRole {
    USER
    ADMIN
    MODERATOR
    DEVELOPER
  }

  # Базові типи користувача
  type User {
    id: ID!
    walletAddress: String!
    username: String
    email: String
    bio: String
    avatarUrl: String
    isVerified: Boolean!
    isActive: Boolean!
    lastLoginAt: Date
    role: UserRole!
    createdAt: Date!
    updatedAt: Date!
    
    # Зв'язки
    tokens: [Token!]!
    createdTokensCount: Int!
    participatedAirdrops: [AirdropRecipient!]!
  }

  # Токен
  type Token {
    id: ID!
    mintAddress: String!
    blockchain: String!
    name: String!
    symbol: String!
    decimals: Int!
    supply: String!
    tokenType: TokenType!
    metadata: JSON
    isVerified: Boolean!
    isFrozen: Boolean!
    createdAt: Date!
    updatedAt: Date!
    
    # Зв'язки
    creator: User!
    creatorId: String!
    airdrops: [AirdropCampaign!]!
    
    # Обчислювані поля
    totalHolders: Int
    currentPrice: Float
    marketCap: Float
    volume24h: Float
  }

  # Airdrop кампанія
  type AirdropCampaign {
    id: ID!
    name: String!
    description: String
    startDate: Date!
    endDate: Date!
    totalAmount: String!
    claimedAmount: String!
    maxRecipientsCount: Int!
    isActive: Boolean!
    createdAt: Date!
    updatedAt: Date!
    
    # Зв'язки
    token: Token!
    tokenId: String!
    creator: User!
    creatorId: String!
    recipients: [AirdropRecipient!]!
    
    # Обчислювані поля
    recipientsCount: Int!
    claimPercentage: Float!
    isExpired: Boolean!
    canClaim: Boolean!
  }

  # Отримувач airdrop
  type AirdropRecipient {
    id: ID!
    walletAddress: String!
    amount: String!
    isClaimed: Boolean!
    claimedAt: Date
    transactionHash: String
    createdAt: Date!
    
    # Зв'язки
    campaign: AirdropCampaign!
    campaignId: String!
    user: User
  }

  # Транзакція (для історії)
  type Transaction {
    id: ID!
    signature: String!
    blockchain: String!
    type: String!
    status: TransactionStatus!
    amount: String
    fee: String
    metadata: JSON
    error: String
    createdAt: Date!
    updatedAt: Date!
    
    # Зв'язки
    user: User!
    userId: String!
    token: Token
    tokenId: String
  }

  # Unsigned транзакція для клієнтського підписання
  type UnsignedTransaction {
    transaction: String!
    metadata: TransactionMetadata!
    signingInstructions: [String!]!
  }

  # Метадані транзакції
  type TransactionMetadata {
    mintAddress: String
    tokenAccountAddress: String
    metadataAddress: String
    estimatedFee: Int!
    instructions: [String!]!
    network: String!
  }

  # Результат відправки транзакції
  type TransactionResult {
    success: Boolean!
    signature: String
    explorerUrl: String
    error: String
  }

  # Статистика платформи
  type PlatformStats {
    totalUsers: Int!
    activeUsers: Int!
    totalTokens: Int!
    totalAirdrops: Int!
    totalTransactions: Int!
    totalVolume: String!
  }

  # Пагінація
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Пагіновані токени
  type TokenConnection {
    edges: [TokenEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TokenEdge {
    node: Token!
    cursor: String!
  }

  # Пагіновані користувачі
  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  # Пагіновані airdrop кампанії
  type AirdropConnection {
    edges: [AirdropEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AirdropEdge {
    node: AirdropCampaign!
    cursor: String!
  }

  # Input типи для мутацій
  input CreateTokenInput {
    name: String!
    symbol: String!
    decimals: Int!
    initialSupply: Float!
    description: String
    imageUrl: String
    externalUrl: String
    tokenType: TokenType = FUNGIBLE
  }

  input UpdateMetadataInput {
    mintAddress: String!
    name: String
    symbol: String
    uri: String!
  }

  input UpdateProfileInput {
    username: String
    email: String
    bio: String
    avatarUrl: String
  }

  input CreateAirdropInput {
    tokenId: String!
    name: String!
    description: String
    startDate: Date!
    endDate: Date!
    totalAmount: String!
    maxRecipientsCount: Int!
    recipients: [AirdropRecipientInput!]!
  }

  input AirdropRecipientInput {
    walletAddress: String!
    amount: String!
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input TokenFilterInput {
    tokenType: TokenType
    verified: Boolean
    creatorId: String
    search: String
  }

  # Queries
  type Query {
    hello: String
    healthCheck: HealthStatus
    # Поточний користувач
    me: User
    
    # Користувачі
    user(id: ID!): User
    users(pagination: PaginationInput, search: String): UserConnection!
    
    # Токени
    token(id: ID): Token
    tokenByMint(mintAddress: String!): Token
    tokens(
      pagination: PaginationInput
      filter: TokenFilterInput
      sortBy: String = "createdAt"
      sortOrder: String = "DESC"
    ): TokenConnection!
    
    # Popular/trending токени
    trendingTokens(limit: Int = 10): [Token!]!
    recentTokens(limit: Int = 10): [Token!]!
    
    # Airdrops
    airdrop(id: ID!): AirdropCampaign
    airdrops(
      pagination: PaginationInput
      active: Boolean
      tokenId: String
    ): AirdropConnection!
    
    # Мої дані
    myTokens(pagination: PaginationInput): TokenConnection!
    myAirdrops(pagination: PaginationInput): AirdropConnection!
    myTransactions(pagination: PaginationInput): [Transaction!]!
    
    # Статистика
    platformStats: PlatformStats!
    tokenStats(tokenId: ID!): JSON
    
    # Мережа
    networkInfo: JSON!
    validateAddress(address: String!): Boolean!
  }

  # Mutations
  type Mutation {
    # Створення unsigned транзакції для токену (БЕЗПЕЧНО)
    createTokenTransaction(input: CreateTokenInput!): UnsignedTransaction!
    # Оновлення метаданих токену (unsigned tx для підпису у гаманці)
    createUpdateMetadataTransaction(input: UpdateMetadataInput!): UnsignedTransaction!
    
    # Відправка підписаної транзакції
    submitSignedTransaction(signedTransaction: String!, metadata: JSON): TransactionResult!
    
    # Збереження метаданих токену після створення
    saveTokenMetadata(
      mintAddress: String!
      transactionSignature: String!
      tokenData: CreateTokenInput!
    ): Token!
    
    # Профіль користувача
    updateProfile(input: UpdateProfileInput!): User!
    
    # Airdrop операції
    createAirdrop(input: CreateAirdropInput!): AirdropCampaign!
    claimAirdrop(campaignId: ID!): TransactionResult!
    
    # Адмін операції
    verifyToken(tokenId: ID!): Token!
    freezeToken(tokenId: ID!): Token!
    deactivateUser(userId: ID!): User!
  }

  # Subscriptions для real-time оновлень
  type Subscription {
    # Нові токени
    tokenCreated: Token!
    
    # Оновлення транзакцій
    transactionUpdated(userId: ID!): Transaction!
    
    # Airdrop оновлення
    airdropUpdate(campaignId: ID!): AirdropCampaign!
    
    # Платформні статистики
    statsUpdated: PlatformStats!
  }
`;