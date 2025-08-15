# Devnet Airdrop (Faucet) Research

## Goal
Увімкнути у вкладці `Airdrop` можливість запитати тестові SOL на Devnet при активованому чекбоксі. На Mainnet — відсутня.

## APIs / SDK
- Solana Web3.js: `Connection.requestAirdrop(publicKey, lamports)`; RPC: `clusterApiUrl('devnet')`.
- Облік користувача: адреса гаманця з Reown AppKit (`useAppKitAccount`).
- Для airdrop SPL-токенів використовується існуючий бек `POST /api/airdrops/claim-direct` (unsigned transfer з treasury, не faucet).

## Limits / Constraints
- Devnet faucet має rate limits на RPC рівні; практична межа 1–2 SOL за запит; часті запити можуть блокуватись.
- UI-хардліміт: до 2 SOL/запит, блокувати ≤0 і NaN.
- Немає гарантії доступності faucet; слід показувати помилки/ретраїти помірно.

## Security Considerations
- Мінімізувати можливість зловживань: тільки Devnet, приховати на Mainnet.
- Не зберігати приватні ключі; підписи не потрібні для самого faucet-запиту.
- Для `claim-direct` на SPL токени покладатися на treasury env і RBAC (`authenticateJWT`).

## Identity & Workflow (Devnet vs Mainnet)
- Devnet: ідентифікація через підключений гаманець (AppKit). Запит SOL → підтвердження → показати `txId` та стан успіху.
- Mainnet: faucet відсутній. Майбутній функціонал: валідація KYC/allowlist або навчальний банер без дій.

## Open Questions (Mainnet extension)
- Чи потрібно показувати освітній банер на Mainnet, чи повністю ховати блок?
- Додати серверний rate-limit proxy для faucet чи залишити прямий виклик RPC?


