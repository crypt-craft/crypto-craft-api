# CryptoCraft API

> GraphQL/REST API platform for business tokenization, token management and airdrop operations on Solana blockchain with multi-blockchain support.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd crypto-craft-api
   npm install
   ```

2. **Environment configuration**
   ```bash
   cp .env.local .env
   # Edit .env with your configuration
   ```

3. **Start with Docker (Recommended)**
   ```bash
   make dev
   # or
   docker-compose up --build
   ```

4. **Manual start**
   ```bash
   npm run dev
   ```

### Access Points

- **API**: http://localhost:4000
- **GraphQL Playground**: http://localhost:4000/graphql
- **Health Check**: http://localhost:4000/health

## 📋 Available Commands

Use the Makefile for easy development:

```bash
# Development
make dev              # Start development environment
make logs             # View logs
make stop             # Stop all services

# Database
make db-setup         # Setup database
make db-migrate       # Run migrations
make db-seed          # Seed database

# Testing
make test             # Run all tests
make test-unit        # Run unit tests
make test-integration # Run integration tests

# Production
make deploy-staging   # Deploy to staging
make deploy-prod      # Deploy to production
```

## 🏗️ Architecture

### Core Components

- **BlockchainManager**: Manages multiple blockchain adapters
- **AdapterFactory**: Creates blockchain-specific adapters
- **SolanaAdapter**: Solana blockchain operations
- **TokenService**: Token creation and management
- **AirdropService**: Batch airdrop operations

### Supported Operations

#### Token Operations
- Create SPL tokens
- Create NFTs and collections
- Mint additional tokens
- Freeze/unfreeze tokens
- Token metadata management

#### Airdrop Operations
- Batch token distribution
- Scheduled airdrops
- Conditional airdrops
- Progress tracking
- Retry failed transactions

#### Analytics
- Token analytics
- Airdrop performance
- User statistics
- Transaction monitoring

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection | Required |
| `REDIS_URL` | Redis connection | Required |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `PINATA_JWT` | Pinata JWT (preferred) | - |
| `PINATA_API_KEY` | Pinata API key (legacy) | - |
| `PINATA_API_SECRET` | Pinata API secret (legacy) | - |

### Blockchain Configuration

```env
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=base64_encoded_key
BLOCKCHAIN_NETWORK=devnet
```

## 📊 API Examples

### GraphQL Queries

```graphql
# Health check
query {
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

### REST Endpoints

```bash
# API info
GET /api

# Blockchain status
GET /api/blockchain/status

# Health check
GET /health
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### IPFS/Pinata Integration

To enable IPFS pinning for token metadata and asset uploads, configure Pinata credentials.

Preferred: use a Pinata JWT (as per Pinata docs). Do not include the `Bearer ` prefix in the env variable — the server will add it.

```env
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Or legacy key/secret pair (not recommended):
# PINATA_API_KEY=pk_...
# PINATA_API_SECRET=sk_...
```

Diagnostics endpoint to verify credentials from inside the API container:

```http
GET /api/ipfs/test-auth
```

Expected success mirrors Pinata’s test endpoint response. See Pinata docs: [Pinata API Introduction](https://docs.pinata.cloud/api-reference/introduction)

Backend proxy endpoints:

```http
POST /api/ipfs/pin-json   # body: JSON -> pins via Pinata
POST /api/ipfs/pin-file   # body: { fileName, dataUrl } -> pins file via Pinata
```

Docker Compose (development) passes `PINATA_*` from your local environment into the container. For the monorepo stack, use `.env.stack.dev` and for API-only compose, use `.env.local`.

## 🐳 Docker Development

### Services
- **api**: Main API server
- **db**: PostgreSQL database
- **redis**: Redis cache/queue
- **nginx**: Reverse proxy (production)

### Commands
```bash
# Start all services
docker-compose up

# View logs
docker-compose logs -f api

# Execute commands in container
docker-compose exec api npm test
```

## 📖 Documentation

Detailed documentation is available in the `docs/` folder:

- [Project Details](docs/PROJECT_DETAILS.MD)
- [API Documentation](docs/api/)
- [Technical Documentation](docs/technical_docs/)

## 🔒 Security

- JWT authentication
- Rate limiting
- Input validation
- CORS protection
- Security headers

## 🚦 Monitoring

### Health Checks
- `/health` - Basic health status
- `/api/blockchain/status` - Blockchain connectivity

### Logging
- Winston structured logging
- Multiple log levels
- File and console outputs

## 🛠 Troubleshooting

- Pinata returns 401 Unauthorized
  - Ensure `.env` contains either `PINATA_JWT` (recommended) or the pair `PINATA_API_KEY`/`PINATA_API_SECRET`.
  - Do NOT include the `Bearer ` prefix in `PINATA_JWT` (the server adds it). Whitespace is trimmed automatically.
  - Use the diagnostics endpoint to verify credentials from the server:
    - GET `/api/ipfs/test-auth`
    - On failure, response includes `diagnostics` with which credential type was detected and masked previews.
  - Reference: https://docs.pinata.cloud/quickstart

## 🌍 Multi-Blockchain Support

Currently supported:
- ✅ **Solana** - Full support

Planned:
- 🔄 **Ethereum** - In development
- 🔄 **Polygon** - Planned
- 🔄 **BSC** - Planned

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- Create an issue for bugs
- Discussion for questions
- Email: support@cryptocraft.dev

---

**CryptoCraft API** - Making tokenization simple and accessible for everyone! 🚀