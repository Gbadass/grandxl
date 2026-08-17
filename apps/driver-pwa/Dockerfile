FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY packages/utils/package.json ./packages/utils/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/config/package.json ./packages/config/
COPY apps/driver-pwa/package.json ./apps/driver-pwa/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm --filter @grandxl/types build
RUN pnpm --filter @grandxl/validators build
RUN pnpm --filter @grandxl/utils build
RUN pnpm --filter @grandxl/ui build
RUN pnpm --filter @grandxl/api-client build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @grandxl/driver-pwa build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/driver-pwa/dist /usr/share/nginx/html
COPY apps/driver-pwa/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
