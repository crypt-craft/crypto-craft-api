# Session Log — 2025-08-12

Time: 2025-08-12T00:00:00Z (session start)

## What I read
- `docs/` project docs and previous session log
- Key code: `src/app.ts`, `src/api/graphql/{schema.ts,resolvers.ts}`, `src/api/routes/{authRoutes.ts,airdropRoutes.ts}`
- Tests: `tests/auth.test.ts`, `tests/setup.ts`
- Env: `docker-compose.dev.yml`

## Findings (state at start)
- Auth bug fixed: `/api/auth/register` now calls `validateUserRegistration({ walletAddress, username, email })`, unblocking registration validation.
- Tests updated: broader auth flow coverage; test setup loads `.env.test`, sets `AUTH_TEST_MODE`, `JWT_SECRET` defaults.
- GraphQL wired: `src/app.ts` uses imported `typeDefs`/`resolvers` and injects context with `user`, `blockchainManager`, `prisma`, `authService`.
- Airdrops REST: kept `GET /api/airdrops` 501 placeholder but it does not intercept sub-routes; `airdropRoutes` mounted and operational.
- Dev compose: simplified stack without nginx; healthchecks for API, Postgres, Redis; Postgres exposed on host `5433`.

## Pending / Next
1) Implement real unsigned SPL transfer generation in `AirdropService.claimAirdrop` and queue processor (uses `TransactionBuilderService`).
2) Expand GraphQL stats (e.g., transactions, volume) once Transaction model is added.
3) Run full integration tests for REST/GraphQL airdrop flows after implementing unsigned tx.

Status: Context refreshed; ready to proceed from the airdrop unsigned transaction implementation.

## Design decisions (security-first Solana UX)
- Server builds unsigned transactions only; signing always on frontend.
- Token creation: client generates `mintPublicKey`; API composes tx using provided pubkeys (no server keypairs, no partialSign, no secret material in metadata).
- Airdrop claims: target Merkle Distributor-style program so recipient signs solo; backend serves proofs. Interim (if needed) supports unsigned `transferChecked` that requires treasury authority signature (not recommended without a program/HSM).
- Instruction allowlist: only `spl-token`/ATA/system instructions from vetted factories; strict schema validation for inputs.
- TTL/expiry: include recent blockhash and short-lived `expiresAt` in metadata to reduce replay window.
- Observability: structured logs for tx builds (no sensitive data), queue metrics exposed via `/api/airdrops/queue-stats`.

## Security hardening update
- Removed `mintKeypair` from unsigned tx metadata output to avoid leaking any secret material.
- Ready to execute token creation flow end-to-end (unsigned on backend, sign on frontend, submit, then save metadata).

## Tooling update
- Simplified `Makefile` до базових команд: `install`, `dev`, `dev-logs`, `dev-stop`, `dev-restart`, `test`, `build`, `lint`, `type-check`, `db-migrate`, `db-seed`, `clean`.

за мене## Repo restructure — API moved under `crypto-craft-api/`

- All server files were relocated into `CryptoCraft/crypto-craft-api` to free root for the upcoming frontend app.
- TypeScript path aliases preserved in `tsconfig.json` (`@/*`).
- Production runtime now resolves aliases via build-time rewrite using `tsc-alias`.
- Changes applied:
  - Added `tsc-alias` and updated build script to `tsc && tsc-alias`.
  - Extended Jest `moduleNameMapper` for `@/database`, `@/middleware`, `@/api`.
  - Fixed README path (`cd crypto-craft-api`).
- Verified dev flow: `npm run dev` uses `ts-node-dev` with `tsconfig-paths/register`.
- Next: add frontend repo at `CryptoCraft/frontend/` (or similar) and wire proxy if needed.

## Build status (post-move)

- Local Node: v23.11.0 is unsupported by Jest 30 (requires ^18.14, ^20, ^22, or >=24).
- `npm ci` blocked by EBADENGINE locally.
- Docker now uses Node 24 (updated Dockerfiles), so dev/prod builds will run inside containers regardless of local Node.

## Next steps (ops)

- Local (optional): install Node 24 via `nvm` or Volta if you want to run outside Docker.
- Docker dev: `make dev` then `make dev-logs` to verify health at `http://localhost:4000/health`.
- Tests in container: `docker-compose -f docker-compose.dev.yml exec api npm test`.

## Frontend guides
- Додано `docs/frontend_client/` з інструкціями для React: налаштування клієнта, auth-flow, token-flow, airdrop-flow, troubleshooting.

## Commit
- development: ee823c1

[2025-08-12T15:34:17+0300] START: SSH key generation and repo setup instructions
[2025-08-12T15:36:19+0300] END: SSH key generation and repo setup instructions
[2025-08-12T15:40:16+0300] START: Initialize git and push development branch to origin
[2025-08-12T15:40:48+0300] END: Initialize git and push development branch to origin
[2025-08-12T15:56:09+0300] START: Clone UI repo (ui-ux) and rewire origin
[2025-08-12T15:56:57+0300] START: Prepare SSH for bazzzaka and clone ui-ux
[2025-08-12T15:57:36+0300] START: Clone ui-ux via HTTPS (no SSH key) and rewire origin
[2025-08-12T15:59:40+0300] START: Clone ui-ux with standard key by fingerprint
[2025-08-12T15:59:42+0300] END: Clone ui-ux with standard key by fingerprint
[2025-08-12T16:00:13+0300] START: Diagnose standard key, print pubkey, SSH test
[2025-08-12T16:00:14+0300] END: Diagnose standard key, print pubkey, SSH test
[2025-08-12T16:05:04+0300] START: Analyze repo layout and plan fixes for CryptoCraft structure
[2025-08-12T16:08:22+0300] START: Prepare local UI env (no push), fix root git state
[2025-08-12T16:08:24+0300] END: Prepare local UI env (no push)
[2025-08-12T16:11:03+0300] START: Prepare UI app locally (clone ui-ux, set remotes, install; no push)
[2025-08-12T16:15:55+0300] START: Clone UI (ui-ux) with deploy key and prepare locally (no push)
[2025-08-12T16:15:58+0300] END: Clone UI (ui-ux) with deploy key and prepare locally (no push)
[2025-08-12T16:16:41+0300] START: Verify alias, auth and clone via alias (no push)
[2025-08-12T16:16:49+0300] END: Verify alias, auth and clone via alias (no push)

[2025-08-12T19:12:00+0300] START: Fix IDE TypeScript errors (root tsconfig + project refs)
- Додано кореневий `tsconfig.json` з референсами на `crypto-craft-api` та `crypto-craft-ui/app-ui`.
- Увімкнено `composite` у `crypto-craft-api/tsconfig.json` та `crypto-craft-ui/app-ui/tsconfig.json`.
- План: перевірити типи у підпроєктах та усунути залишкові попередження у UI.
[2025-08-12T19:18:00+0300] END: Fix IDE TS errors — root tsconfig in place. Рекомендація: перезапустити TS Server в IDE, щоб діагностика перейшла на `crypto-craft-api/tsconfig.json` (alias `@/*` та типи Node коректно підхопляться).

[2025-08-12T19:20:00+0300] END: Session — backend TS config stabilized
[BUILD-API] 2025-08-12T20:12:32+0300 — Починаю виправлення Node engines і білд API

[2025-08-12T22:30:00+0300] START: Тимчасовий обхід 401 — stateless/Redis fallback для auth
- Додано `src/database/redis.ts` (ioredis клієнт, json get/set, ping)
- `middleware/auth.ts`: fallback до Redis snapshot або синтетичного користувача, якщо БД недоступна та `AUTH_STATELESS_MODE=true`
- `AuthService`: кешує snapshot користувача у Redis після register/login
- `app.ts`: дозволяє старт без БД у stateless режимі
- `authRoutes.ts`: у stateless режимі видає ефермерний JWT при валідному підписі, навіть коли користувача нема у БД
[2025-08-12T22:38:00+0300] END: Тимчасовий обхід 401 — stateless/Redis fallback для auth
