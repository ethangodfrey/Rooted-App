# Agent workflow

## Priority order (each run)

1. Broken UX — map pins, market links, auth spinners, role routing
2. Data quality — schedules, dead links, market classification
3. TypeScript / build gates — see verification matrix below
4. Small safe improvements — performance, copy, null checks

## Code change rules

- Match existing style; **minimal diffs**
- No force-push, no amend of pushed commits, **no secrets in git**
- End every run with: what you checked, what changed, commands run, what to do next

## Verification commands

### Build gates (repo root)

```bash
npm run build:web              # Vite SPA — isolated from tenant-web
npm run build:tenant-web       # Next.js edge gateway
cd backend && npm run build
cd mobile && npx tsc --noEmit
```

### Smoke auditors

```bash
npm run smoke:ui-baseline      # 10/10 source, 9/9 production markers
npm run smoke:settlement       # PASS_LAZY_CHUNK (BLOCKED_AUTH without creds = OK)
```

### Full-stack + Phase 83

```bash
npm test                       # Phase 4–9 orchestrator (financial → phase83)
npm run test:phase83:amend     # Static Phase 83 presence check
npm run test:web               # Web Vitest unit tests
```

### Market data (repo root)

```bash
npm run markets:dedupe
npm run markets:classify -- --limit 5
```

Full matrix: [`docs/VERIFICATION_AND_TESTING.md`](../../../docs/VERIFICATION_AND_TESTING.md).
