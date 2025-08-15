# Airdrop Claim Flow

Кроки: (1) перевірити доступні airdrops → (2) створити unsigned claim → (3) підписати → (4) submit підписану

## 1) Доступні airdrops (REST)
```ts
import { apiGet, apiPost } from '../src/lib/api';

export async function getAvailableAirdrops(token: string) {
  return apiGet('/api/airdrops/available', token);
}
```

## 2) Створити unsigned claim-транзакцію (REST)
```ts
export async function createClaimTx(campaignId: string, token: string) {
  return apiPost(`/api/airdrops/claim/${campaignId}`, {}, token);
}
```

## 3) Підпис (див. token-flow: signSerializedTransaction)

## 4) Відправка підписаної транзакції (GraphQL)
Використовуйте `submitSignedTransaction` так само, як у token-flow.

```ts
// Приклад
// const { transaction, metadata } = await createClaimTx(campaignId, token)
// const signed = await signSerializedTransaction(transaction)
// const res = await submitSigned(signed, metadata)
```

Зауваження: для повністю self-custody варто переходити на Merkle Distributor програму, щоб уникнути підпису authority для transfer.

## Devnet Faucet (UI only)
- У вкладці `Airdrop` при мережі Devnet доступний чекбокс «Enable Devnet test mode».
- Після активації — кнопка «Get Devnet SOL Airdrop», що викликає `web3.Connection.requestAirdrop` на Devnet.
- На Mainnet ця опція відсутня.
