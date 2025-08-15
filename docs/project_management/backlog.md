# Product Backlog

## Epics
- Token Management
- Airdrop Distribution
- Security & Compliance
- Observability
- Developer Experience

## User Stories (initial)
- Як користувач, я хочу створити токен через API і отримати unsigned транзакцію для підписання.
- Як користувач, я хочу клеймити airdrop через API, підписавши транзакцію у гаманці.
- Як адміністратор, я хочу бачити метрики черг airdrop.
- Як розробник, я хочу мати SDK/приклади для інтеграції з фронтендом.

### New: Devnet Airdrop Checkbox (UI)
- Як користувач Devnet, я хочу увімкнути чекбокс тестового режиму у вкладці `Airdrop` і отримати тестовий SOL airdrop на мій гаманець, щоб мати кошти для тестових транзакцій.

Value
- Швидкий старт на Devnet без зовнішніх faucetів; зменшення відтоку користувача та friction.

Acceptance criteria
- Чекбокс і блок «Get Devnet SOL Airdrop» відображається лише у `Devnet`.
- На `Mainnet` опція відсутня.
- Успішний запит `requestAirdrop` показує txId та успішний стан у UI.
- Обмеження суми у UI: 0 < amount ≤ 2 SOL за один запит (hard UI limit).

## Acceptance criteria
- Валідація схем (Joi), allowlist інструкцій, TTL для blockhash, nonce-аудит у Redis.
