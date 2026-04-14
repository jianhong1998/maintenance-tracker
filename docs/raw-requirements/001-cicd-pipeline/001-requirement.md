# CI/CD pipeline

As a devops engineer, I want to build a CI/CD pipeline for this project's backend, frontend, backend-job and db-migration services.

## Tech stack constraint

- CircleCI - running pipeline jobs
- AWS ECR - storing Docker images
- Coolify - hosting applications

## Docker image

Refer to the docker files in `docker/local/`. These are the dockerfiles for local development usage.
Write production-grade dockerfiles in `docker/deployment/` by following best practices.

## Pipeline flow

```
# For all pushes in all branches

Lint Test -> Pending Approval   -> Build backend         -> API test  -> Pending Approval -> Push backend         -> Trigger Coolify staging deploy
Unit Test                       -> Build frontend                                          -> Push frontend
UI Test                         -> Build background-job                                   -> Push background-job
                                -> Build db-migration                                     -> Push db-migration


# For all pushes for Git tag

Lint Test   -> Build backend         -> API test  -> Push backend         -> Trigger Coolify production deploy
Unit Test   -> Build frontend                     -> Push frontend
UI Test     -> Build background-job               -> Push background-job
            -> Build db-migration                 -> Push db-migration
```

### Note

- `Lint Test`, `Unit Test`, `UI Test` jobs must run in parallel.

- `Build backend`, `Build frontend`, `Build background-job` and `Build db-migration` must run in parallel.
  - These jobs build Docker images for the respective services.

- `Push backend`, `Push frontend`, `Push background-job` and `Push db-migration` must run in parallel.
  - These jobs push images to ECR with the image tag convention described below.

- `API test` job spins up **all services** (postgres, redis, db-migration-service, server, client, worker) via `docker-compose.pipeline.yml`, then runs API tests targeting the backend service at port 3001.

- `Trigger Coolify staging deploy` calls the Coolify staging webhook after all push jobs complete. This is a single webhook that redeploys the entire Docker Compose stack on Coolify.

- `Trigger Coolify production deploy` calls the Coolify production webhook after all push jobs complete. This is a single webhook that redeploys the entire Docker Compose stack on Coolify.

## ECR repository structure

One ECR repository per service:

- `maintenance-tracker/backend`
- `maintenance-tracker/frontend`
- `maintenance-tracker/background-job`
- `maintenance-tracker/db-migration`

## Docker image tag convention

- An image can have multiple tags.

- Always tag with the commit short hash.
  - e.g. `3452ce8` for commit `3452ce8b56629ddb57732f1409ee1dd9b28ded27`

- Always tag with the git tag and `prod` tag if the pipeline is triggered by git tag creation.
  - e.g. `1.0.0`

- Always tag with `dev` if the image is built from a branch (including `main` branch).

## Docker layer caching

Use ECR as the remote cache backend for Docker BuildKit layer caching. Each service has a dedicated ECR cache repository:

- `maintenance-tracker/cache/backend`
- `maintenance-tracker/cache/frontend`
- `maintenance-tracker/cache/background-job`
- `maintenance-tracker/cache/db-migration`

Build jobs use `--cache-from` and `--cache-to` pointing at these ECR repositories to speed up subsequent builds.

## docker-compose.pipeline.yml

Write a `docker-compose.pipeline.yml` file at the project root for use in the API test job. It must:

- Start all services: `postgres`, `redis`, `db-migration-service`, `server`, `client`, `worker`.
- Reference the locally-built Docker images (not the `build:` directive) so the API test job reuses the images built in the build stage.
- Source environment variables from a `.env.pipeline` file (non-sensitive defaults) combined with CircleCI environment variables injected at runtime (sensitive values).

## Environment variable strategy

### `.env.pipeline` (committed to repo)

A template file at the project root containing non-sensitive default values for the pipeline environment. Examples:

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
```

### CircleCI secrets

Sensitive values are injected via CircleCI at runtime. The pipeline generates the final `.env` by merging `.env.pipeline` with these secrets.

| Secret                           | Storage location                      |
| -------------------------------- | ------------------------------------- |
| `AWS_ACCESS_KEY_ID`              | CircleCI context: `aws-ecr-context`   |
| `AWS_SECRET_ACCESS_KEY`          | CircleCI context: `aws-ecr-context`   |
| `AWS_DEFAULT_REGION`             | CircleCI context: `aws-ecr-context`   |
| `AWS_ECR_REGISTRY`               | CircleCI context: `aws-ecr-context`   |
| `COOLIFY_DEV_WEBHOOK_URL`        | CircleCI project environment variable |
| `COOLIFY_PRODUCTION_WEBHOOK_URL` | CircleCI project environment variable |
| `BACKEND_COOKIE_SECRET`          | CircleCI project environment variable |
| `FIREBASE_PROJECT_ID`            | CircleCI project environment variable |
| `FIREBASE_CLIENT_EMAIL`          | CircleCI project environment variable |
| `FIREBASE_PRIVATE_KEY`           | CircleCI project environment variable |
| `FRONTEND_FIREBASE_API_KEY`      | CircleCI project environment variable |
| `FRONTEND_FIREBASE_AUTH_DOMAIN`  | CircleCI project environment variable |
| `FRONTEND_FIREBASE_PROJECT_ID`   | CircleCI project environment variable |
| `POSTMARK_API_KEY`               | CircleCI project environment variable |
| `POSTMARK_FROM_ADDRESS`          | CircleCI project environment variable |

## Test commands reference

| Job       | Command                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| Lint Test | `just lint`                                                                     |
| Unit Test | `just test-unit` (Vitest, `backend/src/**/*.spec.ts`)                           |
| UI Test   | `just test-ui` (Vitest + Testing Library, `frontend/`)                          |
| API Test  | `cd api-test && pnpm run test` (Vitest, `api-test/`, requires running services) |
