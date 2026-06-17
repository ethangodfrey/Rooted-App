# Rooted POS Integrations

Backend-only integration that imports **card sale data** from third-party Point
of Sale systems into Rooted's vendor analytics. Supports **Square**, **Toast**,
and **Clover** behind a provider-agnostic adapter architecture.

> Status: Square is the primary integration path. See **[SQUARE_SETUP.md](./SQUARE_SETUP.md)**
> for sandbox credentials, OAuth redirect URL, and local dev checklist.

---

## 1. Architecture

```
                         ┌──────────────────────────────────────────────┐
   Vendor app  ──────────▶  REST API (NestJS)                            │
   Admin tools ──────────▶    /pos/connections  /pos/sync  /pos/mappings │
                         │    /admin/pos                                  │
   Provider OAuth ───────▶    /pos/oauth/:provider/callback              │
   Provider webhooks ────▶    /pos/webhooks/:provider                    │
                         └───────────────┬──────────────────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────────┐
                 ▼                       ▼                            ▼
        ConnectionService          SyncService                 WebhookService
        (OAuth/API-key,         (window + pagination)        (verify + enqueue)
         encrypted vault)             │
                 │                    │ enqueue
                 ▼                    ▼
         PosCredential          BullMQ: pos-sync queue ──▶ SyncProcessor
         (AES-256-GCM)                                         │
                                                               ▼
                                  Provider Adapter (Square│Toast│Clover)
                                       fetchTransactions()  ── normalized ──▶
                                                               │
                                                               ▼
                                                        ImportService
                                              (idempotent upsert + mapping)
                                                               │
                                       ┌───────────────────────┴───────────┐
                                       ▼                                    ▼
                              pos_imported_transactions        BullMQ: pos-aggregation
                              pos_imported_line_items                 │
                                       │                              ▼
                                       ▼                       AnalyticsService
                              AnalyticsService.syncInventory   recomputeSnapshots()
                              → inventory_transactions         → analytics_snapshots
                                (type = 'sale_pos')
```

**Key principles**

- **Provider-agnostic core.** Connection/sync/import/analytics never reference a
  concrete provider — only the `PosProviderAdapter` interface and the
  `NormalizedTransaction` model.
- **Secure by default.** Tokens/API keys are encrypted at rest (AES-256-GCM) in a
  separate `pos_credentials` vault and never returned by any endpoint.
- **Idempotent everywhere.** Transactions de-dupe on
  `(connection, providerTransactionId)`; webhooks on `(provider, providerEventId)`;
  inventory writes link 1:1 to a line item; snapshot rollups are fully recomputed
  from source rows.
- **Async + resilient.** Syncs and aggregations run on BullMQ with exponential
  backoff retries. Webhooks return fast and defer work to the queue.

---

## 2. Data model (Prisma)

Defined in `backend/prisma/schema.prisma`.

| Model | Purpose |
| --- | --- |
| `PosConnection` | One vendor↔provider link: status, location, cadence, cursor. |
| `PosCredential` | Encrypted token/API-key vault (1:1 with connection). |
| `PosSyncRun` | Audit of each sync attempt: window, counts, status. |
| `PosImportedTransaction` | Normalized, provider-agnostic sale. Unique on `(connectionId, providerTransactionId)`. |
| `PosImportedLineItem` | Normalized line items; links to a mapped `Product` and the resulting `InventoryTransaction`. |
| `PosProductMapping` | Maps a provider catalog object → Rooted product (auto-match by name supported). |
| `PosLocationMapping` | Maps a provider location → Rooted event context. |
| `PosWebhookEvent` | Raw inbound webhook envelopes; unique on `(provider, providerEventId)`. |
| `PosSyncError` | Structured per-scope error log (connection/sync/import/webhook/mapping). |

Enums: `PosProvider`, `PosAuthType`, `PosConnectionStatus`, `PosSyncTrigger`,
`PosSyncStatus`, `PosTransactionState`, `PosWebhookStatus`, `PosErrorScope`.

> The "existing Rooted tables" (`Vendor`, `Product`, `Event`,
> `InventoryTransaction`, `AnalyticsSnapshot`) are modeled as a **read/write
> subset** mapped to the Supabase tables. Do **not** run `prisma migrate` against
> those tables — only the `pos_*` tables are Prisma-migrate-managed. Use
> `docs/supabase/phase12_pos_integrations.sql` to patch the existing tables.

---

## 3. Module structure

```
backend/
├─ prisma/schema.prisma
└─ src/
   ├─ main.ts                         # raw body parser for /pos/webhooks
   ├─ app.module.ts                   # Config + Schedule + BullMQ + Prisma + POS
   ├─ prisma/                         # PrismaModule + PrismaService
   ├─ common/
   │  ├─ crypto/credential-cipher.service.ts   # AES-256-GCM vault
   │  └─ auth/                        # SupabaseAuthGuard, RolesGuard, @CurrentUser
   └─ modules/pos/
      ├─ pos.module.ts
      ├─ pos.constants.ts
      ├─ types/                       # NormalizedTransaction, provider.types
      ├─ adapters/
      │  ├─ provider-adapter.interface.ts
      │  ├─ square/square.adapter.ts
      │  ├─ toast/toast.adapter.ts
      │  └─ clover/clover.adapter.ts
      ├─ services/
      │  ├─ provider-registry.service.ts
      │  ├─ pos-connection.service.ts
      │  ├─ pos-sync.service.ts
      │  ├─ pos-import.service.ts
      │  ├─ pos-mapping.service.ts
      │  ├─ pos-webhook.service.ts
      │  └─ pos-analytics.service.ts
      ├─ jobs/
      │  ├─ pos-queue.constants.ts
      │  ├─ pos-jobs.service.ts
      │  ├─ pos-sync.processor.ts
      │  ├─ pos-aggregation.processor.ts
      │  └─ pos-scheduler.service.ts
      ├─ dto/
      └─ controllers/
         ├─ pos-connections.controller.ts   # vendor
         ├─ pos-sync.controller.ts          # vendor
         ├─ pos-mappings.controller.ts      # vendor
         ├─ pos-oauth.controller.ts         # public OAuth redirect
         ├─ pos-webhooks.controller.ts      # public webhooks
         └─ admin-pos.controller.ts         # admin
```

---

## 4. Provider adapter interface

`PosProviderAdapter` (`adapters/provider-adapter.interface.ts`) is the single
contract every provider implements:

- **OAuth lifecycle:** `getAuthorizeUrl`, `exchangeOAuthCode`, `refreshAccessToken`
- **API-key lifecycle:** `validateApiKey`
- **Metadata:** `listLocations`, `listCatalogItems`
- **Ingestion:** `fetchTransactions(params) → { transactions, nextCursor }`
- **Webhooks:** `verifyWebhook(input) → ParsedWebhook`, optional `registerWebhook`

Each adapter converts provider payloads into `NormalizedTransaction`
(integer-cents amounts, ISO timestamps, normalized tender/state, line items with
`providerCatalogObjectId` for mapping).

| Provider | Auth | Notes |
| --- | --- | --- |
| Square | OAuth2 | Orders Search API; HMAC-SHA256 webhook signatures (`x-square-hmacsha256-signature`). |
| Toast | API key / client-credentials | Partner onboarding required. `TODO: verify with provider docs` on auth, endpoints, signatures. |
| Clover | OAuth2 | Merchant-scoped Orders API with `expand=lineItems,payments`. `TODO: verify with provider docs` on hosts, refresh, webhook header. |

---

## 5. Connection handling

### OAuth (Square, Clover)

1. `POST /pos/connections { provider }` → creates a `PENDING` connection with a
   random `oauthState`; returns `authorizeUrl`.
2. Vendor authorizes; provider redirects to
   `GET /pos/oauth/:provider/callback?code&state`.
3. `ConnectionService.handleOAuthCallback` exchanges the code, stores encrypted
   tokens, sets the connection `ACTIVE`, and bounces back to the app deep link.
4. `getUsableCredentials` transparently **refreshes** expired access tokens and
   persists the rotation.

### API key (Toast)

1. `POST /pos/connections { provider, apiKey, providerLocationId }` → validates
   via `validateApiKey`, stores the encrypted key, sets `ACTIVE`.

### Credential security

- `POS_CREDENTIAL_KEY` = base64 32-byte key. AES-256-GCM, fresh IV per write,
  auth tag stored alongside ciphertext, `keyVersion` for rotation.
- Secrets live only in `pos_credentials`; controllers strip `webhookSecret` /
  `oauthState` before returning connections.

---

## 6. Sync & import

### Triggers

- **Manual:** `POST /pos/connections/:id/sync` (optionally `{ backfill, since, until }`).
- **Scheduled:** `PosSchedulerService` (`@Cron` every 5 min) enqueues connections
  whose `syncFrequencyMinutes` cadence has elapsed.
- **Webhook:** verified, sales-relevant events enqueue a `WEBHOOK`-triggered sync.
- **Backfill:** reaches back `INITIAL_BACKFILL_DAYS` (default 30) ignoring cursor.

### Real-time webhooks (Square)

- **Auto-subscription:** on a successful OAuth connect, `PosConnectionService`
  calls `adapter.registerWebhook(credentials, `${POS_PROVIDER_BASE_URL}/pos/webhooks/square`)`.
  Square's Webhook Subscriptions API (`POST /v2/webhooks/subscriptions`) returns a
  per-subscription `signature_key`, stored as the connection's `webhookSecret`, and
  the subscription id is stored in `metadata.webhookSubscriptionId`. Registration is
  best-effort and non-fatal (it no-ops when `POS_PROVIDER_BASE_URL` is unset).
- **Subscribed events** (override via `SQUARE_WEBHOOK_EVENT_TYPES`): `payment.*`,
  `refund.*`, and `order.*`. These must also be enabled on the Square application's
  Webhooks settings. `TODO: verify with provider docs` for the exact enabled set.
- **Inbound handling** (`PosWebhookService.handleInbound`): parse → resolve the
  connection by merchant/location → re-verify the HMAC with the per-connection
  `signature_key` → idempotent persist on `(provider, providerEventId)`. Only events
  matching `isWebhookSyncRelevant` (payment/refund/order) enqueue an incremental
  sync; others are recorded as `IGNORED`. Invalid signatures are stored `FAILED`.
- **Manual (re)register:** `POST /pos/connections/:id/webhook` re-subscribes (useful
  if `POS_PROVIDER_BASE_URL` changed or the initial attempt failed). Surfaced in the app as
  "Enable real-time updates" on the connection detail screen.
- **Cleanup:** `disconnect` best-effort deletes the remote subscription
  (`DELETE /v2/webhooks/subscriptions/:id`) before removing credentials.

### Flow (`PosSyncService.runSync`)

1. Create/advance a `PosSyncRun` (`RUNNING`), derive the time window (incremental
   window overlaps by `INCREMENTAL_OVERLAP_MINUTES` to avoid edge gaps).
2. Loop `adapter.fetchTransactions` pages until `nextCursor` is null.
3. Hand each page to `PosImportService.importTransactions`.
4. Update connection `lastSyncedAt`, finalize the run (`SUCCESS` / `PARTIAL` /
   `FAILED` + counts), and enqueue aggregation for affected dates.

### Idempotency & duplicate protection

- Upsert keyed on `(connectionId, providerTransactionId)`. Existing rows are
  **skipped**, or **state-updated** for refunds/voids — never duplicated.
- `P2002` unique-violation races are caught and treated as skips.
- Inventory writes are guarded by `PosImportedLineItem.inventoryTransactionId`
  (1:1), so re-imports never double-count.

---

## 7. Analytics integration

`PosAnalyticsService` performs the rollup in two idempotent steps:

1. **Inventory bridge** — `syncInventoryForTransaction` writes
   `inventory_transactions` rows (`transaction_type = 'sale_pos'`, negative
   `quantity_change`, `source = pos:<provider>:<txnId>`) for each **mapped** line
   item. This makes card sales appear in the existing live vendor analytics + CSV
   export with no mobile changes beyond the SQL patch.
2. **Snapshot rollup** — `recomputeSnapshots(vendorId, dates)` recomputes the POS
   contribution to `analytics_snapshots` (revenue + units) per affected date,
   fully derived from `pos_imported_transactions` (re-runnable, no drift).

> Run `docs/supabase/phase12_pos_integrations.sql` first to allow the `sale_pos`
> transaction type on the existing CHECK constraint.

---

## 8. BullMQ jobs

| Queue | Job | Producer | Consumer |
| --- | --- | --- | --- |
| `pos-sync` | `sync-connection` | Manual API, scheduler, webhooks | `PosSyncProcessor` (concurrency 5) |
| `pos-aggregation` | `aggregate-vendor` | `PosSyncService` after import | `PosAggregationProcessor` (concurrency 3) |

Defaults (in `AppModule`): 5 attempts, exponential backoff (5s base), completed
jobs trimmed after 24h, failed kept 7d. Sync jobs use a deterministic `jobId`
per sync run for de-dupe.

---

## 9. REST endpoints

### Vendor (`SupabaseAuthGuard` + role `vendor`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/pos/connections` | Create connection (returns `authorizeUrl` for OAuth). |
| GET | `/pos/connections` | List the vendor's connections. |
| GET | `/pos/connections/:id` | Get one connection. |
| DELETE | `/pos/connections/:id` | Disconnect (purges credentials + remote webhook). |
| POST | `/pos/connections/:id/webhook` | (Re)register the provider webhook subscription. |
| POST | `/pos/connections/:id/sync` | Trigger manual/backfill sync. |
| GET | `/pos/connections/:id/sync-runs` | Recent sync runs. |
| GET | `/pos/transactions` | Query normalized imported transactions. |
| GET | `/pos/mappings/products` | List product mappings (resolve unmatched items). |
| PUT | `/pos/mappings/products` | Map/ignore a provider catalog item. |

### Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health/live` | Liveness — always 200 while the process is up. |
| GET | `/health` (and `/health/ready`) | Readiness — checks DB + Redis; 200 when up, 503 when degraded. |
| GET | `/pos/oauth/:provider/callback` | OAuth redirect target (uses `state`). |
| POST | `/pos/webhooks/:provider` | Provider webhook receiver (raw body, verified). |

> The service is crash-resilient at boot: missing provider credentials, a missing
> `POS_CREDENTIAL_KEY`, or unreachable Postgres/Redis do **not** prevent startup.
> Provider/credential errors surface per-request (4xx/5xx) or as recorded sync
> errors, and `/health` reports dependency status for orchestrators.

### Admin (`SupabaseAuthGuard` + role `admin`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/pos/connections` | All connections (filter by provider/status). |
| GET | `/admin/pos/sync-runs` | Sync run history. |
| GET | `/admin/pos/errors` | Error log. |
| POST | `/admin/pos/connections/:id/resync` | Force a backfill resync. |
| GET | `/admin/pos/queues` | BullMQ job counts per queue (waiting/active/failed/…). |
| GET | `/admin/pos/queues/:name/failed` | Recent failed jobs on a queue (triage). |
| POST | `/admin/pos/queues/:name/retry` | Re-enqueue all failed jobs on a queue. |

---

## 9b. Resilience & observability

- **Retries/backoff:** all queues use `attempts: 5` with exponential backoff
  (`app.module.ts` `defaultJobOptions`). `PosSyncService.runSync` records the
  failure (sync run → `FAILED`, `PosSyncError`, connection → `ERROR`) and then
  **re-throws** so BullMQ retries; a later successful attempt flips the same run
  to `SUCCESS`. Completed jobs are trimmed; failed jobs retained 7 days.
- **Request logging + correlation id:** `RequestLoggingInterceptor` assigns an
  `x-request-id` (honoring an inbound one), echoes it on the response, and logs a
  structured line per request (`method`, `url`, `status`, `ms`).
- **Exception envelope:** `AllExceptionsFilter` returns a consistent JSON error
  body (`statusCode`, `message`, `path`, `requestId`, `timestamp`); 5xx are logged
  with a stack — the hook point for an error tracker (e.g. Sentry).
- **Queue visibility:** the admin queue endpoints above expose counts, failed-job
  triage, and bulk retry without extra infrastructure.

---

## 10. Setup

```bash
cd backend
cp .env.example .env            # fill DATABASE_URL, REDIS_*, POS_CREDENTIAL_KEY, SUPABASE_JWT_SECRET, provider creds
docker compose up -d            # local Postgres + Redis (optional; or use hosted Supabase + Redis)
npm install
npm run prisma:generate
npm run start:dev
```

Local dependencies are defined in `backend/docker-compose.yml` (Postgres 16 +
Redis 7).

Run the (infra-free) tests with `npm test`:

- **Unit:** credential encryption, Square webhook signature verification /
  normalization / subscription create+delete, provider registry, the
  `SupabaseAuthGuard` JWT → role/`vendorId` resolution (mocked `jose` + Prisma),
  and the webhook event-relevance filter.
- **Integration (`test/pos-pipeline.integration.spec.ts`):** the real
  import → mapping → analytics pipeline against an in-memory Prisma double —
  covers idempotent imports, refund state updates, product auto-matching,
  inventory bridging, and snapshot rollups. Swap the double for a
  `PrismaService` on a test database to run the same specs against Postgres.
- **Smoke (`test/square-sync.smoke.spec.ts`):** end-to-end Square path with a
  mocked HTTP layer — OAuth code exchange → location resolution → Orders Search →
  normalization → import → inventory bridge → analytics snapshot. Proves the
  connect+sync flow against realistic Square JSON without live credentials.

### Applying the database changes

Run the two SQL files **in order** against the database that holds the existing
Rooted tables:

1. `docs/supabase/phase12_pos_integrations.sql` — patches existing tables
   (adds the `sale_pos` inventory transaction type + index).
2. `docs/supabase/phase12b_pos_tables.sql` — creates the new `pos_*` tables,
   enums, indexes, and foreign keys. **Idempotent** (safe to re-run if a prior
   attempt partially applied). No changes to existing tables.
3. `docs/supabase/phase12c_pos_rls.sql` — enables RLS on all `pos_*` tables
   with **no policies**, so the Supabase anon/authenticated API cannot read POS
   data; the NestJS backend (`postgres` role) is unaffected.

> Do **not** run `prisma migrate dev/deploy` against the shared Supabase
> database — Prisma would try to manage the whole schema (including the existing
> tables modeled as a subset) and could issue destructive changes. `prisma
> migrate` is only appropriate against a throwaway local Postgres. Regenerate
> `phase12b_pos_tables.sql` after schema changes with:
>
> ```bash
> prisma migrate diff \
>   --from-schema-datamodel <existing-only-models>.prisma \
>   --to-schema-datamodel prisma/schema.prisma --script
> ```

Generate a credential key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Prerequisites:** PostgreSQL (the Supabase DB) and Redis. The backend service
account should connect with a role that can write `inventory_transactions` /
`analytics_snapshots` for any vendor (service role, or RLS policies per the note
in the SQL patch).

---

### Deployment (Docker)

The backend ships a multi-stage `backend/Dockerfile` (build → prune → run as
non-root `node`, with a container `HEALTHCHECK` hitting `/health/live`).

Run the full stack (API + Postgres + Redis) locally:

```bash
cd backend
cp .env.example .env   # set POS_CREDENTIAL_KEY + SUPABASE_JWT_SECRET + provider creds
docker compose up -d --build
```

The `api` service waits for Postgres/Redis to be healthy and overrides
`DATABASE_URL`/`REDIS_HOST` to the compose service names. For production, point
`DATABASE_URL` at the hosted Supabase database and apply the SQL files manually
(do not run `prisma migrate` against it).

CI runs on every backend change (`.github/workflows/backend-ci.yml`):
install → `prisma generate` → typecheck → test → build.

### Mobile vendor experience

The Expo app talks to this backend over REST, authenticating with the vendor's
Supabase access token (`Authorization: Bearer <token>`, verified by
`SupabaseAuthGuard`). Set `EXPO_PUBLIC_API_URL` in the mobile app to the backend
base URL (use a LAN IP or tunnel, not `localhost`, so a device can reach it). If
it is unset, POS features hide themselves gracefully.

- `mobile/src/lib/api.ts` — thin fetch wrapper that injects the Supabase token.
- `mobile/src/lib/pos-api.ts` — typed POS endpoint client.
- `app/(vendor)/pos/index.tsx` — list connections + "Connect Square" (opens the
  OAuth flow via `WebBrowser.openAuthSessionAsync`; backend bounces back to the
  `APP_DEEP_LINK`, which must match the app scheme `mobile://pos/connected`).
- `app/(vendor)/pos/[id].tsx` — connection status, manual "Sync now", recent sync
  runs, and disconnect.
- `app/(vendor)/pos/mappings.tsx` — match imported register items to Rooted
  products (or ignore them).
- `app/(vendor)/analytics.tsx` — folds POS card-sale revenue (`netAmount`) in as a
  third revenue channel alongside reservations and in-person sales.

## 11. Outstanding provider verification

Search the codebase for `TODO: verify with provider docs`. Key items:

- **Toast:** partner auth flow (client credentials), `ordersBulk` params &
  pagination, money units (decimal→cents), webhook signature scheme, hostnames.
- **Clover:** prod/sandbox/regional hosts, OAuth v2 refresh behavior, order/payment
  field shapes, webhook verification header.
- **Square:** confirm the pinned `Square-Version` and webhook subscription setup.
- **Security:** `SupabaseAuthGuard` now verifies HS256 Supabase access tokens via
  `SUPABASE_JWT_SECRET` and resolves the app role + `vendorId` from the database.
  Projects using **asymmetric** Supabase signing keys must switch to JWKS
  verification (`createRemoteJWKSet`) — marked `TODO: verify with provider docs`.
