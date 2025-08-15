# 🎮 GraphQL Playground Examples

**Для розробників:** Набір готових запитів для тестування GraphQL API  
**Аналог Swagger:** Pre-filled queries для швидкого тестування

---

## 🔧 Налаштування Playground

### 1. Доступ до GraphQL Endpoint
```
URL: http://localhost:4000/graphql
Headers: {
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_JWT_TOKEN" // для захищених запитів
}
```

### 2. Включення Introspection / Playground (dev)
У дев-режимі ввімкнено інспекцію схеми та GraphQL Playground.
```ts
// src/app.ts — вже налаштовано
new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
  plugins: process.env.NODE_ENV !== 'production' ? [ApolloServerPluginLandingPageGraphQLPlayground(...)] : []
})
```

---

## 📋 Базові запити (Working)

### 1. Hello World
```graphql
query HelloWorld {
  hello
}
```

**Очікуваний результат:**
```json
{
  "data": {
    "hello": "Hello from CryptoCraft API!"
  }
}
```

### 2. Health Check
```graphql
query HealthCheck {
  healthCheck {
    status
    timestamp
    blockchains {
      name
      connected
      network
    }
  }
}
```

**Очікуваний результат:**
```json
{
  "data": {
    "healthCheck": {
      "status": "healthy",
      "timestamp": "2025-01-08T14:46:33.620Z",
      "blockchains": [
        {
          "name": "solana",
          "connected": true,
          "network": "devnet"
        }
      ]
    }
  }
}
```

---

## 🔐 Користувацькі запити (Working)

### 3. Current User Info
```graphql
query MyProfile {
  me {
    id
    walletAddress
    username
    email
    isVerified
    tokens {
      id
      name
      symbol
      mintAddress
    }
  }
}
```

**Headers потрібні:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4. My Tokens
```graphql
query MyTokens($first: Int = 10) {
  myTokens(pagination: { first: $first }) {
    edges {
      node {
        id
        name
        symbol
        mintAddress
        supply
        decimals
        tokenType
        isVerified
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

**Variables:**
```json
{
  "first": 10
}
```

---

## 💰 Token Management (Working)

### 5. Create Token Transaction
```graphql
mutation CreateToken($input: CreateTokenInput!) {
  createTokenTransaction(input: $input) {
    transaction
    metadata {
      mintAddress
      estimatedFee
      instructions
    }
    signingInstructions
  }
}
```

**Variables:**
```json
{
  "input": {
    "name": "My Awesome Token",
    "symbol": "MAT",
    "decimals": 9,
    "initialSupply": 1000000,
    "description": "A token created for testing",
    "image": "https://example.com/token-image.png"
  }
}
```

### 6. Token by Mint
```graphql
query TokenDetails($mintAddress: String!) {
  tokenByMint(mintAddress: $mintAddress) {
    id
    name
    symbol
    supply
    creator {
      walletAddress
      username
    }
    metadata
    transactions {
      id
      type
      status
      createdAt
    }
  }
}
```

**Variables:**
```json
{
  "mintAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
}
```

---

## 🎁 Airdrop Queries

Наразі GraphQL-ендпоінти для airdrop частково в роботі. Для claim у REST доступні:
- GET `/api/airdrops/available`
- POST `/api/airdrops/claim/:campaignId`

### 8. Available Airdrops
```graphql
query AvailableAirdrops {
  availableAirdrops {
    id
    name
    description
    token {
      name
      symbol
      mintAddress
    }
    amountPerUser
    expiresAt
  }
}
```

Створення кампанії доступне через REST: `POST /api/airdrops/campaigns` (з JWT).

---

## 📊 Analytics & Statistics (Partial)

### 10. Platform Statistics
```graphql
query PlatformStats {
  platformStats {
    totalUsers
    totalTokens
    totalTransactions
    totalAirdrops
    activeAirdrops
    volume24h
    topTokens {
      name
      symbol
      supply
      transactionCount
    }
  }
}
```

User statistics — в плані. Наразі доступні базові лічильники через `platformStats`.

---

## 🔍 Search & Discovery (Future)

### 12. Search Tokens (Future)
```graphql
query SearchTokens($query: String!, $filters: TokenFilterInput) {
  searchTokens(query: $query, filters: $filters) {
    edges {
      node {
        id
        name
        symbol
        mintAddress
        isVerified
        creator {
          username
        }
      }
    }
    totalCount
  }
}
```

**Variables:**
```json
{
  "query": "awesome",
  "filters": {
    "tokenType": "FUNGIBLE",
    "isVerified": true
  }
}
```

### 13. Trending Tokens (Working: simple)
```graphql
query TrendingTokens($timeframe: Timeframe = WEEK) {
  trendingTokens(timeframe: $timeframe) {
    id
    name
    symbol
    volume24h
    priceChange24h
    transactionCount
    holderCount
  }
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: New User Onboarding
```graphql
# 1. Check health
query { healthCheck { status } }

# 2. Get profile (should fail without auth)
query { me { id } }

# 3. After authentication - get profile  
query { me { walletAddress tokens { name } } }
```

### Scenario 2: Token Creation Flow
```graphql
# 1. Create unsigned transaction
mutation {
  createTokenTransaction(input: {
    name: "Test Token"
    symbol: "TEST"
    decimals: 9
    initialSupply: 1000000
  }) {
    transaction
    metadata { mintAddress }
  }
}

# 2. Check my tokens after creation
query {
  myTokens(pagination: { first: 5 }) {
    edges { node { name symbol } }
  }
}
```

### Scenario 3: Airdrop Management
```graphql
# 1. Create campaign
mutation {
  createAirdropCampaign(input: {
    name: "Test Campaign"
    tokenId: "TOKEN_ID"
    totalAmount: 1000
    recipients: [...]
  }) {
    id
    status
  }
}

# 2. Check campaign status
query {
  myAirdropCampaigns {
    name
    status
    recipientsCount
  }
}
```

---

## 🛠️ Development Tools

### GraphQL Playground Access
```bash
# Open browser to:
http://localhost:4000/graphql

# Or use curl:
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { hello }"}'
```

### Verify Pinata Credentials via API
```
GET /api/ipfs/test-auth
```
Expected success mirrors Pinata test endpoint response. See: [Pinata API Introduction](https://docs.pinata.cloud/api-reference/introduction)

### Schema Documentation
```graphql
# Get full schema
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    types {
      name
      kind
      description
    }
  }
}
```

### Auto-completion Setup
1. Install GraphQL extension in VS Code
2. Configure `.graphqlrc.yml`:
```yaml
schema: "http://localhost:4000/graphql"
documents: "**/*.graphql"
```

---

## 📝 Implementation Status

### ✅ Working Queries:
- `hello` - Basic test query
- `healthCheck` - System status

### ❌ Need Implementation:
- `me` - Current user profile
- `myTokens` - User's tokens
- `tokenByMintAddress` - Token details
- `myAirdropCampaigns` - User's campaigns
- `availableAirdrops` - Claimable airdrops
- `platformStats` - Platform statistics
- `searchTokens` - Token search
- `trendingTokens` - Popular tokens

### ❌ Need Implementation (Mutations):
- `createTokenTransaction` - Token creation
- `createAirdropCampaign` - Airdrop creation
- `claimAirdrop` - Claim tokens
- `updateProfile` - User profile update

---

## 🎯 Next Steps

1. **Implement Missing Resolvers** - Start with `me` and `myTokens`
2. **Add Authentication Context** - JWT token handling
3. **Connect Prisma Queries** - Database integration
4. **Add Error Handling** - Proper GraphQL errors
5. **Add Pagination** - For large datasets
6. **Add Subscriptions** - Real-time updates

**Priority:** Authentication context → Basic user queries → Token management → Airdrop system

---

*GraphQL Playground надає powerful interface для testing API - аналогічний до Swagger в Django REST Framework*