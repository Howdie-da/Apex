# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json ./server/

RUN npm ci --workspace=server

COPY server/ ./server/

RUN npm run build -w server


# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json ./server/

RUN npm ci --workspace=server --omit=dev

COPY --from=builder /app/server/dist ./server/dist

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
