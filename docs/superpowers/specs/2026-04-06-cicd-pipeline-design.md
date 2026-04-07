# CI/CD Pipeline Design

**Date:** 2026-04-06
**Scope:** CircleCI pipeline for backend, frontend, background-job, and db-migration services

---

## 1. Overview

Two CircleCI workflows handle all pipeline scenarios:

- **`branch-workflow`** — triggered on every push to any branch (including `main`). Has two manual approval gates to control when builds run and when staging deploys.
- **`tag-workflow`** — triggered on git tag creation only. No approval gates; runs straight through to production deploy.

---

## 2. Pipeline Flows

### Branch workflow

```
[lint-test]   ─┐
[unit-test]   ─┤─→ (approve-build) ─→ [build-backend]     ─┐
[ui-test]     ─┘                       [build-frontend]    ─┤─→ (approve-api-test) ─→ [api-test] ─→ [push-backend]     ─┐
                                        [build-bg-job]      ─┤                                        [push-frontend]    ─┤─→ [deploy-staging]
                                        [build-db-migration]─┘                                        [push-bg-job]      ─┤
                                                                                                       [push-db-migration]─┘
```

### Tag workflow

```
[lint-test]   ─┐
[unit-test]   ─┤─→ [build-backend]     ─┐
[ui-test]     ─┘   [build-frontend]    ─┤─→ [api-test] ─→ [push-backend]     ─┐
                   [build-bg-job]      ─┤               [push-frontend]       ─┤─→ [deploy-production]
                   [build-db-migration]─┘               [push-bg-job]         ─┤
                                                         [push-db-migration]   ─┘
```

### Parallelism rules

| Stage | Jobs run in parallel                                            |
| ----- | --------------------------------------------------------------- |
| Test  | lint-test, unit-test, ui-test                                   |
| Build | build-backend, build-frontend, build-bg-job, build-db-migration |
| Push  | push-backend, push-frontend, push-bg-job, push-db-migration     |

---

## 3. Docker Image Tags

Every image always receives the **commit short hash** tag (e.g. `3452ce8`).

Build jobs push this tag to ECR immediately after building. Push jobs add the canonical tags:

| Trigger     | Tags added by push jobs               |
| ----------- | ------------------------------------- |
| Branch push | `dev`                                 |
| Git tag     | `<git-tag>` (e.g. `1.0.0`) and `prod` |

The commit short hash tag serves as the handoff between build jobs and the api-test/push jobs — no separate temporary tag needed.

---

## 4. ECR Repository Structure

| Service        | Image repository                     | Cache repository                           |
| -------------- | ------------------------------------ | ------------------------------------------ |
| backend        | `maintenance-tracker/backend`        | `maintenance-tracker/cache/backend`        |
| frontend       | `maintenance-tracker/frontend`       | `maintenance-tracker/cache/frontend`       |
| background-job | `maintenance-tracker/background-job` | `maintenance-tracker/cache/background-job` |
| db-migration   | `maintenance-tracker/db-migration`   | `maintenance-tracker/cache/db-migration`   |

---

## 5. Production Dockerfiles (`docker/deployment/`)

All four Dockerfiles follow a multi-stage `deps → build → production` pattern using `node:22.14.0-slim`. The production stage contains no dev dependencies and no source code.

### `Dockerfile.backend`

- `deps`: install all deps (dev included, needed for build)
- `build`: `nest build` → compiles to `dist/`
- `production`: fresh slim image, `pnpm install --prod`, copy `dist/`, `CMD ["node", "dist/backend/src/main"]`

### `Dockerfile.background-job`

- Identical to backend except `CMD ["node", "dist/backend/src/main-worker"]`

### `Dockerfile.frontend`

- `deps`: install all deps
- `build`: `next build`
- `production`: copy `.next/`, `public/`, `node_modules/`, `CMD ["node_modules/.bin/next", "start"]`

### `Dockerfile.db-migration`

- `deps → build`: compile TypeScript
- No separate production stage — this is a one-shot container
- `CMD ["pnpm", "run", "migration:run"]`

---

## 6. `docker-compose.pipeline.yml`

Located at project root. Used exclusively by the `api-test` job.

Key differences from `docker-compose.yml`:

- No `build:` directives — uses `image:` pointing to `${AWS_ECR_REGISTRY}/maintenance-tracker/<service>:${CIRCLE_SHA1_SHORT}` where `CIRCLE_SHA1_SHORT` is derived from CircleCI's `CIRCLE_SHA1` via `export CIRCLE_SHA1_SHORT=$(echo $CIRCLE_SHA1 | cut -c1-7)` at the start of each machine-executor job
- No `develop.watch` blocks
- `env_file: .env.pipeline` for non-sensitive defaults
- Sensitive values are in CircleCI env vars, available in the shell at runtime; Docker Compose picks them up automatically via variable interpolation
- Retains `network_mode: host`, `healthcheck`, and `depends_on` from the existing compose

Services: `postgres`, `redis`, `db-migration-service`, `server`, `client`, `worker`

---

## 7. `.env.pipeline`

Committed to the repository. Contains only non-sensitive defaults used during pipeline API tests:

```
NODE_ENV=pipeline
BACKEND_PORT=3001
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=Password1234
DATABASE_DB=project_db
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
BACKEND_ENABLE_API_TEST_MODE=true
BACKEND_CLIENT_HOST=http://localhost:3000
```

Sensitive values are never in this file. They live as CircleCI project environment variables and are injected at runtime.

---

## 8. CircleCI Config Structure (`.circleci/config.yml`)

### Executors

| Executor           | Type                           | Used by                                |
| ------------------ | ------------------------------ | -------------------------------------- |
| `node-executor`    | `docker: node:22.14.0-slim`    | lint-test, unit-test, ui-test          |
| `machine-executor` | `machine: ubuntu-2204:current` | all build, push, api-test, deploy jobs |

### Reusable commands

| Command                 | Parameters              | Purpose                                                                                                                   |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `install-pnpm`          | —                       | Standalone pnpm installer (no npm dependency); works on both node and machine executors. Sets `PNPM_HOME` in `$BASH_ENV`. |
| `ecr-login`             | —                       | `aws ecr get-login-password \| docker login` using `aws-ecr-context` credentials                                          |
| `docker-build-and-push` | `service`, `dockerfile` | BuildKit build with `--cache-from` / `--cache-to` ECR cache repos; push with commit hash                                  |
| `docker-retag-and-push` | `service`, `tags`       | Pull image by commit hash, apply additional tags, push all                                                                |

### Jobs

| Job                 | Executor | Steps                                                                                                                                                   |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint-test`         | node     | checkout, install deps, `just lint`                                                                                                                     |
| `unit-test`         | node     | checkout, install deps, `just test-unit`                                                                                                                |
| `ui-test`           | node     | checkout, install deps, `just test-ui`                                                                                                                  |
| `build-service`     | machine  | checkout, `ecr-login`, `docker-build-and-push` (parameterised on `service` + `dockerfile`)                                                              |
| `api-test`          | machine  | checkout, `ecr-login`, install deps, `docker compose -f docker-compose.pipeline.yml up -d`, wait-for-healthy, `cd api-test && pnpm run test`, tear down |
| `push-service`      | machine  | checkout, `ecr-login`, `docker-retag-and-push` (parameterised on `service` + `extra_tags`)                                                              |
| `deploy-dev`        | machine  | `curl -X POST $COOLIFY_DEV_WEBHOOK_URL`                                                                                                                 |
| `deploy-production` | machine  | `curl -X POST $COOLIFY_PRODUCTION_WEBHOOK_URL`                                                                                                          |

### CircleCI contexts and secrets

| Secret                           | Storage                             |
| -------------------------------- | ----------------------------------- |
| `AWS_ACCESS_KEY_ID`              | CircleCI context: `aws-ecr-context` |
| `AWS_SECRET_ACCESS_KEY`          | CircleCI context: `aws-ecr-context` |
| `AWS_DEFAULT_REGION`             | CircleCI context: `aws-ecr-context` |
| `AWS_ECR_REGISTRY`               | CircleCI context: `aws-ecr-context` |
| `COOLIFY_DEV_WEBHOOK_URL`        | CircleCI project env var            |
| `COOLIFY_PRODUCTION_WEBHOOK_URL` | CircleCI project env var            |
| `BACKEND_COOKIE_SECRET`          | CircleCI project env var            |
| `FIREBASE_PROJECT_ID`            | CircleCI project env var            |
| `FIREBASE_CLIENT_EMAIL`          | CircleCI project env var            |
| `FIREBASE_PRIVATE_KEY`           | CircleCI project env var            |
| `FRONTEND_FIREBASE_API_KEY`      | CircleCI project env var            |
| `FRONTEND_FIREBASE_AUTH_DOMAIN`  | CircleCI project env var            |
| `FRONTEND_FIREBASE_PROJECT_ID`   | CircleCI project env var            |
| `POSTMARK_API_KEY`               | CircleCI project env var            |
| `POSTMARK_FROM_ADDRESS`          | CircleCI project env var            |

---

## 9. Files to Create

| File                                          | Purpose                                 |
| --------------------------------------------- | --------------------------------------- |
| `.circleci/config.yml`                        | Full pipeline definition                |
| `docker/deployment/Dockerfile.backend`        | Production backend image                |
| `docker/deployment/Dockerfile.frontend`       | Production frontend image               |
| `docker/deployment/Dockerfile.background-job` | Production background-job image         |
| `docker/deployment/Dockerfile.db-migration`   | Production db-migration image           |
| `docker-compose.pipeline.yml`                 | Compose file for API test job           |
| `.env.pipeline`                               | Non-sensitive env defaults for pipeline |
