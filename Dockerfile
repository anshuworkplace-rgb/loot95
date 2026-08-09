# ═══════════════════════════════════════════════════════════════
# LOOT 95 — Production Render Dockerfile
# Ultra-reliable production build for Render web service
# ═══════════════════════════════════════════════════════════════

FROM node:20-alpine

WORKDIR /app

ENV PORT=3001
ENV NODE_ENV=production

COPY package*.json ./

RUN npm install

COPY tsconfig*.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY src ./src
COPY public ./public
COPY index.html ./index.html

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/server.js"]
