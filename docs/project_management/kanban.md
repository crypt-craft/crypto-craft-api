# Kanban (Text Board)

## To Do
- Airdrop: використовувати `AIRDROP_TREASURY_TOKEN_ACCOUNT`/`AIRDROP_TREASURY_AUTHORITY_PUBKEY` у всіх шляхах
- Додати `expiresAt`/`nonce` в metadata (зроблено частково)
- Документація Project Management (ця папка)
- UI: Devnet Airdrop Checkbox у вкладці Airdrop (чекбокс + кнопка faucet)
- UI: Приховати/заборонити faucet на Mainnet
- Docs: Дослідницький звіт по Devnet faucet (API, ліміти, сек’юріті)

## In Progress
- Оновлення `AirdropService`/`TransactionBuilderService` для treasury + TTL/nonce
- UI: Під’єднання `useNetwork` до AirdropFeature і перевірка адреси гаманця

## Review
- `docker-compose.dev.yml` env для airdrop treasury
- Docs: Backlog/Roadmap оновлено щодо Devnet faucet

## Done
- GraphQL wired до реальних `typeDefs`/`resolvers`
- Виправлено валідацію реєстрації `/api/auth/register`
