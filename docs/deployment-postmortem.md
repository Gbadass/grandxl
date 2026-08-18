# GrandXL Production Deployment — Complete Post-Mortem

A full record of every error, root cause, and fix encountered deploying a pnpm Turborepo
monorepo (NestJS API + Next.js Admin + Vite Web + Vite Driver PWA) to a bare Ubuntu 24.04
VPS on Namecheap, with Docker Compose + Nginx + Let's Encrypt SSL.

---

## The Stack at a Glance

```
Namecheap VPS (Ubuntu 24.04) — 66.29.155.201
└── Docker Compose (docker-compose.prod.yml)
    ├── nginx          (reverse proxy, SSL termination)
    ├── api            (NestJS — port 3001)
    ├── web            (Vite React — served by nginx:80 inside container)
    ├── admin          (Next.js standalone — port 3001)
    ├── driver         (Vite PWA — served by nginx:80 inside container)
    ├── mongodb        (mongo:4.4 with replica set rs0)
    └── redis          (redis:7-alpine with password)
```

DNS (Namecheap):
- grandxl.com → A → 66.29.155.201
- www → CNAME → grandxl.com
- api → A → 66.29.155.201
- admin → A → 66.29.155.201
- rider → A → 66.29.155.201

---

## Part 1 — DNS & SSL

### What we did
1. Logged in to Namecheap → Advanced DNS → added A records for each subdomain.
2. Verified propagation: `ping api.grandxl.com` returned the VPS IP.
3. Ran certbot to issue a Let's Encrypt cert covering all four domains at once.

### Error 1 — `/var/www/certbot does not exist`

**Command that failed:**
```bash
certbot certonly --webroot -w /var/www/certbot -d grandxl.com ...
```

**Root cause:** The `certbot_data` volume in `docker-compose.prod.yml` is a *Docker named volume* —
it only exists *inside* the nginx container, not on the host filesystem. So `/var/www/certbot`
as a host path does not exist when certbot runs on the host.

**Fix — use standalone mode instead:**
```bash
# Stop nginx so certbot can bind port 80
docker compose -f docker-compose.prod.yml stop nginx

certbot certonly --standalone \
  -d grandxl.com -d www.grandxl.com -d api.grandxl.com -d admin.grandxl.com \
  --non-interactive --agree-tos -m admin@grandxl.com

# Copy certs to where nginx can read them
cp /etc/letsencrypt/live/grandxl.com/fullchain.pem /root/grandxl/nginx/ssl/fullchain.pem
cp /etc/letsencrypt/live/grandxl.com/privkey.pem   /root/grandxl/nginx/ssl/privkey.pem

docker compose -f docker-compose.prod.yml up -d nginx
```

**Lesson:** webroot mode requires nginx to be running AND serving the ACME challenge path from
the same directory certbot writes to. In Docker, those two things live in different namespaces.
Standalone is simpler for first-time issuance — certbot becomes its own temporary HTTP server.

### Auto-renewal

Certbot installs a systemd timer (`certbot.timer`) on Ubuntu automatically. It runs twice a day.
But after renewal, certs need to be copied and nginx needs to reload. We added a deploy hook:

```bash
# /etc/letsencrypt/renewal-hooks/deploy/grandxl.sh
#!/bin/bash
cp /etc/letsencrypt/live/grandxl.com/fullchain.pem /root/grandxl/nginx/ssl/fullchain.pem
cp /etc/letsencrypt/live/grandxl.com/privkey.pem   /root/grandxl/nginx/ssl/privkey.pem
docker compose -f /root/grandxl/docker-compose.prod.yml exec nginx nginx -s reload
```

Certbot calls every file in `renewal-hooks/deploy/` after a successful renewal. No cron needed.

Test it without actually renewing:
```bash
certbot renew --dry-run
```

---

## Part 2 — Docker Build Errors

### Error 2 — Node version mismatch (`node:20` vs CI Node 22)

**Symptom:** Builds failed pulling `node:20-alpine` metadata.

**Root cause:** The GitHub Actions CI workflow specifies `node-version: 22`. The Dockerfiles
originally had `FROM node:20-alpine`. On the server, Docker pulled node:20, but the lockfile
and some packages expected node:22 APIs.

**Fix:** Change every `FROM node:20-alpine` → `FROM node:22-alpine` in all four Dockerfiles.

**Lesson:** Always match the Node version in your Dockerfiles to what your CI uses. Treat the
lockfile as ground truth — if it was generated on node:22, run it on node:22.

---

### Error 3 — `pnpm: not found` / platform binary mismatch

**Symptom:**
```
npm install -g pnpm
sh: pnpm: not found
```

**Root cause:** `npm install -g pnpm` downloads a platform-specific binary. On a Mac that binary
is for `darwin-arm64`. When Docker builds on Linux (`linux-amd64`), the binary is wrong.

pnpm also stores its binary hash in `pnpm-lock.yaml`. If the installed binary doesn't match the
lockfile, pnpm refuses to run.

**Fix — use corepack (Node's built-in package manager manager):**
```dockerfile
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
```

Corepack downloads the correct binary for the current platform at build time, verified by hash.

**Lesson:** Never use `npm install -g pnpm` in Docker. Always use corepack. The version must
match the `packageManager` field in `package.json`:
```json
{ "packageManager": "pnpm@10.34.1" }
```

---

### Error 4 — Mac `node_modules` overwrote Linux `node_modules`

**Symptom:** Native binaries (like `esbuild`, `sharp`) failed with "wrong ELF class" or
"Exec format error" — the Linux container was running Mac ARM64 binaries.

**Root cause:** No `.dockerignore` file. The `COPY . .` instruction copied the entire project,
including your local `node_modules` (compiled for Mac). Docker ran `pnpm install` first into
a Docker layer, then `COPY . .` overwrote those Linux binaries with Mac ones.

**Fix — create `.dockerignore`:**
```
**/node_modules
**/.next
**/dist
**/.turbo
**/.git
**/*.log
**/coverage
**/.env
**/.env.*
```

**Lesson:** `.dockerignore` is as important as `.gitignore`. Without it, `COPY . .` brings
in your entire dev environment including OS-specific compiled binaries.

---

### Error 5 — `tsup: not found` during Docker build

**Symptom:**
```
sh: tsup: not found
```

**Root cause:** pnpm workspaces create *per-package* `node_modules`. When `tsup` is a
`devDependency` of `packages/types`, it lives in `packages/types/node_modules/.bin/tsup`,
not at the root. A multi-stage Dockerfile that copies only root `node_modules` to a runner
stage loses all package-level `node_modules`.

**Fix — remove the separate deps/runner stages. Single builder stage:**
```dockerfile
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
```

**Lesson:** pnpm workspaces and multi-stage Docker don't mix easily. The `pnpm deploy` command
exists for this purpose but requires careful setup. For a monorepo, a single builder stage that
keeps the full workspace is the pragmatic choice.

---

### Error 6 — TypeScript error in test setup file (`global is not defined`)

**Symptom:** `apps/web` Docker build failed:
```
src/test/setup.ts:1:1 - error TS2304: Cannot find name 'global'.
```

**Root cause:** The test setup file uses `global` (a Node.js global), but the web app's
`tsconfig.json` didn't exclude test files from the production build. TypeScript tried to
compile it as part of the app, where `global` doesn't exist (browser context).

**Fix — add exclude to `apps/web/tsconfig.json`:**
```json
{
  "exclude": ["src/test"]
}
```

**Lesson:** Test files should always be excluded from production TypeScript builds. Vitest
handles them separately. Without `exclude`, tsc compiles everything it finds.

---

### Error 7 — `workbox-precaching` not found in driver PWA

**Symptom:** Build failed importing `workbox-precaching` in the service worker.

**Root cause:** The package was used in `sw.ts` but not listed in `package.json`.

**Fix:**
```bash
pnpm add workbox-precaching --filter @grandxl/driver-pwa
```

**Lesson:** Service worker dependencies must be in `package.json` just like any other import.
Workbox packages (`workbox-precaching`, `workbox-routing`, etc.) are separate packages.

---

## Part 3 — Container Runtime Errors

### Error 8 — MongoDB 5.0+ requires AVX CPU instructions

**Symptom:** MongoDB container kept restarting:
```
WARNING: MongoDB requires AVX CPU instructions
```

**Root cause:** MongoDB 5.0 and later uses AVX (Advanced Vector Extensions) for certain
operations. Budget VPS CPUs (Namecheap Stellar series) don't support AVX.

**Fix — downgrade to MongoDB 4.4:**
```yaml
# docker-compose.prod.yml
mongodb:
  image: mongo:4.4   # was mongo:7
```

**Lesson:** Always check your VPS CPU capabilities before choosing a database version.
```bash
grep avx /proc/cpuinfo   # empty = no AVX support
```
MongoDB 4.4 is still fully supported and supports all features GrandXL uses (replica sets,
multi-document transactions, aggregation pipelines).

---

### Error 9 — MongoDB healthcheck used `mongosh` (not available in 4.4)

**Symptom:** MongoDB container showed `unhealthy`.

**Root cause:** The healthcheck used `mongosh`, which was introduced in MongoDB 5.0. MongoDB
4.4 only has the legacy `mongo` shell.

**Fix:**
```yaml
healthcheck:
  test: >
    mongo --quiet --eval
    "try { rs.status().ok } catch(e) { rs.initiate().ok }"
```

**Lesson:** Shell tools changed between MongoDB versions. `mongo` → `mongosh` at v5.0.
Always match your healthcheck command to the image version.

---

### Error 10 — Redis password not being read

**Symptom:** Redis started but API couldn't connect — authentication error.

**Root cause:** Docker Compose variable substitution (`${REDIS_PASSWORD}`) reads from a `.env`
file in the same directory as `docker-compose.prod.yml`. We only had `.env.production`.

**Fix:**
```bash
cp /root/grandxl/.env.production /root/grandxl/.env
```

**Lesson:** Docker Compose always reads `.env` for variable substitution, regardless of what
`env_file:` is set to in the service definition. `env_file` injects variables *into the container*.
The `.env` file substitutes variables *in the compose file itself* (like `${REDIS_PASSWORD}`
in the `command:` field).

---

### Error 11 — `REDIS_HOST=localhost` instead of container name

**Symptom:** API container logs showed Redis connection refused.

**Root cause:** `.env.production` had `REDIS_HOST=localhost` (the dev value). Inside Docker,
containers talk to each other by service name, not `localhost`.

**Fix:**
```bash
sed -i 's/REDIS_HOST=localhost/REDIS_HOST=redis/' /root/grandxl/.env.production
```

**Lesson:** In Docker Compose, `localhost` means *the container itself*. To reach another
service, use its service name as defined in `docker-compose.yml`. Docker's internal DNS
resolves `redis` → the Redis container's IP automatically.

---

### Error 12 — API crash: `@sentry/nestjs` MODULE_NOT_FOUND

**Symptom:** API container restarted immediately with:
```
Error: Cannot find module '@sentry/nestjs'
```

**Root cause:** The original Dockerfile had a multi-stage build with a separate runner stage
that only copied root-level `node_modules`. `@sentry/nestjs` lived in the API's own
`node_modules` (`apps/api/node_modules`) which wasn't copied.

**Fix:** Remove the runner stage entirely. The builder stage already has everything needed:
```dockerfile
# No runner stage — the builder stage IS the runtime
CMD ["node", "apps/api/dist/main"]
```

**Lesson:** Multi-stage builds are great for compiled languages (Go, Rust) where you copy
a single binary. For Node.js pnpm monorepos, the workspace `node_modules` topology is complex.
The cost of the larger image is worth the reliability.

---

### Error 13 — Admin `server.js` not found

**Symptom:**
```
Error: Cannot find module '/app/server.js'
```

Then after fixing:
```
Error: Cannot find module '/app/apps/admin/server.js'
```

**Root cause:** Next.js `output: 'standalone'` in a monorepo produces a different directory
structure than a single-app project. The standalone output mirrors the monorepo structure:

```
apps/admin/.next/standalone/
└── apps/
    └── admin/
        └── server.js   ← the actual entry point
```

We discovered this by running:
```bash
docker run --rm grandxl-admin find /app -name "server.js"
# Output: /app/apps/admin/.next/standalone/apps/admin/server.js
```

**Fix — Dockerfile:**
```dockerfile
WORKDIR /app/apps/admin/.next/standalone
CMD ["node", "apps/admin/server.js"]
```

**Lesson:** Next.js standalone in a monorepo doesn't put `server.js` at the root of standalone.
It mirrors the full path from the monorepo root. Always `find` to discover the actual path
rather than guessing.

---

### Error 14 — Admin `_next/static` files returning 404

**Symptom:** Admin loaded an unstyled HTML shell with 32 JS/CSS 404 errors in the console.

**Root cause:** Next.js `output: 'standalone'` deliberately excludes static files from the
standalone directory. The intent is that you serve static files from a CDN or copy them
manually. The standalone server itself doesn't serve them unless they're present at
`.next/static` relative to the server.

**Fix — add to Dockerfile after build:**
```dockerfile
RUN cp -r /app/apps/admin/.next/static \
      /app/apps/admin/.next/standalone/apps/admin/.next/static
RUN cp -r /app/apps/admin/public \
      /app/apps/admin/.next/standalone/apps/admin/public 2>/dev/null || true
```

**Lesson:** Whenever you use Next.js standalone mode, you MUST manually copy two directories:
- `.next/static` → static chunks, CSS, images
- `public/` → favicon, manifests, public assets

The Next.js docs mention this but it's easy to miss.

---

## Part 4 — Nginx Errors

### Error 15 — `server_names_hash_bucket_size` too small

**Symptom:** nginx container failed to start:
```
nginx: [emerg] could not build server_names_hash
```

**Root cause:** Nginx pre-allocates a hash table for server names. The default bucket size
is 32 bytes. Domain names like `admin.grandxl.com` are longer than 32 bytes.

**Fix — add to `http {}` block in nginx.conf:**
```nginx
server_names_hash_bucket_size 64;
```

**Lesson:** Any time you have subdomains longer than ~20 characters, set this to 64. For very
long domain names, 128.

---

### Error 16 — Admin returning 502 Bad Gateway

**Symptom:** `admin.grandxl.com` returned 502.

**Root cause (two-part):**
1. The admin Dockerfile had `ENV PORT=3000` but `.env.production` had `PORT=3001`. The env
   file overrides the Dockerfile ENV. So admin was actually running on port 3001.
2. Nginx was proxying to `http://admin:3000` (wrong port).

**Fix:**
```nginx
# nginx.conf
proxy_pass http://admin:3001;
```

**Lesson:** `env_file:` in Docker Compose overrides `ENV` instructions in the Dockerfile.
When debugging 502s, always check what port the container is actually listening on:
```bash
docker exec grandxl-admin netstat -tlnp
# or
docker logs grandxl-admin 2>&1 | grep "Listening\|listening\|port"
```

---

### Error 17 — Nginx 502 after container recreate (stale DNS)

**Symptom:** After rebuilding `web` with `--force-recreate`, nginx started returning 502.
The web container logs showed it was running fine on port 80.

**Root cause:** Nginx resolves upstream container hostnames (like `web`) to IP addresses at
startup. When a container is recreated, Docker assigns it a new IP. Nginx still has the old
IP cached and all connections to `http://web:80` fail.

**Fix:** Force-recreate nginx after recreating any upstream container:
```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate web
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

**Lesson:** Nginx doesn't do live DNS re-resolution. Every time you recreate a container that
nginx proxies to, you must also recreate nginx (or use `nginx -s reload` inside the container).
In production CI/CD, the deploy script should always recreate nginx last.

---

## Part 5 — CORS Errors

### Error 18 — API blocking requests from grandxl.com

**Symptom:** Browser console:
```
Access to XMLHttpRequest at 'https://api.grandxl.com/api/v1/food-categories'
from origin 'https://grandxl.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

**Root cause:** The NestJS API reads `CLIENT_URL` from the environment to configure its CORS
allowlist. `.env.production` on the server still had the dev value:
```
CLIENT_URL=http://localhost:5173
```

**Fix:**
```bash
sed -i 's|CLIENT_URL=http://localhost:5173|CLIENT_URL=https://grandxl.com|' /root/grandxl/.env.production
cp /root/grandxl/.env.production /root/grandxl/.env
docker compose -f docker-compose.prod.yml up -d --force-recreate api
```

**Verify fix:**
```bash
curl -I -H "Origin: https://grandxl.com" https://api.grandxl.com/api/v1/food-categories
# Should show: access-control-allow-origin: https://grandxl.com
```

### Error 19 — Rider PWA blocked by CORS

**Same root cause:** `RIDER_URL=http://localhost:5174` in `.env.production`.

**Fix:**
```bash
sed -i 's|RIDER_URL=http://localhost:5174|RIDER_URL=https://rider.grandxl.com|' /root/grandxl/.env.production
sed -i 's|ADMIN_URL=http://localhost:3000|ADMIN_URL=https://admin.grandxl.com|' /root/grandxl/.env.production
```

**Lesson:** CORS is a browser security feature, not a server one. The server must explicitly
say "I allow requests from this origin". Every frontend URL that calls your API must be in
the CORS allowlist. In NestJS:
```typescript
app.enableCors({
  origin: [
    configService.get('CLIENT_URL'),   // https://grandxl.com
    configService.get('ADMIN_URL'),    // https://admin.grandxl.com
    configService.get('RIDER_URL'),    // https://rider.grandxl.com
  ],
  credentials: true,
})
```

---

## Part 6 — VITE_API_URL Baked at Build Time

### Error 20 — Web app calling `http://localhost:5173/api`

**Symptom:** Browser DevTools Network tab showed the web app making requests to localhost
instead of `https://api.grandxl.com`.

**Root cause:** Vite inlines `VITE_*` environment variables at *build time*, not runtime.
The Docker build used the wrong value for `VITE_API_URL`.

**How it works:**
```typescript
// In your code
const url = import.meta.env.VITE_API_URL
// At build time, Vite replaces this with the literal string value
// The final JS bundle contains: const url = "https://api.grandxl.com/api/v1"
```

There is no way to change this after the image is built. The value is baked in.

**Fix — pass as Docker build arg:**
```yaml
# docker-compose.prod.yml
web:
  build:
    args:
      VITE_API_URL: ${VITE_API_URL}   # reads from .env file
```

```dockerfile
# Dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @grandxl/web build
```

And in `.env.production`:
```
VITE_API_URL=https://api.grandxl.com/api/v1
```

**Lesson:** `VITE_*` variables are compile-time constants. `process.env.*` in Next.js can be
runtime (server-side) or compile-time (`NEXT_PUBLIC_*`). Know which category your variable
falls into before wondering why your change isn't taking effect.

---

## Part 7 — CI/CD with GitHub Actions (Why No deploy.sh)

### The deploy.sh approach (what we started with)

```bash
# deploy.sh — manual workflow
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**Problems:**
- You have to SSH into the server every time you push code
- Easy to forget steps (forgetting to recreate nginx, forgetting to copy .env)
- No record of who deployed what and when
- No automatic failure notification
- Works from your laptop only (not on a team)

### The GitHub Actions approach (professional)

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /root/grandxl
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

**How it works:**
1. You push to `main` on your laptop
2. GitHub detects the push and starts a runner (a fresh Ubuntu VM)
3. The runner SSH's into your VPS using the private key stored in GitHub Secrets
4. It runs your deploy commands on the VPS
5. GitHub shows you pass/fail in the Actions tab

**Why this is better:**
- Zero manual SSH — push code, deployment happens automatically
- Full audit trail — every deployment is logged in GitHub with the exact commit
- Works for any team member — push = deploy, regardless of whose laptop
- Failure notifications — GitHub emails you if deployment fails
- Secrets are stored securely in GitHub, not in scripts

**The secrets you need to set in GitHub → Settings → Secrets:**
- `VPS_HOST` = `66.29.155.201`
- `VPS_SSH_KEY` = the private key for your VPS (the one matching `~/.ssh/authorized_keys` on the server)

**Generate a deploy key (do this once):**
```bash
# On your laptop
ssh-keygen -t ed25519 -f ~/.ssh/grandxl_deploy -N ""
# Copy public key to server
ssh-copy-id -i ~/.ssh/grandxl_deploy.pub root@66.29.155.201
# Paste private key into GitHub Secret VPS_SSH_KEY
cat ~/.ssh/grandxl_deploy
```

---

## Summary — The Full Error List

| # | Error | Root Cause | Fix |
|---|-------|------------|-----|
| 1 | certbot webroot path missing | Docker volume ≠ host path | Use `--standalone` mode |
| 2 | Node version mismatch | Dockerfile said node:20, CI uses node:22 | Change to `node:22-alpine` |
| 3 | pnpm not found / wrong binary | `npm install -g pnpm` downloads platform binary | Use `corepack enable && corepack prepare pnpm@x.x.x --activate` |
| 4 | Mac node_modules in Linux container | No `.dockerignore` | Add `.dockerignore` with `**/node_modules` |
| 5 | `tsup: not found` | pnpm per-package node_modules not in runner stage | Remove runner stage, single builder |
| 6 | TS error in test setup file | Test files not excluded from tsc | Add `"exclude": ["src/test"]` to tsconfig |
| 7 | workbox-precaching missing | Not in package.json | `pnpm add workbox-precaching --filter @grandxl/driver-pwa` |
| 8 | MongoDB AVX crash | VPS CPU has no AVX support | Use `mongo:4.4` |
| 9 | MongoDB healthcheck fails | `mongosh` not in mongo:4.4 | Use `mongo` in healthcheck |
| 10 | Redis password not substituted | Compose reads `.env` not `.env.production` | `cp .env.production .env` |
| 11 | Redis connection refused | `REDIS_HOST=localhost` | Set `REDIS_HOST=redis` (container name) |
| 12 | `@sentry/nestjs` MODULE_NOT_FOUND | Runner stage missed workspace node_modules | Remove runner stage |
| 13 | Admin server.js not found | Monorepo standalone path is different | `WORKDIR .next/standalone` + `CMD ["node", "apps/admin/server.js"]` |
| 14 | Admin static files 404 | Next.js standalone excludes static files | Copy `.next/static` and `public/` in Dockerfile |
| 15 | nginx hash bucket size error | Default 32 bytes too small for subdomains | `server_names_hash_bucket_size 64` |
| 16 | Admin 502 | `env_file` overrides Dockerfile `ENV PORT` | nginx proxy to `admin:3001` |
| 17 | 502 after container recreate | Nginx caches upstream IPs at startup | Force-recreate nginx after recreating any upstream |
| 18 | CORS blocked on grandxl.com | `CLIENT_URL=http://localhost:5173` | Set `CLIENT_URL=https://grandxl.com` |
| 19 | CORS blocked on rider/admin | Wrong RIDER_URL and ADMIN_URL | Set production URLs in .env.production |
| 20 | Web app calling localhost | VITE_* vars baked at build time | Pass as Docker build args from .env |

---

## The Mental Model to Debug Future Deployments

**When a container won't start:**
```bash
docker logs <container-name> --tail 50
```

**When a container keeps restarting:**
```bash
docker logs <container-name> --tail 20
# Look at the last line before it died
```

**When you get 502:**
1. Is the upstream container running? `docker ps`
2. What port is it on? `docker logs <container> | grep listen`
3. Is nginx proxying to the right port? Check nginx.conf
4. Did you recreate nginx after recreating the upstream?

**When you get CORS errors:**
1. Check what origin the browser is sending (DevTools → Network → request headers → `Origin:`)
2. Check what the API's CORS config allows (grep `enableCors` in main.ts)
3. Check the env var value on the server: `grep CLIENT_URL /root/grandxl/.env.production`

**When env vars aren't taking effect:**
1. Is it a `VITE_*` var? → Must rebuild the image (baked at build time)
2. Is it a `NEXT_PUBLIC_*` var? → Must rebuild the image
3. Is it a server-side var? → Just restart the container
4. Did you update both `.env.production` AND `.env`? → `cp .env.production .env`

**The order that always works for a full redeploy:**
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build --force-recreate api
docker compose -f docker-compose.prod.yml up -d --build --force-recreate web admin driver
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

Always recreate nginx last.
