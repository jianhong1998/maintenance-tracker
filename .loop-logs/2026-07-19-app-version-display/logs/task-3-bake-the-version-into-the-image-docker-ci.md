# Task 3 Log: Bake the version into the image (Docker + CI)

## Task Context

### Plan Section
### Task 3: Bake the version into the image (Docker + CI)

**Files:**
- Modify: `docker/deployment/Dockerfile.backend`
- Modify: `.circleci/config.yml`

**Interfaces:**
- Consumes: nothing from app code.
- Produces: `ENV BACKEND_APP_VERSION` inside the backend image (read by Task 2's service at runtime).

- [ ] **Step 1: Add ARG/ENV to the backend Dockerfile**

In `docker/deployment/Dockerfile.backend`, in the **production stage**, immediately after the existing `NODE_ENTRYPOINT` block and before `USER node`, add:
```dockerfile
# APP_VERSION is build-time artifact identity (NOT a runtime gate — the same
# value ships to prod and to pipeline-E2E because it is the same image).
# CI passes --build-arg APP_VERSION=${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}.
# Kept in this late layer so per-commit version changes don't bust build cache.
ARG APP_VERSION=unreleased
ENV BACKEND_APP_VERSION=${APP_VERSION}
```

- [ ] **Step 2: Verify the default (no build-arg) bakes `unreleased`**

Run:
```bash
docker build -f docker/deployment/Dockerfile.backend -t mt-backend-vertest .
docker run --rm --entrypoint node mt-backend-vertest -e "console.log(process.env.BACKEND_APP_VERSION)"
```
Expected: prints `unreleased`.

- [ ] **Step 3: Verify a passed build-arg bakes through**

Run:
```bash
docker build -f docker/deployment/Dockerfile.backend --build-arg APP_VERSION=1.2.3-test -t mt-backend-vertest .
docker run --rm --entrypoint node mt-backend-vertest -e "console.log(process.env.BACKEND_APP_VERSION)"
```
Expected: prints `1.2.3-test`.

- [ ] **Step 4: Pass the computed version in the CI build step**

In `.circleci/config.yml`, in the `docker-build-and-push` command, add the `APP_VERSION` computation and build-arg. The `run` block's `command` becomes:
```bash
CACHE_REPO="$AWS_ECR_REGISTRY/maintenance-tracker/cache/<< parameters.service >>"
IMAGE_REPO="$AWS_ECR_REGISTRY/maintenance-tracker/<< parameters.service >>"
BUILD_ARGS_FLAG=""
if [ -n "<< parameters.build_args >>" ]; then
  BUILD_ARGS_FLAG="--build-arg << parameters.build_args >>"
fi
# Tag builds → semver git tag; commit builds → short SHA. Empty tag falls back.
APP_VERSION="${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}"
docker buildx build \
  --platform linux/arm64 \
  $BUILD_ARGS_FLAG \
  --build-arg APP_VERSION="$APP_VERSION" \
  --cache-from "type=registry,ref=$CACHE_REPO" \
  --cache-to "type=registry,ref=$CACHE_REPO,mode=max" \
  --tag "$IMAGE_REPO:$CIRCLE_SHA1_SHORT" \
  --file "docker/deployment/<< parameters.dockerfile >>" \
  --push \
  .
```
Note: this build-arg is passed to every service build; only `Dockerfile.backend` declares/consumes it. The frontend build emits a harmless "unused build-arg" warning — acceptable.

- [ ] **Step 5: Validate the CI config (if the CLI is available)**

Run: `circleci config validate .circleci/config.yml`
Expected: `Config file at .circleci/config.yml is valid.`
(If the `circleci` CLI is not installed, skip — the edit is a localized string change.)

- [ ] **Step 6: Clean up the throwaway image and commit**

### Acceptance Criteria
- AC-1: `Dockerfile.backend` production stage declares `ARG APP_VERSION=unreleased` / `ENV BACKEND_APP_VERSION=${APP_VERSION}` after the `NODE_ENTRYPOINT` block and before `USER node`.
- AC-2: Default build (no build-arg) bakes `unreleased` into `BACKEND_APP_VERSION`.
- AC-3: A passed `--build-arg APP_VERSION=1.2.3-test` bakes `1.2.3-test` into `BACKEND_APP_VERSION`.
- AC-4: `.circleci/config.yml` `docker-build-and-push` computes `APP_VERSION="${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}"` and passes `--build-arg APP_VERSION="$APP_VERSION"`.
- AC-5: `circleci config validate` passes (if CLI available); `just lint` exits 0.

---

## Attempt 1 — 2026-07-19T07:18:39Z

### Implementation Plan
- Add `ARG APP_VERSION=unreleased` / `ENV BACKEND_APP_VERSION=${APP_VERSION}` block after `NODE_ENTRYPOINT`, before `USER node` in `Dockerfile.backend` production stage
- Add `APP_VERSION="${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}"` computation + `--build-arg APP_VERSION="$APP_VERSION"` in `.circleci/config.yml` `docker-build-and-push` command
- Verify default bake (`unreleased`) and build-arg bake (`1.2.3-test`) via `docker build` + `docker run`
- Validate CI config with `circleci config validate`
- Run `just lint`

### Files Changed
- modified `docker/deployment/Dockerfile.backend` — declare ARG/ENV baking APP_VERSION into BACKEND_APP_VERSION in production stage
- modified `.circleci/config.yml` — compute APP_VERSION and pass as build-arg in docker-build-and-push

### New Tests
(none — infrastructure/config change, no unit tests apply)

### Key Decisions
- Docker WAS available in this environment; both bake verifications were performed for real (not skipped). Default build printed `unreleased`; `--build-arg APP_VERSION=1.2.3-test` printed `1.2.3-test`.
- circleci CLI WAS available; `circleci config validate .circleci/config.yml` → "Config file at .circleci/config.yml is valid."
- Worktree had no `node_modules`; ran `pnpm install --frozen-lockfile --ignore-scripts` so `just lint` (turbo) could execute.

### Lint Output
PASS

### Test Output
PASS (0 passed, 0 new — infrastructure/config change, no unit tests apply)

### Commit
`6feb40a`

### Outcome: success
