FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.1 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @grandxl/types build
RUN pnpm --filter @grandxl/utils build
RUN pnpm --filter @grandxl/validators build
RUN pnpm --filter @grandxl/api build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/api/dist/main"]
