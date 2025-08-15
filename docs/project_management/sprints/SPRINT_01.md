# Sprint 01

Dates: 2025-08-12 — 2025-08-26

## Goals
- Airdrop v1: unsigned transfer з treasury, безпечні метадані
- PM Docs: створити структуру і перший контент
 - UI: Devnet faucet у вкладці Airdrop (чекбокс + SOL request)

## Sprint Backlog
- [ ] Env: treasury config у compose (dev)
- [ ] Code: `AirdropService` використовує treasury account + authority
- [ ] Code: `TransactionBuilderService` додає `nonce`/`expiresAt`
- [ ] Docs: PM README, roadmap, backlog, kanban, processes
- [ ] Tests: покрити claim flow з unsigned транзакцією
 - [ ] FE: Devnet чекбокс і faucet у `app-ui/src/components/features/AirdropFeature.tsx`
 - [ ] FE: Валідація amount (0 < amount ≤ 2), приховати на Mainnet
 - [ ] Docs: research, user cases, test plan для Devnet faucet

## Risks
- Відсутня on-chain програма distributor → тимчасово потрібен підпис authority для transfer

## Demo
- Демонстрація створення unsigned claim-транзакції і підпису на фронті
