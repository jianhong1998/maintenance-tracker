PROJECT_NAME = "claim-submission-app"

# Docker commands (not handled by TurboRepo)
up/build:
	@docker compose \
		-p ${PROJECT_NAME} \
		up --build -w --remove-orphans

up:
	@docker compose \
		-p ${PROJECT_NAME} \
		up -w

down:
	@docker compose \
		-p ${PROJECT_NAME} \
		down && \
		$(MAKE) clean-image

down/clean:
	@$(MAKE) down && \
		$(MAKE) clean && \
		$(MAKE) clean-image

clean:
	@rm -rf ./backend/temp
	@rm -rf postgres-data

clean-image:
	@docker image prune -f

clean/dist:
	@rm -rf **/dist

# TurboRepo delegated commands
build:
	@pnpm run build

format:
	@pnpm run format

lint:
	@pnpm run lint

lint/fix:
	@pnpm run lint:fix

install:
# 	@pnpm install
	@chmod +x ./scripts/reinstall.sh && \
		./scripts/reinstall.sh


test/unit:
	@cd backend && \
		pnpm run test

test/api:
	@cd api-test && \
		pnpm run test

# Database commands using TurboRepo
db/data/up:
	@cd backend && \
		pnpm run build && \
		pnpm run seed:run

db/data/down:
	@cd backend && \
		pnpm run build && \
		DOTENV_CONFIG_PATH=../.env pnpx node -r dotenv/config ./dist/backend/config/db-scripts/data-down.js

db/data/reset:
	@cd backend && \
		pnpm run build && \
		DOTENV_CONFIG_PATH=../.env pnpx node -r dotenv/config ./dist/backend/config/db-scripts/data-down.js && \
		pnpm run seed:run