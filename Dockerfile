FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl python3 make g++
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public
ENV DATABASE_URL="postgresql://titan:build-only-password@postgres:5432/titan"
RUN npx prisma generate
RUN npm run check:encoding
RUN npm run check:imports
RUN npm run validate:types
RUN npm run validate:build
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN apk add --no-cache libc6-compat openssl curl python3
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/scripts/generate-totp-qr.py ./scripts/generate-totp-qr.py
COPY --from=builder /app/vendor/python ./vendor/python
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["sh","-c","npx prisma db push && npx prisma db seed && node server.js"]
