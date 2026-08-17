FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.1 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/ ./packages/
COPY apps/admin/ ./apps/admin/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @grandxl/types build
RUN pnpm --filter @grandxl/utils build
RUN pnpm --filter @grandxl/ui build
RUN pnpm --filter @grandxl/api-client build
RUN pnpm --filter @grandxl/admin build

# Copy static assets into standalone output (Next.js doesn't include these automatically)
RUN cp -r /app/apps/admin/.next/static /app/apps/admin/.next/standalone/apps/admin/.next/static
RUN cp -r /app/apps/admin/public /app/apps/admin/.next/standalone/apps/admin/public 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/apps/admin/.next/standalone
CMD ["node", "apps/admin/server.js"]
