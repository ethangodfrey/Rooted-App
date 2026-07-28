# syntax=docker/dockerfile:1
#
# DOCKERFILE_PATHS_FIXED — build context MUST be the repository root (not backend/).
# Railway: Root Directory = repo root (empty / "."), dockerfilePath=backend/Dockerfile
# (see backend/railway.toml). This allows installing @vendorly/env-config via file:.
#
# CACHE_INVALIDATED — 2026-07-28 bust broken apk/cache layers that referenced a
# missing packages/env-config/package.json checksum from an old backend/-only context.

# ---- Builder: install deps, generate Prisma client, compile TS ----
FROM node:22-alpine AS builder
WORKDIR /app

# CACHE_INVALIDATED: force fresh apk layer (corrupted runc/cache on prior deploys)
ARG CACHE_BUST=2026-07-28-dockerfile-paths-fixed
RUN echo "CACHE_INVALIDATED=${CACHE_BUST}" \
  && echo "DOCKERFILE_PATHS_FIXED CONTEXT=REPO_ROOT" \
  && apk add --no-cache openssl libc6-compat

# Shared env guardrails package (file: dependency for backend).
# Copy the full package (node_modules/dist excluded by root .dockerignore) so
# npm prepare + tsc see package.json, lockfile, tsconfig, scripts, and src.
COPY packages/env-config/package.json packages/env-config/package-lock.json \
     packages/env-config/tsconfig.json ./packages/env-config/
COPY packages/env-config/scripts ./packages/env-config/scripts
COPY packages/env-config/src ./packages/env-config/src
RUN npm ci --prefix packages/env-config \
  && npm run build --prefix packages/env-config \
  && echo "DOCKERFILE_PATHS_FIXED PACKAGE=@vendorly/env-config"

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend

COPY backend/prisma ./backend/prisma
RUN npm run prisma:generate --prefix backend

COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./backend/
COPY backend/src ./backend/src
RUN npm run build --prefix backend
# Prune in builder so the runner never re-invokes file: prepare hooks.
WORKDIR /app/backend
RUN npm_config_ignore_scripts=true npm prune --omit=dev \
  && echo "DOCKERFILE_PATHS_FIXED BUILDER_PRUNED"

# ---- Runner: production-only deps + compiled output ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Railway public proxy maps service traffic to this container port.
# Keep default aligned with deploy/ingress.targets.json BACKEND.CONTAINER_PORT.
ENV PORT=4000

# CACHE_INVALIDATED: fresh runner apk layer (paired with builder bust)
ARG CACHE_BUST=2026-07-28-dockerfile-paths-fixed
RUN echo "CACHE_INVALIDATED=${CACHE_BUST}" \
  && apk add --no-cache openssl libc6-compat

# Prefer builder artifacts so the runner stage never re-reads monorepo paths
# from a misconfigured (backend/-only) build context.
COPY --from=builder /app/packages/env-config/package.json ./packages/env-config/package.json
COPY --from=builder /app/packages/env-config/package-lock.json ./packages/env-config/package-lock.json
COPY --from=builder /app/packages/env-config/dist ./packages/env-config/dist
COPY --from=builder /app/packages/env-config/node_modules ./packages/env-config/node_modules

COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/package-lock.json ./backend/package-lock.json
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

WORKDIR /app/backend
RUN echo "DOCKERFILE_PATHS_FIXED RUNNER_READY"

USER node

EXPOSE 4000

# Probe the same path Railway healthcheckPath uses (/api/health), via $PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.PORT||'4000';fetch('http://127.0.0.1:'+p+'/api/health').then(async r=>{const t=await r.text();process.exit(r.ok&&t.includes('HEALTH')?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
