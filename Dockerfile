# ═══════════════════════════════════════════════════════════════
# LOOT 95 — Production Multi-Stage Dockerfile
# Optimized for zero-cost / low-cost production hosting (Koyeb/Render/VPS)
# ═══════════════════════════════════════════════════════════════

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY src ./src
COPY public ./public
COPY index.html ./index.html

RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV PORT=3001

COPY package*.json ./
RUN npm install

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
