# Troubleshooting

## NetworkError: Failed to fetch
- Переконайтесь, що бекенд працює: `http://localhost:4000/health` → `healthy`.
- CORS: змінна `CORS_ORIGIN` має відповідати вашому фронтенд-URL (наприклад, `http://localhost:3000`).
- Протокол/порт: уникайте `https` при бекенді на `http`; домен/порт мають збігатися з `CORS_ORIGIN`.
- Заголовки: для GraphQL — `Content-Type: application/json`; для захищених — `Authorization: Bearer <JWT>`.
- Шлях: GraphQL працює на `/graphql` методом POST.
- Блокувальники: розширення браузера/AdBlock можуть блокувати запити — спробуйте інкогніто.

## GraphQL errors
- `Authentication required` — додайте JWT у заголовок.
- `User Input Error` — перевірте поля input згідно зі схемою.

## Транзакції Solana
- Phantom: `window.solana.isPhantom` має бути true; якщо ні — встановіть гаманець або використайте інший адаптер.
- Base64: перед підписом десеріалізуйте транзакцію через `Transaction.from(Buffer.from(base64, 'base64'))`.
- TTL: транзакції мають короткий `expiresAt`; підписуйте та відправляйте без затримок.
