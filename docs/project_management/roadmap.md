# Roadmap

## Vision
Побудувати безпечну платформу менеджменту токенів на Solana з фокусом на unsigned-транзакції та self-custody користувачів.

## Milestones
- M1: Безпечний API для токен-операцій (create token unsigned tx, submit signed, save metadata)
- M2: Airdrop v1 (unsigned transfer, queue, спостережуваність)
  - M2a: Devnet faucet у вкладці Airdrop (UI чекбокс + SOL requestAirdrop)
- M3: Merkle Distributor (on-chain програма claim без казначейського підпису)
- M4: Аналітика та статистики (on-chain індексація, дашборди)
- M5: Production hardening (rate limits, WAF, audit logging, SLOs)

## High-level timeline
- Q1: M1-M2
- Q2: M3
- Q3: M4
- Q4: M5
