# Verification and testing

Repo-root scripts exercise platform phases without a live database. Use them after substantive changes to financial, logistics, payments, admin, notifications, or Phase 83 surfaces.

## Quick reference

| Goal | Command | Pass signal |
|------|---------|-------------|
| Full Phase 4–9 stack | `npm test` or `npm run test:full-stack` | `FULL_STACK_VERIFIED`, `PLATFORM_READY_FOR_STAGING` |
| Phase 83 amend only | `npm run test:phase83:amend` | `PHASE83_AMEND_VERIFIED` |
| Web unit tests (Vitest) | `npm run test:web` | exit 0 |
| Backend unit tests (Jest) | `npm test --prefix backend` | exit 0 |
| Isolated web build | `npm run build:web` | exit 0 |
| Isolated tenant-web build | `npm run build:tenant-web` | exit 0 |
| Production bundle smoke | `npm run smoke:ui-baseline` | 10/10 source, 9/9 production markers |
| Settlement lazy-chunk smoke | `npm run smoke:settlement` | `PASS_LAZY_CHUNK` |

See [`agent-os/standards/deploy/production.md`](../agent-os/standards/deploy/production.md) for the full build/smoke baseline.

## Full-stack orchestrator (`npm test`)

`scripts/verify-full-stack.ts` runs these suites in order (any failure aborts):

1. `test:financial:clearing`
2. `test:financial:ui`
3. `test:logistics:fulfillment`
4. `test:logistics:ui`
5. `test:payments:stripe`
6. `test:payments:ui`
7. `test:admin:dashboard`
8. `test:admin:disputes`
9. `test:notifications:engine`
10. `test:phase83:amend`

Success lines (uppercase, no emoji):

```
FULL_STACK_VERIFICATION_INITIALIZED
SUITE_PASS <LABEL>
FULL_STACK_VERIFIED
PLATFORM_READY_FOR_STAGING
```

Failure line: `FULL_STACK_VERIFICATION_FAILED <reason>` or `SUITE_FAILED <LABEL> EXIT=<code>`.

**When to run:** before staging deploys or after touching financial clearing, logistics, Stripe payments, admin dashboards, notifications, or Phase 83 vendor-network code.

**When not to run:** quick web-only UI tweaks — use `npm run build:web` and `npm run test:web` instead.

## Phase 83 amend verifier

`npm run test:phase83:amend` (`scripts/verify-phase83-amend.ts`) is a static presence check — it does not hit Supabase or Nest at runtime.

It asserts:

- SQL scripts `phase83a` / `phase83b` and `docs/PHASE83_DEFERRED_FEATURES_AMEND.md` exist
- Nest `vendor-network` module files (classification, V2V connections, flash promo)
- Web routes in `App.tsx` (`mix-analytics`, `analytics`, `load-in`, messaging, creator shell)
- Prisma markers (`cottageFoodDisclosure`, `isFollowing`, `themeSettings`)
- Legacy `ChatThread.tsx` preserved alongside `RealtimeChatThread.tsx`
- `flash-sale.ts` contains no emoji characters

See [`docs/PHASE83_DEFERRED_FEATURES_AMEND.md`](PHASE83_DEFERRED_FEATURES_AMEND.md) for SQL apply order and API surfaces.

## Web unit tests (Vitest)

```bash
cd web && npm test          # vitest run
cd web && npm run test:watch
# or from repo root:
npm run test:web
```

Specs live beside source under `web/src/lib/*.spec.ts`. Current coverage targets pure utilities:

| Spec | Module exercised |
|------|------------------|
| `market-links.spec.ts` | Market URL normalization |
| `pickup-schedule.spec.ts` | Pickup window parsing |
| `vendor-financials.spec.ts` | Vendor payout math |
| `geo.spec.ts`, `format.spec.ts` | Geo + display helpers |
| `event-*.spec.ts`, `dedupe-events.spec.ts` | Event listing/scheduling |
| `settlement-calculator.spec.ts`, `pos-transactions.spec.ts` | Settlement/POS helpers |

Add specs only for deterministic pure functions — no Supabase or browser DOM.

## Backend unit tests (Jest)

```bash
cd backend && npm test
```

Key areas with `.spec.ts` coverage:

- `modules/stripe/payments-gateway.*` — dual-payment gateway + mock transaction paths
- `modules/b2b/b2b.isolation` — tenant isolation (`npm run test:b2b:isolation`)
- `modules/pos/*` — line items, webhooks, Square adapter
- `common/auth/supabase-auth.guard` — JWT guard behavior

Platform e2e (requires running API): `npm run test:e2e:platform --prefix backend`.

## Domain-specific verify scripts

Root `package.json` exposes `test:*` scripts for individual phases (wholesale, discovery, loyalty, deploy resilience, etc.). Each `scripts/verify-*.ts` file documents its own success lines in a header comment.

Examples:

```bash
npm run test:orders:partition-strategy
npm run test:discovery:production-sync-cron
npm run test:wholesale:logistics-service
npm run test:integration:pre-merge
```

`npm run test:all` runs the health-efficiency regression bundle (`scripts/run-health-efficiency-regression.ts`).

## Production smoke auditors

| Script | What it checks |
|--------|----------------|
| `npm run smoke:ui-baseline` | Source route nodes + production bundle markers |
| `npm run smoke:settlement` | Lazy vendor/admin chunks reference `api.vendorlymarketplace.app` |
| `npm run smoke:boundaries` | Production boundary env separation |

`smoke:settlement` without `SMOKE_VENDOR_EMAIL` / `SMOKE_VENDOR_PASSWORD` reports `BLOCKED_AUTH` for UI segments — expected, not a failure.

## Operational health audit

For live incidents (queue jams, DB pool, ingest 5xx), use:

```bash
npm run health:audit
npm run health:audit -- --json
```

See [`docs/maintenance/agent-playbook.md`](maintenance/agent-playbook.md).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `SUITE_FAILED FINANCIAL_CLEARING` | Stale settlement math or type drift | Run `npm run test:financial:clearing` alone; inspect `scripts/verify-financial-clearing.ts` |
| `PHASE83_AMEND_FAILED ROUTE_MISSING` | `App.tsx` route not registered | Add route per Phase 83 doc |
| `PHASE83_AMEND_FAILED MARKER_MISSING` | Nest module or Prisma field renamed | Align with `verify-phase83-amend.ts` `BACKEND_MARKERS` |
| `npm run test:web` fails | Utility regression | Run single spec: `cd web && npx vitest run src/lib/<name>.spec.ts` |
| Full stack slow | 10 sequential suites | Run only the affected `test:*` script during iteration |
