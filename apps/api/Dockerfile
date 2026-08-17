# Multi-stage build: builder compiles TypeScript, runner is the lean production image

FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all deps (needed for shared packages)
RUN pnpm install --frozen-lockfile

# Build shared packages first, then the API
RUN pnpm --filter @grandxl/types build
RUN pnpm --filter @grandxl/utils build
RUN pnpm --filter @grandxl/validators build
RUN pnpm --filter @grandxl/api build

# ── Production runner ────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy only what the production server needs
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main"]
