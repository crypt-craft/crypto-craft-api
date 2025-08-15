# React Setup

## Dependencies
```bash
npm install @apollo/client graphql @solana/web3.js
```

## Apollo Client (JWT in Authorization)
```ts
// src/lib/apollo.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({ uri: 'http://localhost:4000/graphql' });

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('cc_jwt');
  return {
    headers: {
      ...headers,
      Authorization: token ? `Bearer ${token}` : ''
    }
  };
});

export const apollo = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});
```

## Fetch helper (REST)
```ts
// src/lib/api.ts
export const API_BASE = 'http://localhost:4000';

export async function apiGet(path: string, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path: string, body: any, token?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

## CORS
- Backend очікує `CORS_ORIGIN` = `http://localhost:3000`. Якщо фронт на іншому порту/домені — оновіть цю змінну.
