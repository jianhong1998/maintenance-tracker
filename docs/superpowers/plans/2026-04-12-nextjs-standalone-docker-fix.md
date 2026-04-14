# Next.js Standalone Docker Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the Next.js frontend to `output: 'standalone'` so `FRONTEND_*` env vars are read at container runtime instead of being baked in at build time.

**Architecture:** Add `output: 'standalone'` and `outputFileTracingRoot` to `next.config.mjs`. Update the deployment Dockerfile's production stage to copy the standalone output and run `node server.js` instead of `next start`.

**Tech Stack:** Next.js 15, Docker multi-stage builds, pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-04-12-nextjs-standalone-docker-fix-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/next.config.mjs` | Modify | Add `output: 'standalone'` and `outputFileTracingRoot` |
| `docker/deployment/Dockerfile.frontend` | Modify | Replace production stage to use standalone output |
| `docker/local/Dockerfile.frontend` | None | Dev mode unaffected |
| `docker-compose.dev.yml` | None | Env vars already passed through |

---

### Task 1: Update `next.config.mjs` to standalone output

**Files:**
- Modify: `frontend/next.config.mjs`

- [ ] **Step 1: Verify current config builds successfully**

Run from repo root:
```bash
cd frontend && pnpm run build
```
Expected: Build succeeds. Note the `.next/` output structure — no `standalone/` directory exists yet.

- [ ] **Step 2: Update `next.config.mjs`**

Replace the entire contents of `frontend/next.config.mjs` with:

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

- `output: 'standalone'` — tells Next.js to produce a self-contained `server.js` that reads `process.env` at runtime.
- `outputFileTracingRoot: path.join(__dirname, '../')` — points to the monorepo root so file tracing includes `packages/types/` in the standalone bundle.

- [ ] **Step 3: Build and verify standalone output is produced**

```bash
cd frontend && pnpm run build
```
Expected: Build succeeds. Verify standalone output exists:
```bash
ls frontend/.next/standalone/
```
Expected: Should contain `frontend/server.js`, `node_modules/`, and the monorepo structure mirrored.

- [ ] **Step 4: Run format and lint**

```bash
just format && just lint
```
Expected: Both pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/next.config.mjs
git commit -m "add standalone output and outputFileTracingRoot to next.config"
```

---

### Task 2: Update deployment Dockerfile production stage

**Files:**
- Modify: `docker/deployment/Dockerfile.frontend`

- [ ] **Step 1: Read the current Dockerfile**

Read `docker/deployment/Dockerfile.frontend`. The file has 4 stages:
1. `base` — installs pnpm and build tools
2. `deps` — installs dependencies
3. `build` — compiles Next.js
4. `production` — runtime image

Only Stage 4 (`production`) changes. Stages 1-3 remain the same.

- [ ] **Step 2: Replace the production stage**

Replace everything from the `# Stage 4` comment to the end of the file (lines 46-66) with:

```dockerfile
# ===========================================================
# Stage 4: production — minimal runtime image
# ===========================================================
FROM node:22.14.0-slim AS production

WORKDIR /app

# Standalone output bundles its own node_modules — no pnpm install needed.
# outputFileTracingRoot points to monorepo root, so standalone mirrors the
# monorepo directory structure under .next/standalone/.
COPY --from=build /app/frontend/.next/standalone ./
# Next.js standalone excludes .next/static (meant for CDN) and public/ —
# copy them into the location the standalone server expects.
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

WORKDIR /app/frontend

CMD ["node", "server.js"]
```

Key differences from the old production stage:
- Base image is `node:22.14.0-slim` directly — no pnpm, no build tools needed at runtime.
- No `pnpm install --prod` — standalone bundles its own `node_modules`.
- Copies `.next/standalone/` (which contains `server.js` + dependencies) at the monorepo root level.
- Copies `.next/static/` and `public/` separately (standalone doesn't include them).
- Runs `node server.js` instead of `next start`.

- [ ] **Step 3: Verify Dockerfile syntax**

```bash
docker build --check -f docker/deployment/Dockerfile.frontend .
```
If `--check` is not available on your Docker version, just verify the file looks correct by reading it.

- [ ] **Step 4: Commit**

```bash
git add docker/deployment/Dockerfile.frontend
git commit -m "update deployment Dockerfile to use standalone output"
```

---

### Task 3: Verify the full Docker build works end-to-end

- [ ] **Step 1: Build the frontend Docker image**

From the repo root:
```bash
docker build -f docker/deployment/Dockerfile.frontend -t maintenance-tracker/frontend:test .
```
Expected: Build succeeds across all 4 stages.

- [ ] **Step 2: Run the container with a test env var**

```bash
docker run --rm -e FRONTEND_BACKEND_BASE_URL=http://test-backend:3013 -e PORT=3012 -p 3012:3012 maintenance-tracker/frontend:test &
```
Wait a few seconds, then verify the server started:
```bash
curl -s http://localhost:3012 | head -20
```
Expected: HTML response from Next.js (may show the app or a login redirect — the point is it starts).

- [ ] **Step 3: Verify env var is read at runtime**

```bash
docker run --rm -e FRONTEND_BACKEND_BASE_URL=http://test-backend:3013 maintenance-tracker/frontend:test node -e "
  // Standalone server.js reads process.env at runtime
  console.log('FRONTEND_BACKEND_BASE_URL:', process.env.FRONTEND_BACKEND_BASE_URL);
"
```
Expected: Prints `FRONTEND_BACKEND_BASE_URL: http://test-backend:3013` — confirming the env var is available at runtime in the container.

- [ ] **Step 4: Clean up**

```bash
docker stop $(docker ps -q --filter ancestor=maintenance-tracker/frontend:test) 2>/dev/null
docker rmi maintenance-tracker/frontend:test
```

- [ ] **Step 5: Commit progress update**

```bash
git commit --allow-empty -m "verify standalone Docker build works end-to-end"
```
