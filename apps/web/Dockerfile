FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
COPY packages/utils/package.json ./packages/utils/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/config/package.json ./packages/config/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @grandxl/types build
RUN pnpm --filter @grandxl/validators build
RUN pnpm --filter @grandxl/utils build
RUN pnpm --filter @grandxl/ui build
RUN pnpm --filter @grandxl/api-client build
ARG VITE_API_URL
ARG VITE_SENTRY_DSN_WEB
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN_WEB=$VITE_SENTRY_DSN_WEB
# Google Maps key intentionally NOT bundled. All map/geocoding calls now
# route through the API's /maps/* endpoints (Deploy B) — the key stays
# server-side in GOOGLE_MAPS_API_KEY on the api container.
RUN pnpm --filter @grandxl/web build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
