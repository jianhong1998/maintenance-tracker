# Next.js Standalone Output for Docker Runtime Env Vars

**Date:** 2026-04-12
**Branch:** `config/000/pipeline-creation`

## Problem

The frontend Docker container cannot read `FRONTEND_BACKEND_BASE_URL` (and other `FRONTEND_*` env vars) at runtime. The env vars exist in the container shell but the app uses `http://localhost:3001` instead.

**Root cause (corrected — 2026-04-13):** Next.js 15 is "static by default." Because `layout.tsx` used no dynamic functions, Next.js pre-rendered all routes at `next build` time. During the build, `FRONTEND_BACKEND_BASE_URL` is `undefined`, so the fallback `'http://localhost:3001'` is baked into the pre-rendered `index.html` / `index.rsc` files. At runtime, `node server.js` serves these cached files directly and never re-executes the layout function — the container's env vars are irrelevant.

The server bundle (`*.js` chunks) does retain a live `process.env.FRONTEND_BACKEND_BASE_URL` lookup. The problem is that for statically pre-rendered routes, those chunks are never called at request time.

> **Note:** The original diagnosis ("Next.js inlines `process.env.*` at build time via string replacement") was wrong. Next.js does NOT replace non-`NEXT_PUBLIC_` references in the server bundle. The actual issue is static pre-rendering, not compile-time string replacement.

**Firebase env vars** (`FRONTEND_FIREBASE_*`) are read inside a `'use server'` Server Action (`firebase-config.ts`). Server Actions are always dynamically executed — never pre-rendered. They were not affected by this bug.

**Affected env vars:**
- `FRONTEND_BACKEND_BASE_URL` (read in `layout.tsx`) ← actual affected var

## Solution

Two changes were required:

1. Switch to Next.js `output: 'standalone'` mode — produces a self-contained `server.js`, the recommended approach for Docker deployments.
2. Add `export const dynamic = 'force-dynamic'` to `src/app/layout.tsx` — prevents static pre-rendering so the layout function runs on every request, reading `process.env.FRONTEND_BACKEND_BASE_URL` from the live container environment.

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
