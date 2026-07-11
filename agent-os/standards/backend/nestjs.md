# Backend (NestJS)

## Structure

- `backend/src/modules/` — feature modules (markets, pos, admin-agent, stripe, health)
- `backend/src/common/` — auth guards, crypto, redis, observability
- `backend/prisma/schema.prisma` — ORM schema (Supabase Postgres)
- Entry: `backend/src/main.ts` — CORS, validation pipe, raw body for webhooks

## Modules pattern

Each module: `*.module.ts`, controllers, services, DTOs with `class-validator`. Register in `app.module.ts`.

## Auth

- `SupabaseAuthGuard` verifies JWT via JWKS (`SUPABASE_URL`)
- `@Roles()` decorator + `RolesGuard` for admin/vendor routes
- Legacy HS256: `SUPABASE_JWT_SECRET` (omit for ES256 projects)

## Jobs and cron

- BullMQ queues when `POS_QUEUES_ENABLED=true` + `REDIS_URL`
- Market/admin agents gated by `*_AGENT_ENABLED` env flags

## Build and run

```powershell
cd backend
npm run start:dev    # port 4000
npm run build
```

## Health

- `/health/live` — liveness (Railway health check)
- `/health/ready` — DB + Redis readiness
