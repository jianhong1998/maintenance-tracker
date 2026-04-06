# CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CircleCI pipeline that lints, tests, builds Docker images, runs API tests, pushes to AWS ECR, and deploys to Coolify for all four services (backend, frontend, background-job, db-migration).

**Architecture:** Two CircleCI workflows — `branch-workflow` (with two manual approval gates, deploys to staging) and `tag-workflow` (no gates, deploys to production). Build jobs push images to ECR with the commit short-hash tag; push jobs add `dev`/`<git-tag>`+`prod` tags afterward. Reusable CircleCI commands eliminate duplication across the four near-identical build and push jobs.

**Tech Stack:** CircleCI 2.1, AWS ECR, Docker BuildKit (registry cache), Docker Compose, Node 22, pnpm, just

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `docker/deployment/Dockerfile.backend` | Create | Production backend image (NestJS compiled) |
| `docker/deployment/Dockerfile.background-job` | Create | Production worker image (same as backend, different entrypoint) |
| `docker/deployment/Dockerfile.frontend` | Create | Production frontend image (Next.js built) |
| `docker/deployment/Dockerfile.db-migration` | Create | One-shot migration runner (needs ts-node, keeps all deps + source) |
| `.env.pipeline` | Create | Non-sensitive env defaults committed to repo |
| `.gitignore` | Modify | Add `!.env.pipeline` exception to the `.env*` rule |
| `docker-compose.pipeline.yml` | Create | Compose file for the api-test job (image references, no build directives) |
| `.circleci/config.yml` | Create | Full pipeline definition (executors, commands, jobs, workflows) |

---

## Task 1: Production Dockerfile — backend

**Files:**
- Create: `docker/deployment/Dockerfile.backend`

- [ ] **Step 1: Create the file**

```dockerfile
# ===========================================================
# Production Backend Dockerfile
# ===========================================================

# ===========================================================
# Stage 1: deps — install all workspace dependencies
# ===========================================================
FROM node:22.14.0-slim AS deps

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

# ===========================================================
# Stage 2: build — compile TypeScript
# ===========================================================
FROM deps AS build

COPY packages/ ./packages/
COPY backend/ ./backend/

RUN pnpm run build --filter=backend

# ===========================================================
# Stage 3: production — minimal runtime image
# ===========================================================
FROM node:22.14.0-slim AS production

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/packages/types/dist ./packages/types/dist

WORKDIR /app/backend

CMD ["node", "dist/backend/src/main"]
```

- [ ] **Step 2: Build locally to verify it succeeds**

Run from repo root:
```bash
docker build -f docker/deployment/Dockerfile.backend -t backend-prod-test .
```
Expected: build completes with no errors, final image tagged `backend-prod-test`.

- [ ] **Step 3: Smoke-test the image exits gracefully without env vars**

```bash
docker run --rm backend-prod-test node -e "console.log('ok')"
```
Expected: prints `ok` and exits 0. (Full runtime test requires a live database, which is the API test job's job.)

- [ ] **Step 4: Commit**

```bash
git add docker/deployment/Dockerfile.backend
git commit -m "add production Dockerfile for backend"
```

---

## Task 2: Production Dockerfile — background-job

**Files:**
- Create: `docker/deployment/Dockerfile.background-job`

- [ ] **Step 1: Create the file**

Identical to `Dockerfile.backend` except the final `CMD`:

```dockerfile
# ===========================================================
# Production Background-Job Dockerfile
# ===========================================================

FROM node:22.14.0-slim AS deps

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY packages/ ./packages/
COPY backend/ ./backend/

RUN pnpm run build --filter=backend

FROM node:22.14.0-slim AS production

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/packages/types/dist ./packages/types/dist

WORKDIR /app/backend

CMD ["node", "dist/backend/src/main-worker"]
```

- [ ] **Step 2: Build locally to verify**

```bash
docker build -f docker/deployment/Dockerfile.background-job -t bg-job-prod-test .
```
Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add docker/deployment/Dockerfile.background-job
git commit -m "add production Dockerfile for background-job"
```

---

## Task 3: Production Dockerfile — frontend

**Files:**
- Create: `docker/deployment/Dockerfile.frontend`

The frontend needs `build-essential` and `python3` for native module compilation. The production stage does a fresh `--prod` install and copies `.next/`, `public/`, and `next.config.ts` from the build stage.

- [ ] **Step 1: Create the file**

```dockerfile
# ===========================================================
# Production Frontend Dockerfile
# ===========================================================

# ===========================================================
# Stage 1: base — shared OS dependencies
# ===========================================================
FROM node:22.14.0-slim AS base

RUN apt-get update \
    && apt-get install --assume-yes --no-install-recommends \
        build-essential \
        python3 \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@latest

# ===========================================================
# Stage 2: deps — install all workspace dependencies
# ===========================================================
FROM base AS deps

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

# ===========================================================
# Stage 3: build — compile shared types and Next.js app
# ===========================================================
FROM deps AS build

COPY packages/ ./packages/
COPY frontend/ ./frontend/

RUN pnpm run build --filter=frontend

# ===========================================================
# Stage 4: production — minimal runtime image
# ===========================================================
FROM base AS production

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY frontend/next.config.ts ./frontend/

WORKDIR /app/frontend

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
```

- [ ] **Step 2: Build locally to verify**

```bash
docker build -f docker/deployment/Dockerfile.frontend -t frontend-prod-test .
```
Expected: build completes. The `next build` step will take the longest; watch for any compilation errors.

- [ ] **Step 3: Commit**

```bash
git add docker/deployment/Dockerfile.frontend
git commit -m "add production Dockerfile for frontend"
```

---

## Task 4: Production Dockerfile — db-migration

**Files:**
- Create: `docker/deployment/Dockerfile.db-migration`

`migration:run` uses `ts-node` (a dev dependency) to execute the TypeScript data source directly. The production stage therefore cannot strip to `--prod` — it retains all dependencies and TypeScript sources. This is a one-shot container (exits after running migrations), so image size is acceptable.

- [ ] **Step 1: Create the file**

```dockerfile
# ===========================================================
# Production DB Migration Dockerfile
# ===========================================================
# Note: migration:run uses ts-node with TypeScript source files,
# so this image retains all dependencies and source code.
# This is intentional — db-migration is a one-shot container.
# ===========================================================

# ===========================================================
# Stage 1: deps — install all workspace dependencies
# ===========================================================
FROM node:22.14.0-slim AS deps

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY packages/types/package.json ./packages/types/
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile

# ===========================================================
# Stage 2: build — compile TypeScript and copy sources
# ===========================================================
FROM deps AS build

COPY packages/ ./packages/
COPY backend/ ./backend/

RUN pnpm run build --filter=backend

# ===========================================================
# Stage 3: production — run migrations on container start
# ===========================================================
FROM build AS production

WORKDIR /app/backend

CMD ["pnpm", "run", "migration:run"]
```

- [ ] **Step 2: Build locally to verify**

```bash
docker build -f docker/deployment/Dockerfile.db-migration -t db-migration-prod-test .
```
Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add docker/deployment/Dockerfile.db-migration
git commit -m "add production Dockerfile for db-migration"
```

---

## Task 5: Create `.env.pipeline` and update `.gitignore`

**Files:**
- Create: `.env.pipeline`
- Modify: `.gitignore`

The `.gitignore` currently has `.env*` which would gitignore `.env.pipeline`. Add an exception.

- [ ] **Step 1: Add `.env.pipeline` exception to `.gitignore`**

Find the line in `.gitignore`:
```
.env*
!.env.template
```

Change it to:
```
.env*
!.env.template
!.env.pipeline
```

- [ ] **Step 2: Create `.env.pipeline`**

```bash
# .env.pipeline
# Non-sensitive defaults for the CI/CD pipeline API test environment.
# Sensitive values are injected at runtime via CircleCI environment variables.

NODE_ENV=pipeline
BACKEND_PORT=3001
FRONTEND_PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=Password1234
DATABASE_DB=project_db
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
BACKEND_ENABLE_API_TEST_MODE=true
```

- [ ] **Step 3: Verify the file is tracked by git (not ignored)**

```bash
git status .env.pipeline
```
Expected: shows `.env.pipeline` as an untracked file (not silently ignored). If it doesn't appear, check the `.gitignore` edit.

- [ ] **Step 4: Commit**

```bash
git add .gitignore .env.pipeline
git commit -m "add .env.pipeline for pipeline API test environment"
```

---

## Task 6: Create `docker-compose.pipeline.yml`

**Files:**
- Create: `docker-compose.pipeline.yml`

This compose file is used exclusively by the `api-test` CircleCI job. It references pre-built ECR images (no `build:` directives). The api-test job generates a `.env` file by merging `.env.pipeline` with CircleCI secrets before running `docker compose up`.

`CIRCLE_SHA1_SHORT` and `AWS_ECR_REGISTRY` are shell env vars set by CircleCI; Docker Compose interpolates them automatically.

`db-migration-service` is a one-shot container. `server`, `client`, and `worker` use `condition: service_completed_successfully` on it so they only start after migrations finish.

- [ ] **Step 1: Create the file**

```yaml
services:
  postgres:
    image: postgres:16.4-alpine3.20
    network_mode: host
    environment:
      POSTGRES_USER: ${DATABASE_USER:-postgres}
      POSTGRES_DB: ${DATABASE_DB:-project_db}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-Password1234}
    env_file:
      - .env
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'pg_isready -U ${DATABASE_USER:-postgres} -d ${DATABASE_DB:-project_db}',
        ]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    network_mode: host
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  db-migration-service:
    image: ${AWS_ECR_REGISTRY}/maintenance-tracker/db-migration:${CIRCLE_SHA1_SHORT}
    network_mode: host
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy

  server:
    image: ${AWS_ECR_REGISTRY}/maintenance-tracker/backend:${CIRCLE_SHA1_SHORT}
    network_mode: host
    env_file:
      - .env
    depends_on:
      db-migration-service:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy
        restart: true
      redis:
        condition: service_healthy
        restart: true

  client:
    image: ${AWS_ECR_REGISTRY}/maintenance-tracker/frontend:${CIRCLE_SHA1_SHORT}
    network_mode: host
    env_file:
      - .env
    depends_on:
      db-migration-service:
        condition: service_completed_successfully

  worker:
    image: ${AWS_ECR_REGISTRY}/maintenance-tracker/background-job:${CIRCLE_SHA1_SHORT}
    network_mode: host
    env_file:
      - .env
    depends_on:
      db-migration-service:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy
        restart: true
      redis:
        condition: service_healthy
        restart: true
```

- [ ] **Step 2: Validate compose file syntax**

This requires `AWS_ECR_REGISTRY` and `CIRCLE_SHA1_SHORT` to be set for interpolation. Use dummies:

```bash
AWS_ECR_REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com \
CIRCLE_SHA1_SHORT=abc1234 \
docker compose -f docker-compose.pipeline.yml config
```
Expected: prints the fully-interpolated compose config with no errors.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.pipeline.yml
git commit -m "add docker-compose.pipeline.yml for pipeline API tests"
```

---

## Task 7: Create `.circleci/config.yml`

**Files:**
- Create: `.circleci/config.yml`

This is the full CircleCI pipeline definition. It uses two executors, six reusable commands, eight job types, and two workflows.

Key design decisions:
- `set-short-sha`: writes `CIRCLE_SHA1_SHORT` to `$BASH_ENV` (persists to subsequent steps in the same job via CircleCI's env file sourcing mechanism)
- `docker-retag-and-push`: branches on `$CIRCLE_TAG` — if set, applies `<git-tag>` + `prod` tags; otherwise applies `dev`
- `branch-workflow` triggers when `pipeline.git.tag` is empty; `tag-workflow` triggers when it is non-empty
- `build-service` and `push-service` are parameterized jobs called four times each with different `service`/`dockerfile` values

- [ ] **Step 1: Create `.circleci/config.yml`**

```yaml
version: 2.1

# ===========================================================
# Executors
# ===========================================================
executors:
  node-executor:
    docker:
      - image: cimg/node:22.14

  machine-executor:
    machine:
      image: ubuntu-2204:current

# ===========================================================
# Commands
# ===========================================================
commands:
  install-pnpm:
    steps:
      - run:
          name: Install pnpm
          command: npm install -g pnpm@latest

  install-just:
    steps:
      - run:
          name: Install just
          command: |
            curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | \
              bash -s -- --to /usr/local/bin

  set-short-sha:
    steps:
      - run:
          name: Export CIRCLE_SHA1_SHORT
          command: echo "export CIRCLE_SHA1_SHORT=$(echo $CIRCLE_SHA1 | cut -c1-7)" >> $BASH_ENV

  setup-buildx:
    steps:
      - run:
          name: Set up Docker Buildx with docker-container driver
          command: |
            docker buildx create --name builder --driver docker-container --use
            docker buildx inspect --bootstrap

  ecr-login:
    steps:
      - run:
          name: Authenticate with AWS ECR
          command: |
            aws ecr get-login-password --region "$AWS_DEFAULT_REGION" | \
              docker login --username AWS --password-stdin "$AWS_ECR_REGISTRY"

  docker-build-and-push:
    parameters:
      service:
        type: string
      dockerfile:
        type: string
    steps:
      - set-short-sha
      - run:
          name: Build and push << parameters.service >>
          command: |
            CACHE_REPO="$AWS_ECR_REGISTRY/maintenance-tracker/cache/<< parameters.service >>"
            IMAGE_REPO="$AWS_ECR_REGISTRY/maintenance-tracker/<< parameters.service >>"
            docker buildx build \
              --cache-from "type=registry,ref=$CACHE_REPO" \
              --cache-to "type=registry,ref=$CACHE_REPO,mode=max" \
              --tag "$IMAGE_REPO:$CIRCLE_SHA1_SHORT" \
              --file "docker/deployment/<< parameters.dockerfile >>" \
              --push \
              .

  docker-retag-and-push:
    parameters:
      service:
        type: string
    steps:
      - set-short-sha
      - run:
          name: Retag and push << parameters.service >>
          command: |
            IMAGE_REPO="$AWS_ECR_REGISTRY/maintenance-tracker/<< parameters.service >>"
            docker pull "$IMAGE_REPO:$CIRCLE_SHA1_SHORT"
            if [ -n "$CIRCLE_TAG" ]; then
              docker tag "$IMAGE_REPO:$CIRCLE_SHA1_SHORT" "$IMAGE_REPO:$CIRCLE_TAG"
              docker push "$IMAGE_REPO:$CIRCLE_TAG"
              docker tag "$IMAGE_REPO:$CIRCLE_SHA1_SHORT" "$IMAGE_REPO:prod"
              docker push "$IMAGE_REPO:prod"
            else
              docker tag "$IMAGE_REPO:$CIRCLE_SHA1_SHORT" "$IMAGE_REPO:dev"
              docker push "$IMAGE_REPO:dev"
            fi

# ===========================================================
# Jobs
# ===========================================================
jobs:
  lint-test:
    executor: node-executor
    steps:
      - checkout
      - install-pnpm
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile
      - run:
          name: Lint
          command: pnpm run lint

  unit-test:
    executor: node-executor
    steps:
      - checkout
      - install-pnpm
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile
      - run:
          name: Unit tests
          command: cd backend && pnpm run test

  ui-test:
    executor: node-executor
    steps:
      - checkout
      - install-pnpm
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile
      - run:
          name: UI tests
          command: cd frontend && pnpm run test

  build-service:
    executor: machine-executor
    parameters:
      service:
        type: string
      dockerfile:
        type: string
    steps:
      - checkout
      - ecr-login
      - setup-buildx
      - docker-build-and-push:
          service: << parameters.service >>
          dockerfile: << parameters.dockerfile >>

  api-test:
    executor: machine-executor
    steps:
      - checkout
      - set-short-sha
      - ecr-login
      - install-pnpm
      - install-just
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile
      - run:
          name: Generate .env from .env.pipeline and CircleCI secrets
          command: |
            cp .env.pipeline .env
            cat >> .env << EOF
            BACKEND_COOKIE_SECRET=$BACKEND_COOKIE_SECRET
            FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
            FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL
            FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY
            FRONTEND_FIREBASE_API_KEY=$FRONTEND_FIREBASE_API_KEY
            FRONTEND_FIREBASE_AUTH_DOMAIN=$FRONTEND_FIREBASE_AUTH_DOMAIN
            FRONTEND_FIREBASE_PROJECT_ID=$FRONTEND_FIREBASE_PROJECT_ID
            POSTMARK_API_KEY=$POSTMARK_API_KEY
            POSTMARK_FROM_ADDRESS=$POSTMARK_FROM_ADDRESS
            EOF
      - run:
          name: Start services
          command: docker compose -f docker-compose.pipeline.yml up -d
      - run:
          name: Wait for backend to be ready
          command: |
            timeout 120 bash -c 'until curl -sf http://localhost:3001/health; do sleep 3; done'
      - run:
          name: Run API tests
          command: just test-api
      - run:
          name: Tear down services
          command: docker compose -f docker-compose.pipeline.yml down --volumes
          when: always

  push-service:
    executor: machine-executor
    parameters:
      service:
        type: string
    steps:
      - checkout
      - ecr-login
      - docker-retag-and-push:
          service: << parameters.service >>

  deploy-staging:
    executor: machine-executor
    steps:
      - run:
          name: Trigger Coolify staging deploy
          command: curl -fsSL -X POST "$COOLIFY_STAGING_WEBHOOK_URL"

  deploy-production:
    executor: machine-executor
    steps:
      - run:
          name: Trigger Coolify production deploy
          command: curl -fsSL -X POST "$COOLIFY_PRODUCTION_WEBHOOK_URL"

# ===========================================================
# Workflows
# ===========================================================
workflows:
  # Triggered on every branch push (git tag is empty)
  branch-workflow:
    when:
      equal: ['', << pipeline.git.tag >>]
    jobs:
      - lint-test
      - unit-test
      - ui-test
      - approve-build:
          type: approval
          requires:
            - lint-test
            - unit-test
            - ui-test
      - build-service:
          name: build-backend
          service: backend
          dockerfile: Dockerfile.backend
          context: aws-ecr-context
          requires:
            - approve-build
      - build-service:
          name: build-frontend
          service: frontend
          dockerfile: Dockerfile.frontend
          context: aws-ecr-context
          requires:
            - approve-build
      - build-service:
          name: build-background-job
          service: background-job
          dockerfile: Dockerfile.background-job
          context: aws-ecr-context
          requires:
            - approve-build
      - build-service:
          name: build-db-migration
          service: db-migration
          dockerfile: Dockerfile.db-migration
          context: aws-ecr-context
          requires:
            - approve-build
      - approve-api-test:
          type: approval
          requires:
            - build-backend
            - build-frontend
            - build-background-job
            - build-db-migration
      - api-test:
          context: aws-ecr-context
          requires:
            - approve-api-test
      - push-service:
          name: push-backend
          service: backend
          context: aws-ecr-context
          requires:
            - api-test
      - push-service:
          name: push-frontend
          service: frontend
          context: aws-ecr-context
          requires:
            - api-test
      - push-service:
          name: push-background-job
          service: background-job
          context: aws-ecr-context
          requires:
            - api-test
      - push-service:
          name: push-db-migration
          service: db-migration
          context: aws-ecr-context
          requires:
            - api-test
      - deploy-staging:
          requires:
            - push-backend
            - push-frontend
            - push-background-job
            - push-db-migration

  # Triggered only on git tag creation
  tag-workflow:
    when:
      not:
        equal: ['', << pipeline.git.tag >>]
    jobs:
      - lint-test
      - unit-test
      - ui-test
      - build-service:
          name: build-backend
          service: backend
          dockerfile: Dockerfile.backend
          context: aws-ecr-context
          requires:
            - lint-test
            - unit-test
            - ui-test
      - build-service:
          name: build-frontend
          service: frontend
          dockerfile: Dockerfile.frontend
          context: aws-ecr-context
          requires:
            - lint-test
            - unit-test
            - ui-test
      - build-service:
          name: build-background-job
          service: background-job
          dockerfile: Dockerfile.background-job
          context: aws-ecr-context
          requires:
            - lint-test
            - unit-test
            - ui-test
      - build-service:
          name: build-db-migration
          service: db-migration
          dockerfile: Dockerfile.db-migration
          context: aws-ecr-context
          requires:
            - lint-test
            - unit-test
            - ui-test
      - api-test:
          context: aws-ecr-context
          requires:
            - build-backend
            - build-frontend
            - build-background-job
            - build-db-migration
      - push-service:
          name: push-backend
          service: backend
          context: aws-ecr-context
          requires:
            - api-test
      - push-service:
          name: push-frontend
          service: frontend
          context: aws-ecr-context
          requires:
            - api-test
      - push-service:
          name: push-background-job
          service: background-job
          context: aws-ecr-context
          requires:
            - api-test
      - push-service:
          name: push-db-migration
          service: db-migration
          context: aws-ecr-context
          requires:
            - api-test
      - deploy-production:
          requires:
            - push-backend
            - push-frontend
            - push-background-job
            - push-db-migration
```

- [ ] **Step 2: Validate the config with the CircleCI CLI**

Install the CLI if not already present:
```bash
curl -fLSs https://raw.githubusercontent.com/CircleCI-Public/circleci-cli/main/install.sh | bash
```

Then validate:
```bash
circleci config validate .circleci/config.yml
```
Expected: `Config file at .circleci/config.yml is valid.`

- [ ] **Step 3: Commit**

```bash
git add .circleci/config.yml
git commit -m "add CircleCI pipeline config"
```

---

## External Setup (not code tasks)

These steps must be done in the AWS and CircleCI consoles before the pipeline runs end-to-end:

1. **Create 8 ECR repositories** in AWS:
   - `maintenance-tracker/backend`
   - `maintenance-tracker/frontend`
   - `maintenance-tracker/background-job`
   - `maintenance-tracker/db-migration`
   - `maintenance-tracker/cache/backend`
   - `maintenance-tracker/cache/frontend`
   - `maintenance-tracker/cache/background-job`
   - `maintenance-tracker/cache/db-migration`

2. **Create CircleCI context** named `aws-ecr-context` with:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_DEFAULT_REGION`
   - `AWS_ECR_REGISTRY`

3. **Set CircleCI project environment variables**:
   - `COOLIFY_STAGING_WEBHOOK_URL`
   - `COOLIFY_PRODUCTION_WEBHOOK_URL`
   - `BACKEND_COOKIE_SECRET`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `FRONTEND_FIREBASE_API_KEY`
   - `FRONTEND_FIREBASE_AUTH_DOMAIN`
   - `FRONTEND_FIREBASE_PROJECT_ID`
   - `POSTMARK_API_KEY`
   - `POSTMARK_FROM_ADDRESS`
