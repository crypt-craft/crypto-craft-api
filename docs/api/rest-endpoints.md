# REST API Endpoints Documentation

## Overview

CryptoCraft надає REST API як додатковий інтерфейс для простих операцій та інтеграцій. REST API використовується для:
- Health checks та статус моніторинг
- Webhook callbacks
- Простих read-only операцій
- Інтеграції з зовнішніми системами

**Base URL**: `https://api.cryptocraft.com/v1`
**Content-Type**: `application/json`

## Authentication

### Bearer Token
```http
Authorization: Bearer <jwt_token>
```

### API Key (для бізнес-інтеграцій)
```http
X-API-Key: <api_key>
```

## Health & Status

### GET /health
Перевіряє статус API та всіх залежностей.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "solana_rpc": "healthy",
    "queue": "healthy"
  },
  "uptime": 86400
}
```

### GET /health/deep
Детальна перевірка всіх компонентів системи.

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 15,
      "connections": {
        "active": 10,
        "idle": 5,
        "max": 20
      }
    },
    "redis": {
      "status": "healthy",
      "latency": 2,
      "memory_usage": "45MB"
    },
    "solana_rpc": {
      "status": "healthy",
      "latency": 120,
      "slot": 180000000,
      "network": "mainnet-beta"
    },
    "queue": {
      "status": "healthy",
      "pending_jobs": 5,
      "active_jobs": 2,
      "failed_jobs": 0
    }
  }
}
```

## Tokens
## IPFS / Pinata

### GET /api/ipfs/test-auth
Перевіряє налаштування Pinata креденшалів всередині сервісу.

Response (успішний): повертає `ok: true` і тіло з Pinata `data/testAuthentication`.

Response (помилка): `401` з `code: PINATA_AUTH_MISSING` і `diagnostics`.

Посилання на документацію Pinata: [Pinata API Introduction](https://docs.pinata.cloud/api-reference/introduction)

### POST /api/ipfs/pin-json
Принимає JSON body та пінить його до IPFS через Pinata.

Request:
```http
POST /api/ipfs/pin-json
Content-Type: application/json

{ "name": "MyToken", "symbol": "MTK" }
```

Response:
```json
{ "IpfsHash": "Qm...", "PinSize": 1234, "Timestamp": "2025-08-14T12:00:00Z" }
```

### POST /api/ipfs/pin-file
Принимає `{ fileName, dataUrl }` де `dataUrl` — це data URI (base64) файлу.

Request:
```json
{ "fileName": "logo.png", "dataUrl": "data:image/png;base64,iVBOR..." }
```

Response: аналогічний до `pinFileToIPFS` з Pinata.


### GET /tokens
Отримати список токенів з фільтрацією та пагінацією.

**Query Parameters:**
- `limit` (int): Кількість записів (default: 20, max: 100)
- `offset` (int): Зсув для пагінації (default: 0)
- `type` (string): Фільтр по типу токену (`fungible`, `non_fungible`, `memecoin`)
- `creator` (string): Solana адреса створювача
- `search` (string): Пошук по назві або символу

**Example Request:**
```http
GET /tokens?limit=10&type=fungible&search=DOGE
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "name": "DogeCraft",
      "symbol": "DOGC",
      "type": "memecoin",
      "total_supply": "1000000000",
      "decimals": 9,
      "creator": "5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA",
      "created_at": "2024-01-15T10:30:00Z",
      "metadata": {
        "description": "The best meme token on Solana",
        "image": "https://ipfs.io/ipfs/...",
        "website": "https://dogecraft.com"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "pages": 15
  }
}
```

### GET /tokens/:mintAddress
Отримати детальну інформацію про токен.

**Response:**
```json
{
  "id": "uuid-1",
  "mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "name": "DogeCraft",
  "symbol": "DOGC",
  "type": "memecoin",
  "total_supply": "1000000000",
  "decimals": 9,
  "creator": "5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA",
  "created_at": "2024-01-15T10:30:00Z",
  "metadata": {
    "description": "The best meme token on Solana",
    "image": "https://ipfs.io/ipfs/...",
    "website": "https://dogecraft.com",
    "twitter": "https://twitter.com/dogecraft",
    "telegram": "https://t.me/dogecraft"
  },
  "statistics": {
    "holders_count": 1250,
    "transfers_count": 5420,
    "market_cap": 125000.50,
    "price": 0.000125
  }
}
```

### POST /tokens
Створити новий токен.

**Request Body:**
```json
{
  "name": "MyToken",
  "symbol": "MTK",
  "description": "My awesome token",
  "type": "fungible",
  "total_supply": "1000000",
  "decimals": 9,
  "metadata": {
    "website": "https://mytoken.com",
    "image": "https://ipfs.io/ipfs/..."
  }
}
```

**Response:**
```json
{
  "id": "uuid-2",
  "mint_address": "8yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "transaction_hash": "5fGH7...",
  "status": "pending",
  "created_at": "2024-01-15T11:00:00Z"
}
```

## Airdrops

### GET /airdrops
Отримати список airdrop кампаній.

**Query Parameters:**
- `limit` (int): Кількість записів
- `offset` (int): Зсув для пагінації
- `status` (string): Статус кампанії (`draft`, `scheduled`, `in_progress`, `completed`, `failed`)
- `creator` (string): Адреса створювача
- `token` (string): Mint адреса токену

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-airdrop-1",
      "name": "Community Airdrop #1",
      "token": {
        "mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        "name": "DogeCraft",
        "symbol": "DOGC"
      },
      "total_amount": "100000",
      "recipients_count": 1000,
      "status": "completed",
      "distributed_amount": "100000",
      "successful_transfers": 995,
      "failed_transfers": 5,
      "created_at": "2024-01-15T09:00:00Z",
      "completed_at": "2024-01-15T09:15:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0,
    "pages": 2
  }
}
```

### GET /airdrops/:campaignId
Отримати детальну інформацію про airdrop кампанію.

**Response:**
```json
{
  "id": "uuid-airdrop-1",
  "name": "Community Airdrop #1",
  "description": "Rewarding our early supporters",
  "token": {
    "mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "name": "DogeCraft",
    "symbol": "DOGC"
  },
  "creator": "5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA",
  "total_amount": "100000",
  "recipients_count": 1000,
  "status": "completed",
  "distributed_amount": "100000",
  "successful_transfers": 995,
  "failed_transfers": 5,
  "scheduled_at": "2024-01-15T09:00:00Z",
  "started_at": "2024-01-15T09:00:30Z",
  "completed_at": "2024-01-15T09:15:00Z",
  "created_at": "2024-01-14T15:30:00Z",
  "recipients": [
    {
      "address": "8fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzB",
      "amount": "100",
      "status": "confirmed",
      "transaction_hash": "3fGH7uJK...",
      "processed_at": "2024-01-15T09:01:00Z"
    }
  ]
}
```

### POST /airdrops
Створити нову airdrop кампанію.

**Request Body:**
```json
{
  "name": "New Year Airdrop",
  "description": "Celebrating New Year with our community",
  "token_mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "recipients": [
    {
      "address": "8fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzB",
      "amount": "100"
    },
    {
      "address": "9gOfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzC",
      "amount": "200"
    }
  ],
  "scheduled_at": "2024-01-20T12:00:00Z"
}
```

**Response:**
```json
{
  "id": "uuid-airdrop-2",
  "status": "scheduled",
  "transaction_hash": null,
  "created_at": "2024-01-15T11:30:00Z",
  "scheduled_at": "2024-01-20T12:00:00Z"
}
```

## Transactions

### GET /transactions
Отримати історію транзакцій.

**Query Parameters:**
- `limit` (int): Кількість записів
- `offset` (int): Зсув для пагінації
- `type` (string): Тип транзакції
- `status` (string): Статус транзакції
- `address` (string): Адреса користувача
- `from_date` (string): Початкова дата (ISO 8601)
- `to_date` (string): Кінцева дата (ISO 8601)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-tx-1",
      "hash": "5fGH7uJKmNpQrStUvWxYz1234567890aBcDeF",
      "type": "token_create",
      "status": "confirmed",
      "amount": null,
      "from_address": "5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA",
      "to_address": null,
      "token": {
        "mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        "name": "DogeCraft",
        "symbol": "DOGC"
      },
      "fee": "5000",
      "block_height": "180000000",
      "created_at": "2024-01-15T10:30:00Z",
      "confirmed_at": "2024-01-15T10:30:15Z"
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 20,
    "offset": 0,
    "pages": 25
  }
}
```

### GET /transactions/:hash
Отримати детальну інформацію про транзакцію.

**Response:**
```json
{
  "id": "uuid-tx-1",
  "hash": "5fGH7uJKmNpQrStUvWxYz1234567890aBcDeF",
  "type": "token_create",
  "status": "confirmed",
  "amount": null,
  "from_address": "5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA",
  "to_address": null,
  "token": {
    "mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "name": "DogeCraft",
    "symbol": "DOGC"
  },
  "fee": "5000",
  "block_height": "180000000",
  "confirmations": 500,
  "created_at": "2024-01-15T10:30:00Z",
  "confirmed_at": "2024-01-15T10:30:15Z",
  "metadata": {
    "instruction_type": "InitializeMint",
    "program_id": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  }
}
```

## Analytics

### GET /analytics
Отримати загальну аналітику системи.

**Query Parameters:**
- `period` (string): Період аналітики (`hour`, `day`, `week`, `month`)
- `from_date` (string): Початкова дата
- `to_date` (string): Кінцева дата

**Response:**
```json
{
  "period": "day",
  "from_date": "2024-01-14T00:00:00Z",
  "to_date": "2024-01-15T00:00:00Z",
  "metrics": {
    "tokens_created": 45,
    "transactions_count": 1250,
    "total_volume": "5000000",
    "active_users": 320,
    "new_users": 85,
    "airdrop_campaigns": 12,
    "success_rate": 99.2
  },
  "charts": {
    "hourly_transactions": [
      { "hour": "00:00", "count": 45 },
      { "hour": "01:00", "count": 32 }
    ],
    "token_types": {
      "fungible": 25,
      "non_fungible": 15,
      "memecoin": 5
    }
  }
}
```

### GET /analytics/users/:address
Отримати аналітику для конкретного користувача.

**Response:**
```json
{
  "user_address": "5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA",
  "period": "month",
  "metrics": {
    "tokens_created": 5,
    "airdrops_initiated": 3,
    "transactions_sent": 25,
    "transactions_received": 40,
    "total_volume_sent": "10000",
    "total_volume_received": "15000",
    "total_fees_paid": "250"
  },
  "activity": [
    {
      "date": "2024-01-15",
      "transactions": 8,
      "volume": "2500"
    }
  ]
}
```

## Solana Pay

### POST /solana-pay/create
Створити Solana Pay запит на оплату.

**Request Body:**
```json
{
  "amount": "100",
  "token_mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "recipient": "5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA",
  "memo": "Payment for services",
  "reference": "custom-ref-123"
}
```

**Response:**
```json
{
  "url": "solana:5fNfvyp5f3BB9qYs3byteK4LmuBSfzun9PiLSYXanQzA?amount=100&spl-token=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU&reference=uuid-ref-123&memo=Payment%20for%20services",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "reference": "uuid-ref-123",
  "expires_at": "2024-01-15T12:00:00Z"
}
```

### GET /solana-pay/status/:reference
Перевірити статус Solana Pay транзакції.

**Response:**
```json
{
  "reference": "uuid-ref-123",
  "status": "confirmed",
  "transaction_hash": "3fGH7uJKmNpQrStUvWxYz1234567890aBcDeF",
  "amount": "100",
  "token": {
    "mint_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "symbol": "DOGC"
  },
  "paid_at": "2024-01-15T11:45:00Z",
  "confirmed_at": "2024-01-15T11:45:15Z"
}
```

## Webhooks

### POST /webhooks/register
Зареєструвати webhook для отримання повідомлень.

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/cryptocraft",
  "events": ["token.created", "airdrop.completed", "transaction.confirmed"],
  "secret": "your-webhook-secret"
}
```

**Response:**
```json
{
  "id": "uuid-webhook-1",
  "url": "https://your-app.com/webhooks/cryptocraft",
  "events": ["token.created", "airdrop.completed", "transaction.confirmed"],
  "created_at": "2024-01-15T11:00:00Z",
  "status": "active"
}
```

## Error Responses

Всі помилки повертаються в стандартному форматі:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "amount",
      "reason": "Must be a positive number"
    },
    "timestamp": "2024-01-15T11:00:00Z",
    "request_id": "req-uuid-123"
  }
}
```

### HTTP Status Codes
- `200` - Успішний запит
- `201` - Ресурс створено
- `400` - Неправильний запит
- `401` - Не автентифіковано
- `403` - Недостатньо дозволів
- `404` - Ресурс не знайдено
- `429` - Перевищено ліміт запитів
- `500` - Внутрішня помилка сервера
- `503` - Сервіс недоступний

### Error Codes
- `AUTHENTICATION_REQUIRED` - Потрібна аутентифікація
- `INSUFFICIENT_PERMISSIONS` - Недостатньо дозволів
- `VALIDATION_ERROR` - Помилки валідації
- `RATE_LIMIT_EXCEEDED` - Перевищено ліміт
- `RESOURCE_NOT_FOUND` - Ресурс не знайдено
- `INSUFFICIENT_BALANCE` - Недостатньо коштів
- `TRANSACTION_FAILED` - Транзакція не вдалася
- `NETWORK_ERROR` - Помилка мережі
- `INTERNAL_ERROR` - Внутрішня помилка

## Rate Limiting

REST API має наступні обмеження:

- **Аутентифіковані користувачі**: 1000 req/hour
- **Анонімні користувачі**: 100 req/hour
- **Бізнес API ключі**: Індивідуальні ліміти
- **Webhook endpoints**: 10,000 req/hour

Rate limit headers включені у всі відповіді:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
```