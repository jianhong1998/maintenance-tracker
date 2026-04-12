# Next.js Standalone Output for Docker Runtime Env Vars

**Date:** 2026-04-12
**Branch:** `config/000/pipeline-creation`

## Problem

The frontend Docker container cannot read `FRONTEND_BACKEND_BASE_URL` (and other `FRONTEND_*` env vars) at runtime. The env vars exist in the container shell but Next.js returns `undefined` for them.

**Root cause:** Next.js inlines `process.env.*` references at build time via string replacement. In the deployment Dockerfile, the build stage has no env vars set, so all `process.env.FRONTEND_*` calls compile to `undefined` and get baked into the `.next` output. Setting env vars at container start (via docker-compose) is too late.

**Affected env vars:**
- `FRONTEND_BACKEND_BASE_URL` (read in `layout.tsx`)
- `FRONTEND_FIREBASE_API_KEY` (read in `firebase-config.ts`)
- `FRONTEND_FIREBASE_AUTH_DOMAIN` (read in `firebase-config.ts`)
- `FRONTEND_FIREBASE_PROJECT_ID` (read in `firebase-config.ts`)

## Solution

Switch to Next.js `output: 'standalone'` mode. This produces a self-contained `server.js` that reads `process.env` at actual runtime — the officially recommended approach for Docker deployments.

## Changes

### 1. `frontend/next.config.mjs`

Add `output: 'standalone'` and `outputFileTracingRoot` (required for monorepo — traces dependencies above the Next.js project directory so `@project/types` is included in the standalone bundle).

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),
};

export default nextConfig;
```

### 2. `docker/deployment/Dockerfile.frontend` — production stage

Replace the current production stage. Standalone output bundles its own `node_modules`, so no `pnpm install --prod` is needed. The base image for production drops to plain `node:22.14.0-slim` (no pnpm, no build tools).

Key points:
- Copy `.next/standalone/` — contains `server.js` + bundled `node_modules`, mirroring monorepo directory structure
- Copy `.next/static/` separately — standalone excludes it (intended for CDN)
- Copy `public/` separately — same reason
- Run `node server.js` instead of `next start`

### 3. `docker/local/Dockerfile.frontend` — no change

Local dev uses `pnpm run dev` (Turbopack), which reads `process.env` at runtime already. The `standalone` output config has no effect on dev mode.

### 4. `docker-compose.dev.yml` — no change

Env vars are already passed through correctly.

## What doesn't break

- Local development (`pnpm run dev`) — unaffected
- `ConfigProvider` -> `setBaseUrl` flow — works the same (receives value from `layout.tsx` server component)
- Server Actions (`firebase-config.ts`) — works the same
- All other Docker services — no changes
