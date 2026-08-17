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

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/apps/admin
CMD ["node", ".next/standalone/apps/admin/server.js"]
