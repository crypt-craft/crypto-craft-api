# 🧪 User Cases для Phase 2 - CryptoCraft API

**Версія:** 2.0  
**Дата:** 2025-01-08  
**Статус:** Активні юзер кейси для Phase 2  

---

## 📋 Огляд

Після завершення Phase 2 реалізації, цей документ містить базові юзер кейси для тестування ключових функцій безпечної Web3 архітектури, TransactionBuilder сервісу, системи черг та GraphQL API.

### 🎯 Основні компоненти Phase 2
- 🔐 **Secure Web3 Architecture** - Private keys never leave client
- 📬 **Advanced Airdrop System** - Queue-based with Bull + Redis  
- 🔗 **Complete GraphQL API** - Token/User/Airdrop management
- 🧪 **Comprehensive Test Suite** - Unit, integration, and security tests

---

## 🔐 UC-001: Secure Token Creation Flow

### Мета
Протестувати повний цикл створення токену з безпечною Web3 архітектурою.

### Передумови
- API сервер запущений
- Redis та PostgreSQL доступні
- У користувача є Solana wallet

### Кроки
1. **Аутентифікація користувача**
   ```bash
   # Отримати повідомлення для підпису
   curl -X GET "http://localhost:4000/api/auth/message?walletAddress=9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
   ```

2. **Створити unsigned транзакцію**
   ```bash
   curl -X POST "http://localhost:4000/api/transactions/create-token" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Token",
       "symbol": "TEST",
       "decimals": 9,
       "initialSupply": 1000000
     }'
   ```

3. **Підписати транзакцію в wallet** (client-side)
   ```javascript
   // Frontend код (приклад)
   const signedTx = await wallet.signTransaction(unsignedTransaction);
   ```

4. **Відправити підписану транзакцію**
   ```bash
   curl -X POST "http://localhost:4000/api/transactions/submit" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "signedTransaction": "BASE64_SIGNED_TRANSACTION",
       "metadata": {
         "mintAddress": "GENERATED_MINT_ADDRESS"
       }
     }'
   ```

### Очікуваний результат
- ✅ Unsigned транзакція створена успішно
- ✅ Транзакція містить валідний mintAddress  
- ✅ Private key ніколи не передається на сервер
- ✅ Токен зберігається в базі даних після підпису

---

## 🎁 UC-002: Airdrop Campaign Management

### Мета
Протестувати створення та управління airdrop кампаніями з використанням системи черг.

### Передумови
- Створений токен (UC-001)
- Аутентифікований користувач

### Кроки
1. **Створити airdrop кампанію**
   ```bash
   curl -X POST "http://localhost:4000/api/airdrops/campaigns" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Airdrop Campaign",
       "tokenId": "TOKEN_UUID",
       "totalAmount": 10000,
       "recipients": [
         {"address": "WALLET_1", "amount": 100},
         {"address": "WALLET_2", "amount": 200}
       ]
     }'
   ```

2. **Перевірити статус кампанії**
   ```bash
   curl -X GET "http://localhost:4000/api/airdrops/campaigns/CAMPAIGN_ID"
   ```

3. **Запустити обробку черги**
   ```bash
   curl -X POST "http://localhost:4000/api/airdrops/campaigns/CAMPAIGN_ID/start"
   ```

4. **Отримати статистику кампанії**
   ```bash
   curl -X GET "http://localhost:4000/api/airdrops/campaigns/CAMPAIGN_ID/stats"
   ```

### Очікуваний результат
- ✅ Кампанія створена зі статусом DRAFT
- ✅ Recipients додані до черги
- ✅ Queue processing працює коректно
- ✅ Статистика відображає прогрес

---

## 🔍 UC-003: GraphQL API Integration

### Мета
Протестувати GraphQL API для комплексних запитів.

### Передумови
- Створені токени та користувачі
- GraphQL endpoint доступний

### Кроки
1. **Базовий health check**
   ```graphql
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

2. **Запит токенів користувача**
   ```graphql
   query MyTokens {
     myTokens(pagination: { first: 10 }) {
       edges {
         node {
           id
           name
           symbol
           mintAddress
           supply
           isVerified
         }
       }
       totalCount
     }
   }
   ```

3. **Створення токену через GraphQL**
   ```graphql
   mutation CreateToken {
     createTokenTransaction(input: {
       name: "GraphQL Token"
       symbol: "GQL"
       decimals: 9
       initialSupply: 500000
     }) {
       transaction
       metadata {
         mintAddress
         estimatedFee
       }
       signingInstructions
     }
   }
   ```

4. **Платформна статистика**
   ```graphql
   query PlatformStats {
     platformStats {
       totalUsers
       totalTokens
       totalTransactions
       activeAirdrops
     }
   }
   ```

### Очікуваний результат
- ✅ Health check повертає "healthy"
- ✅ Користувацькі токени відображаються
- ✅ Створення токену повертає валідну транзакцію
- ✅ Статистика платформи коректна

---

## 🛡️ UC-004: Security Validation

### Мета
Перевірити безпечність архітектури та валідацію входів.

### Передумови
- API запущений
- Доступні різні типи запитів

### Кроки
1. **Тест без аутентифікації**
   ```bash
   curl -X POST "http://localhost:4000/api/transactions/create-token" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test"}'
   ```

2. **Тест з невалідними параметрами**
   ```bash
   curl -X POST "http://localhost:4000/api/transactions/create-token" \
     -H "Authorization: Bearer VALID_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "",
       "symbol": "TOOLONGSYMBOL",
       "decimals": -1,
       "initialSupply": -100
     }'
   ```

3. **Тест rate limiting**
   ```bash
   # Відправити 100+ запитів швидко
   for i in {1..110}; do
     curl -X GET "http://localhost:4000/health" &
   done
   wait
   ```

4. **Тест injection attacks**
   ```bash
   curl -X POST "http://localhost:4000/api/transactions/validate-address" \
     -H "Content-Type: application/json" \
     -d '{"address": "'; DROP TABLE users; --"}'
   ```

### Очікуваний результат
- ✅ 401 Unauthorized для неаутентифікованих запитів
- ✅ 400 Bad Request для невалідних параметрів  
- ✅ 429 Too Many Requests при перевищенні лімітів
- ✅ Безпечна обробка injection спроб

---

## 🔄 UC-005: End-to-End Workflow

### Мета
Протестувати повний workflow від реєстрації до airdrop claim.

### Кроки
1. **Реєстрація двох користувачів**
   - User1: Token creator
   - User2: Airdrop recipient

2. **User1 створює токен**
   - Генерує unsigned транзакцію
   - "Підписує" в wallet (mocked)
   - Відправляє підписану транзакцію

3. **User1 створює airdrop кампанію**
   - Включає User2 як recipient
   - Запускає кампанію

4. **User2 claim airdrop**
   - Переглядає доступні airdrops
   - Створює claim транзакцію
   - Отримує токени

5. **Верифікація результатів**
   - Перевірити баланси
   - Перевірити транзакції в БД
   - Перевірити статистику

### Очікуваний результат
- ✅ Всі користувачі зареєстровані
- ✅ Токен створений та збережений
- ✅ Airdrop кампанія виконана
- ✅ Recipient отримав токени
- ✅ Всі дані коректні в БД

---

## 📊 UC-006: Performance Testing

### Мета
Перевірити продуктивність системи під навантаженням.

### Кроки
1. **API Response Time**
   ```bash
   ab -n 1000 -c 10 http://localhost:4000/health
   ```

2. **Database Performance**
   ```bash
   # Створити 1000 користувачів
   # Створити 100 токенів
   # Створити 10 airdrop кампаній з 1000 recipients кожна
   ```

3. **Queue Processing**
   ```bash
   # Запустити airdrop з 10,000 recipients
   # Моніторити швидкість обробки
   ```

4. **Memory Usage**
   ```bash
   docker stats --no-stream cryptocraft-api-dev
   ```

### Цільові метрики
- ⏱️ API response time: <200ms для 95% запитів
- 💾 Memory usage: <512MB під навантаженням
- 🚀 Queue processing: >100 transactions/minute
- 🔄 Zero memory leaks при тривалих тестах

---

## 🛠️ Automation Scripts

### Запуск всіх юзер кейсів
```bash
# Скрипт для автоматичного тестування
./scripts/run-user-cases.sh

# Або окремі кейси
./scripts/test-token-creation.sh
./scripts/test-airdrop-system.sh  
./scripts/test-graphql-api.sh
./scripts/test-security.sh
./scripts/test-performance.sh
```

### Моніторинг
```bash
# Real-time логи
make dev-logs

# Database моніторинг
docker-compose -f docker-compose.dev.yml exec postgres \
  psql -U cryptocraft_user -d cryptocraft_dev \
  -c "SELECT * FROM pg_stat_activity;"

# Redis queue статус
docker-compose -f docker-compose.dev.yml exec redis \
  redis-cli info stats
```

---

## 📋 Checklist для Phase 2

### Core Functionality ✅
- [ ] **Secure Web3 Architecture** - Private keys ніколи не передаються
- [ ] **TransactionBuilder Service** - Створення unsigned транзакцій
- [ ] **JWT Authentication** - Надійна аутентифікація 
- [ ] **Input Validation** - Всі параметри валідуються
- [ ] **Rate Limiting** - Захист від DDoS

### Advanced Features ✅
- [ ] **Airdrop Queue System** - Bull + Redis обробка
- [ ] **GraphQL API** - Повний набір resolvers
- [ ] **Campaign Management** - Створення та моніторинг
- [ ] **Real-time Statistics** - Queue та platform metrics
- [ ] **Error Handling** - Graceful degradation

### Security & Performance ✅
- [ ] **Zero Private Key Exposure** - 100% client-side signing
- [ ] **SQL Injection Prevention** - Prisma ORM захист
- [ ] **XSS Protection** - Input sanitization
- [ ] **Performance Targets** - <200ms response time
- [ ] **Memory Management** - No leaks під навантаженням

---

## 🔚 Summary

Phase 2 User Cases покривають всі ключові сценарії використання:
- **Security-first** архітектура з client-side підписанням
- **Production-ready** airdrop система з чергами  
- **Comprehensive** GraphQL API для складних запитів
- **Enterprise-grade** безпека та продуктивність

**Наступні кроки**: Фіксація виявлених проблем та підготовка до Phase 3.

---

*Документ оновлено після Phase 2 completion*  
*Останнє оновлення: 2025-01-08*