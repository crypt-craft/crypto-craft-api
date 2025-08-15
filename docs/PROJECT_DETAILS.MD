# CryptoCraft API - Проектна документація

## Огляд проекту

**CryptoCraft API** - це потужна GraphQL/REST API платформа для спрощення токенізації бізнес-процесів, управління токенами та проведення airdrop операцій на блокчейні Solana з подальшою підтримкою мультиблокчейн архітектури.

### Цільова аудиторія
- Ентузіасти криптовалют
- Інвестори та трейдери
- Створювачі мемкоїнів
- Нові користувачі криптосфери
- Бізнес-сегмент для токенізації процесів

### Ключові проблеми, які вирішуємо
- Спрощення процесу токенізації бізнес-процесів
- Автоматизована видача токенів як нагороди користувачам
- Ефективне управління airdrop кампаніями
- Зручний менеджмент токенів та NFT

## Архітектура системи

Архітектура побудована на принципах мікросервісної архітектури з підтримкою мультиблокчейн інтеграції через Adapter Pattern + Plugin System.
```
cryptocraft-api/
├── /src                           # Основний код API
│   ├── /core                      # Ядро системи
│   │   ├── /interfaces            # Інтерфейси та типи
│   │   │   ├── BlockchainAdapter.ts
│   │   │   ├── ITokenService.ts
│   │   │   └── IAirdropService.ts
│   │   ├── BlockchainManager.ts   # Менеджер блокчейнів
│   │   └── AdapterFactory.ts      # Фабрика адаптерів
│   ├── /adapters                  # Адаптери для блокчейнів
│   │   ├── /solana
│   │   │   ├── SolanaAdapter.ts
│   │   │   ├── SolanaTokenService.ts
│   │   │   └── SolanaAirdropService.ts
│   │   ├── /ethereum              # Майбутня підтримка
│   │   │   └── EthereumAdapter.ts
│   │   └── index.ts
│   ├── /api                       # GraphQL/REST API
│   │   ├── /graphql
│   │   │   ├── /resolvers
│   │   │   │   ├── tokenResolvers.ts
│   │   │   │   ├── airdropResolvers.ts
│   │   │   │   └── analyticsResolvers.ts
│   │   │   ├── /schemas
│   │   │   │   ├── token.graphql
│   │   │   │   ├── airdrop.graphql
│   │   │   │   └── analytics.graphql
│   │   │   └── index.ts
│   │   ├── /rest                  # REST ендпоінти
│   │   │   ├── tokenRoutes.ts
│   │   │   ├── airdropRoutes.ts
│   │   │   └── healthRoutes.ts
│   │   └── /middleware
│   │       ├── auth.ts
│   │       ├── rateLimiter.ts
│   │       └── validation.ts
│   ├── /services                  # Бізнес-логіка
│   │   ├── TokenService.ts
│   │   ├── AirdropService.ts
│   │   ├── LiquidityService.ts
│   │   ├── PaymentService.ts      # Solana Pay інтеграція
│   │   └── AnalyticsService.ts
│   ├── /models                    # Моделі даних
│   │   ├── Token.ts
│   │   ├── Transaction.ts
│   │   ├── User.ts
│   │   └── AirdropCampaign.ts
│   ├── /database                  # База даних
│   │   ├── /migrations
│   │   ├── /seeds
│   │   └── connection.ts
│   ├── /queue                     # Celery/Bull для відкладених задач
│   │   ├── tokenQueue.ts
│   │   ├── airdropQueue.ts
│   │   └── workers.ts
│   ├── /utils
│   │   ├── logger.ts
│   │   ├── encryption.ts
│   │   └── validation.ts
│   └── app.ts                     # Головний файл
├── /config                        # Конфігурації середовищ
│   ├── local.env
│   ├── staging.env
│   ├── production.env
│   └── config.ts
├── /tests                         # Тестування
│   ├── /unit
│   ├── /integration
│   ├── /e2e
│   └── jest.config.js
├── /docker                        # Docker конфігурації
│   ├── Dockerfile.local
│   ├── Dockerfile.production
│   └── docker-compose.yml
├── /nginx                         # Nginx конфігурація
│   ├── nginx.local.conf
│   ├── nginx.production.conf
│   └── Dockerfile
├── /.github/workflows             # CI/CD
│   ├── test.yml
│   ├── deploy-staging.yml
│   └── deploy-production.yml
├── Makefile                       # Команди управління
├── package.json
├── tsconfig.json
└── /docs                          # Документація
    ├── PROJECT_DETAILS.MD
    ├── /api
    │   ├── graphql-schema.md
    │   └── rest-endpoints.md
    ├── /technical_docs
    │   ├── database-schema.md
    │   ├── blockchain-integration.md
    │   └── deployment.md
    └── /cursor_docs
```

## Технологічний стек

### Backend
- **Мова програмування**: TypeScript/Node.js
- **API**: GraphQL (основний) + REST (допоміжний)
- **Блокчейн SDK**: Solana Web3.js + @solana/spl-token
- **База даних**: PostgreSQL
- **ORM**: Prisma або TypeORM
- **Черги задач**: Bull (Redis-based) для відкладених операцій
- **Валідація**: Joi або Yup
- **Логування**: Winston + Morgan

### DevOps & Infrastructure
- **Контейнеризація**: Docker + Docker Compose
- **Реверс-проксі**: Nginx
- **CI/CD**: GitHub Actions
- **Середовища**: Local, Staging, Production
- **Моніторинг**: Prometheus + Grafana (майбутнє)

### Blockchain Support
- **Поточний**: Solana (SPL tokens, NFTs, Fungible/Non-fungible)
- **Майбутній**: Ethereum, Polygon (через Adapter Pattern)

## Детальний опис компонентів

### 1. Core System - Blockchain Adapters

**Призначення**: Уніфікований інтерфейс для взаємодії з різними блокчейнами через Adapter Pattern + Plugin System.

**Архітектура**:
```typescript
interface BlockchainAdapter {
  connect(): Promise<void>;
  createToken(params: CreateTokenParams): Promise<string>;
  createNFT(params: CreateNFTParams): Promise<string>;
  distributeAirdrop(params: AirdropParams): Promise<string[]>;
  createLiquidityPool(params: PoolParams): Promise<string>;
  getBalance(address: string): Promise<string>;
  getTransactionStatus(txHash: string): Promise<TransactionStatus>;
}
```

**Функції**:
- **SolanaAdapter**: Взаємодія з Solana blockchain
- **BlockchainManager**: Керування адаптерами
- **AdapterFactory**: Створення адаптерів для різних блокчейнів

### 2. GraphQL API Layer

**Призначення**: Основний API для клієнтських додатків з гнучкими запитами.

**Схеми**:
- **Token Operations**: створення, управління, метадані
- **Airdrop Management**: планування, виконання, аналітика
- **Analytics**: метрики, звіти, статистика
- **Payment Integration**: Solana Pay, бізнес-платежі

**Ключові Resolvers**:
```graphql
type Mutation {
  createToken(input: CreateTokenInput!): Token!
  createNFTCollection(input: NFTCollectionInput!): NFTCollection!
  initiateBatchAirdrop(input: BatchAirdropInput!): AirdropCampaign!
  createLiquidityPool(input: LiquidityPoolInput!): LiquidityPool!
}

type Query {
  getTokensByOwner(address: String!): [Token!]!
  getAirdropCampaigns(filters: CampaignFilters): [AirdropCampaign!]!
  getAnalytics(period: TimePeriod!): Analytics!
}
```

### 3. Services Layer

**TokenService**:
- Створення SPL tokens, NFTs, мемкоїнів
- Управління метаданими токенів
- Multi-signature операції для бізнесу

**AirdropService**:
- Batch операції для великих airdrop
- Планувальник відкладених airdrop
- Валідація адрес отримувачів
- Аналітика розподілу

**PaymentService** (Solana Pay):
- Прийом платежів у власних токенах бізнесу
- Інвестиційні операції у токени
- Фондовий принцип для крипто-інвестицій

**LiquidityService**:
- Інтеграція з Raydium, Orca DEX
- Створення та управління пулами ліквідності
- Фарминг та стейкинг операції

### 4. Database Schema (PostgreSQL)

**Основні таблиці**:
```sql
-- Користувачі та аутентифікація
users (id, wallet_address, email, created_at, updated_at)
user_sessions (id, user_id, token, expires_at)

-- Токени та NFT
tokens (id, mint_address, creator_id, name, symbol, supply, metadata)
nft_collections (id, collection_address, creator_id, name, description)
nfts (id, mint_address, collection_id, owner_address, metadata)

-- Транзакції та операції
transactions (id, tx_hash, type, status, amount, from_address, to_address)
airdrop_campaigns (id, creator_id, token_id, total_amount, recipients_count)
airdrop_recipients (id, campaign_id, address, amount, status)

-- Аналітика
analytics_daily (date, tokens_created, transactions_count, volume)
analytics_users (date, active_users, new_users)
```

### 5. Queue System

**Bull Queue Jobs**:
- **TokenCreationJob**: Асинхронне створення токенів
- **BatchAirdropJob**: Обробка великих airdrop по частинах
- **AnalyticsJob**: Щоденне агрегування метрик
- **NotificationJob**: Повідомлення користувачів

### 6. Security & Rate Limiting

**Методи захисту**:
- JWT токени для аутентифікації
- Rate limiting по IP та користувачу
- Валідація всіх вхідних даних
- CORS політики
- Webhook підписи для callback'ів

**Rate Limits**:
- **Local/Testing**: 100 req/min per IP
- **Production**: 1000 req/min per authenticated user
- **Business API**: Custom limits based on subscription




## Технічний план розробки

### MVP Фаза (2-3 місяці)

**Тиждень 1-2: Основа проекту**
- Налаштування TypeScript проекту з базовою структурою
- Конфігурація Docker, docker-compose, Makefile
- Налаштування PostgreSQL з базовою схемою
- CI/CD pipeline з GitHub Actions

**Тиждень 3-4: Core система**
- Реалізація BlockchainAdapter інтерфейсу
- SolanaAdapter з базовими операціями
- BlockchainManager та AdapterFactory
- Unit тести для core компонентів

**Тиждень 5-6: Token операції**
- TokenService з створенням SPL tokens
- GraphQL схема для токенів
- REST ендпоінти для базових операцій
- Інтеграційні тести

**Тиждень 7-8: Airdrop функціональність**
- AirdropService з batch операціями
- Queue система (Bull + Redis)
- GraphQL мутації для airdrop
- E2E тести

**Тиждень 9-10: MVP завершення**
- Базова аналітика та метрики
- Rate limiting та безпека
- Документація API
- Деплой на staging

**Тиждень 11-12: Тестування та оптимізація**
- Навантажувальне тестування (1000 користувачів)
- Виправлення багів та оптимізація
- Production деплой

### Бета Фаза (1-2 місяці) - 10,000 користувачів

**Розширення функціональності**:
- NFT підтримка (створення колекцій)
- Multi-signature операції
- Solana Pay інтеграція
- Покращена аналітика

**Масштабування**:
- Горизонтальне масштабування API
- Оптимізація черг задач
- Кешування з Redis
- Моніторинг з Prometheus

### Альфа Фаза (2-3 місяці) - 1,000,000 користувачів

**Мультиблокчейн підтримка**:
- Ethereum адаптер
- Polygon інтеграція
- Уніфікований роутинг запитів

**Enterprise функції**:
- Бізнес dashboard
- Платіжна система
- Інвестиційні інструменти
- API ключі система

## Архітектура масштабування

### Горизонтальне масштабування
```yaml
# docker-compose.production.yml
services:
  api:
    replicas: 3
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
  
  database:
    image: postgres:15
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
  
  redis:
    image: redis:7-alpine
    deploy:
      replicas: 1
```

### Load Balancing Strategy
- **Nginx** як reverse proxy
- **Round-robin** для API instances
- **Sticky sessions** для WebSocket connections
- **Health checks** для auto-failover

## Середовища розробки

### Local Development
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/cryptocraft_dev
SOLANA_RPC_URL=https://api.devnet.solana.com
REDIS_URL=redis://localhost:6379
RATE_LIMIT_RPM=100
```

### Staging Environment
```env
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@staging-db:5432/cryptocraft_staging
SOLANA_RPC_URL=https://api.devnet.solana.com
REDIS_URL=redis://staging-redis:6379
RATE_LIMIT_RPM=500
```

### Production Environment
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/cryptocraft_prod
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
REDIS_URL=redis://prod-redis:6379
RATE_LIMIT_RPM=1000
```

## Тестування

### Структура тестів
```
/tests
├── /unit                    # Модульні тести (70% покриття)
│   ├── services/
│   ├── adapters/
│   └── utils/
├── /integration             # Інтеграційні тести (20% покриття)
│   ├── api/
│   ├── database/
│   └── blockchain/
└── /e2e                     # End-to-end тести (10% покриття)
    ├── token-creation.test.ts
    ├── airdrop-flow.test.ts
    └── user-journey.test.ts
```

### Тестові сценарії
- **Token Creation Flow**: повний цикл створення токену
- **Batch Airdrop**: розподіл 10,000 токенів на 1,000 адрес
- **Multi-signature Operations**: бізнес операції з підписами
- **Load Testing**: 1000 concurrent users

## Критерії успіху

### Технічні метрики
- **Час відгуку API**: < 200ms для 95% запитів
- **Пропускна здатність**: 1000+ TPS на production
- **Доступність**: 99.9% uptime
- **Покриття тестами**: 90%+ код покриття

### Бізнес метрики
- **Створені токени**: > 10,000 на місяць (бета)
- **Airdrop операції**: > 100,000 транзакцій на місяць
- **Активні користувачі**: > 1,000 DAU (бета)
- **API викликів**: > 1M запитів на день

### Безпека та стабільність
- **Zero критичних вразливостей**
- **Успішна обробка 99.95% транзакцій**
- **Відсутність втрати коштів користувачів**

## Потенційні ризики та рішення

### Технічні ризики
1. **Solana мережеві проблеми**
   - *Рішення*: Fallback RPC providers, retry механізми

2. **Високе навантаження на БД**
   - *Рішення*: Read replicas, connection pooling, кешування

3. **Blockchain congestion**
   - *Рішення*: Priority fees, transaction batching

### Бізнес ризики
1. **Регуляторні зміни**
   - *Рішення*: Гнучка архітектура, compliance модулі

2. **Конкуренція**
   - *Рішення*: Швидка ітерація, унікальні функції

## Моніторинг та підтримка

### Метрики для відстеження
- API response times та throughput
- Database connection pool utilization
- Queue processing rates
- Blockchain transaction success rates
- User activity patterns

### Алерти
- API error rate > 1%
- Database connections > 80%
- Queue lag > 5 minutes
- Failed transactions > 0.1%

### Логування
- Structured logging з Winston
- Centralized logs з ELK stack (майбутнє)
- Audit trail для всіх транзакцій

## Документація

Повна документація буде включати:
1. **API Reference** - GraphQL схема та REST ендпоінти
2. **Integration Guide** - як інтегруватися з API
3. **Deployment Guide** - інструкції по розгортанню
4. **Architecture Guide** - детальний опис архітектури
5. **Security Guide** - best practices та безпека