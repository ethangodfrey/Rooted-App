# Cursor Agent — Autonomous Maintenance Playbook

**Audience:** You (the Cursor Cloud Agent) when the lead developer is offline during the two-week maintenance window.

**Platform:** Vendorly marketplace — Vite/React web (Vercel), NestJS API (Railway), Next.js/tenant-web POS ingest (Vercel), Upstash Redis (BullMQ), Supabase PostgreSQL.

**First action on every incident:** Run `npm run health:audit` from the repo root and paste the terminal summary into your run notes.

---

## 1. Triage workflow

When a human reports a production issue (Slack, email, GitHub issue, or automation alert):

1. **Run the health audit**
   ```bash
   npm run health:audit
   npm run health:audit -- --json   # machine-readable output for logs
   ```
2. **Read logs** before changing code:
   - **Vercel:** Deployments → Functions → `api/webhooks/pos-sync` (ingest 5xx, Redis enqueue failures)
   - **Railway:** NestJS service logs (Prisma errors, unhandled rejections, OOM)
   - **Upstash:** Redis console → monitoring (connection spikes, command latency)
   - **Supabase:** Dashboard → Logs → Postgres (connection limit, slow queries, deadlocks)
3. **Map the failing check** to a section below (queue jam, DB pool, ingest route).
4. **Apply the smallest safe fix** — prefer config/ops over large refactors.
5. **Re-run** `npm run health:audit` and relevant smoke tests (`npm run test:webhook` if ingest changed).
6. **End with a run summary:** what you checked, what changed, commands run, what to do next.

---

## 2. Queue jams & dead-letter cleanup

### Symptoms

- `health:audit` reports **failed jobs above threshold** on `pos-inventory-ingest`, `pos-inventory-flush`, `pos-sync`, or `pos-aggregation`
- Inventory updates stop appearing in `/vendor/pos/activity` live feed
- Vercel ingest returns **503** (`Failed to enqueue inventory webhook`)
- Same `failedReason` repeating across many jobs (poison-pill payload)

### Diagnosis

```bash
npm run health:audit -- --json
# Inspect details.recentFailures per queue
```

Confirm workers are running:

- **Inventory path:** `cd backend && npm run pos:inventory-worker` (or Railway worker service)
- **Transaction sync path:** NestJS API with `POS_QUEUES_ENABLED=true` and BullMQ processors registered

### Auto-patch procedure (poison-pill blocking queue)

1. **Identify the blocking job** — note `queue`, `id`, and `failedReason` from audit JSON.
2. **Inspect payload** (read-only) via Redis/BullMQ or backend logs; do not replay unknown payloads to production DB.
3. **Remove poison jobs** from the failed set for that queue only:

   ```typescript
   // One-off repair snippet — run via npx tsx in repo root after loading REDIS_URL
   import { Queue } from 'bullmq';
   // connection from REDIS_URL (same pattern as scripts/autonomous-health-check.ts)
   const queue = new Queue('pos-inventory-ingest', { connection });
   const failed = await queue.getFailed(0, 100);
   for (const job of failed) {
     if (job.failedReason?.includes('YOUR_SIGNATURE_HERE')) {
       await job.remove();
     }
   }
   await queue.close();
   ```

   Prefer removing **specific** failed job IDs. Use `queue.clean(0, 1000, 'failed')` only when the entire failed set is known bad (e.g. staging test burst).

4. **Drain delayed backlog** if coalesce flushes are stuck:
   - Check `pos-inventory-flush` delayed count in audit output
   - Ensure `pos:inventory-worker` is running with concurrency 10+
5. **Verify:** `npm run health:audit` → failed count back under threshold; trigger `npm run test:webhook` (uses load-test bypass when configured).

### Prevention

- Keep `removeOnFail: { age: 604_800 }` (7 days) — do not disable without DLQ monitoring
- Never block the Vercel ingest route on DB writes — enqueue only

---

## 3. Database connectivity & query safety

### Symptoms

- `health:audit` **Supabase PostgreSQL** check fails or warns on slow response (>3s)
- Railway `/health/ready` returns `"db":"down"`
- Logs: `Timed out fetching a new connection from the connection pool`, `too many connections`, `statement timeout`

### Diagnosis

1. Confirm `DATABASE_URL` uses Supabase **transaction pooler** (port **6543**), not direct 5432 in serverless/worker contexts.
2. Run audit: `npm run health:audit` — review `tableCounts` and `pingMs`.
3. Search backend logs for unhandled `PrismaClientKnownRequestError` or promise rejections.

### Auto-patch procedure

1. **Immediate relief (ops):**
   - Reduce worker concurrency temporarily (`PosInventoryWorker` ingest concurrency 20 → 5)
   - Set `POS_QUEUES_ENABLED=false` on API only if Redis is down — never as first resort for DB slowness
   - Restart Railway service to clear leaked connections

2. **Code fixes (atomic, safe limits):** When refactoring hot paths (e.g. `pos-activity-dashboard.service.ts`, `pos-inventory-sync.service.ts`):

   - Add hard `take` limits on `findMany` (already 60/20 in dashboard — preserve or lower under incident)
   - Replace unbounded `Promise.all` over large arrays with **batched** queries (`chunk(size 50)`)
   - Wrap heavy aggregates in `prisma.$transaction` only when needed; prefer read-only parallel counts
   - Add `try/catch` at job processor boundary so one bad row does not crash the worker process

   Example batching pattern:

   ```typescript
   const BATCH = 50;
   for (let i = 0; i < ids.length; i += BATCH) {
     const slice = ids.slice(i, i + BATCH);
     await prisma.product.updateMany({ where: { id: { in: slice } }, data: { ... } });
   }
   ```

3. **Verify:** `curl $PUBLIC_BASE_URL/health/ready` and `npm run health:audit`.

Reference: `agent-os/standards/deploy/troubleshooting.md` § `/health/ready` 503.

---

## 4. Vercel ingest route failures

### Symptoms

- `health:audit` **Vercel POS ingest route** → 404 or 5xx
- Square webhook retries flooding logs

### Diagnosis

- Probe URL (default): `https://vendorly-marketplace1.vercel.app/api/webhooks/pos-sync?provider=SQUARE` (**Vendorly_Marketplace1**)
- Expect: `200` + `{ "ok": true, "endpoint": "pos-sync-ingest" }`
- Check root `vercel.json` — `/api/*` must **not** rewrite to SPA index

### Auto-patch procedure

1. **404:** Confirm `api/webhooks/pos-sync.ts` exists and latest main is deployed to Vercel production.
2. **503 on POST:** Usually `REDIS_URL` missing on Vercel — set Upstash TCP URL in Vercel env, redeploy.
3. **401 on POST:** `SQUARE_WEBHOOK_SIGNATURE_KEY` mismatch — align with Square Developer dashboard notification URL (`POS_INVENTORY_WEBHOOK_URL`).
4. **Verify:** `npm run health:audit` + `npm run test:webhook`.

---

## 5. Escalation & guardrails

| Situation | Agent action |
|-----------|--------------|
| Failed jobs < threshold, ingest 200 | Monitor; no code change |
| Failed jobs > threshold, repeating same reason | Remove poison jobs (§2), redeploy worker if crashed |
| DB pool timeout | Batch/limit queries (§3), verify pooler URL |
| Ingest 5xx | Fix Vercel `REDIS_URL`, redeploy web |
| Data corruption suspected | **Stop auto-patching** — document findings, do not run `clean('failed')` wholesale |

**Never:** force-push, commit secrets, disable RLS, run destructive SQL without explicit human approval.

**Always:** `npm run build` (backend + web) after code changes; commit on `cursor/*-428e` branch and open/update PR.

---

## 6. Scheduled automation (optional)

Run every 15–30 minutes during the maintenance window:

```bash
npm run health:audit -- --json >> /var/log/vendorly-health.jsonl
```

Exit code `1` → alert on-call or trigger a Cursor Cloud Agent run with this playbook attached.

---

## 7. Key files reference

| Area | Path |
|------|------|
| Health audit script | `scripts/autonomous-health-check.ts` |
| Webhook load test | `scripts/test-pos-webhook.ts` |
| Vercel ingest | `api/webhooks/pos-sync.ts` |
| Tenant-web ingest | `tenant-web/src/app/api/webhooks/pos-sync/route.ts` |
| Inventory worker | `backend/scripts/run-pos-inventory-worker.ts` |
| Queue constants | `backend/src/modules/pos/jobs/pos-inventory-queue.constants.ts` |
| Activity dashboard API | `backend/src/modules/pos/services/pos-activity-dashboard.service.ts` |
| Deploy troubleshooting | `agent-os/standards/deploy/troubleshooting.md` |
