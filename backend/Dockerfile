# syntax=docker/dockerfile:1
#
# Build context MUST be the repository root (not backend/).
# Railway: set service Root Directory to repo root, dockerfilePath=backend/Dockerfile
# (see backend/railway.toml). This allows installing @vendorly/env-config via file:.

# ---- Builder: install deps, generate Prisma client, compile TS ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Shared env guardrails package (file: dependency for backend)
COPY packages/env-config/package*.json ./packages/env-config/
RUN npm ci --prefix packages/env-config
COPY packages/env-config ./packages/env-config
RUN npm run build --prefix packages/env-config

COPY backend/package*.json ./backend/
RUN npm ci --prefix backend

COPY backend/prisma ./backend/prisma
RUN npm run prisma:generate --prefix backend

COPY backend/tsconfig*.json backend/nest-cli.json ./backend/
COPY backend/src ./backend/src
RUN npm run build --prefix backend

# ---- Runner: production-only deps + compiled output ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Railway public proxy maps service traffic to this container port.
# Keep default aligned with deploy/ingress.targets.json BACKEND.CONTAINER_PORT.
ENV PORT=4000

RUN apk add --no-cache openssl libc6-compat

COPY packages/env-config/package*.json ./packages/env-config/
COPY --from=builder /app/packages/env-config/dist ./packages/env-config/dist
COPY --from=builder /app/packages/env-config/node_modules ./packages/env-config/node_modules
COPY packages/env-config/package.json ./packages/env-config/package.json

COPY backend/package*.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

WORKDIR /app/backend
RUN npm prune --omit=dev

USER node

EXPOSE 4000

# Probe the same path Railway healthcheckPath uses (/api/health), via $PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.PORT||'4000';fetch('http://127.0.0.1:'+p+'/api/health').then(async r=>{const t=await r.text();process.exit(r.ok&&t.includes('HEALTH')?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]