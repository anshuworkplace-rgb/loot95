# ═══════════════════════════════════════════════════════════════
# LOOT 95 — Production Render Dockerfile
# Optimized for Render Free Tier (512MB RAM Limit)
# ═══════════════════════════════════════════════════════════════

FROM node:20-alpine

WORKDIR /app

ENV PORT=3001
ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --omit=dev

COPY dist ./dist

EXPOSE 3001

CMD ["node", "dist/server.js"]
