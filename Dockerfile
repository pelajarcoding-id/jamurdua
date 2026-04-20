FROM node:20-bullseye-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl libssl1.1 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM node:20-bullseye-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV AUTH_URL=http:/187.127.107.15:3000
ENV AUTH_TRUST_HOST=true
ENV AUTH_SECRET=build-secret
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=build-secret
RUN apt-get update && apt-get install -y --no-install-recommends openssl libssl1.1 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl libssl1.1 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd -r app && useradd -r -g app app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /app/public/uploads && chown -R app:app /app/public/uploads
USER app
EXPOSE 3000
CMD ["npm","run","start"]