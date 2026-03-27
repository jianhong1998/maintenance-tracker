PROJECT_NAME := "maintenance-tracker"

help:
  @just -l

# Docker commands (not handled by TurboRepo)
[group: 'Service']
up-build:
    @docker compose \
        -p {{PROJECT_NAME}} \
        up --build -w --remove-orphans

[group: 'Service']
up:
    @docker compose \
        -p {{PROJECT_NAME}} \
        up -w

[group: 'Service']
down:
    @docker compose \
        -p {{PROJECT_NAME}} \
        down && \
        just clean-image

[group: 'Service']
down-clean:
    @just down && \
        just clean && \
        just clean-image

[group: 'Clean up']
clean:
    @rm -rf ./backend/temp
    @rm -rf postgres-data

[group: 'Clean up']
clean-image:
    @docker image prune -f

[group: 'Clean up']
clean-dist:
    @rm -rf **/dist

[group: 'Clean up']
clean-turbo:
	@rm -rf ./.turbo **/.turbo **/**/.turbo 

[group: 'Clean up']
clean-pnpm-store:
	@pnpm store prune

# TurboRepo delegated commands
[group: 'build']
build:
    @pnpm run build

[group: 'build']
build-backend:
	@cd backend && \
		pnpm run build

[group: 'build']
build-frontend:
	@cd frontend && \
		pnpm run build

[group: 'code format']
format:
    @pnpm run format

[group: 'code format']
lint:
    @pnpm run lint

[group: 'code format']
lint-fix:
    @pnpm run lint:fix

install:
    @chmod +x ./scripts/reinstall.sh && \
        ./scripts/reinstall.sh

[group: 'test']
test-ui:
	@cd frontend && \
		pnpm run test

[group: 'test']
test-unit:
    @cd backend && \
        pnpm run test

[group: 'test']
test-api:
    @cd api-test && \
        pnpm run test

[group: 'test']
check-implementation-frontend:
  @just format lint build-frontend test-ui

[group: 'test']
check-implementation-backend:
	@just format lint build-backend test-unit

[group: 'test']
check-implementation:
	@just format lint build test-unit test-ui

[group: 'test']
check-implementation-backend-with-api-test:
	@just format lint build-backend test-unit test-api

# Database commands using TurboRepo
[group: 'DB']
db-generate-migrate name:
    @cd backend && \
        bash scripts/generate-db-migration.sh {{name}}

[group: 'DB']
db-data-up:
    @cd backend && \
        pnpm run build && \
        pnpm run seed:run

[group: 'DB']
db-data-down:
    @cd backend && \
        pnpm run build && \
        DOTENV_CONFIG_PATH=../.env pnpx node -r dotenv/config ./dist/backend/config/db-scripts/data-down.js

[group: 'DB']
db-data-reset:
    @cd backend && \
        pnpm run build && \
        DOTENV_CONFIG_PATH=../.env pnpx node -r dotenv/config ./dist/backend/config/db-scripts/data-down.js && \
        pnpm run seed:run
