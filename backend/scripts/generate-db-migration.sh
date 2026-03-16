#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <MigrationName>"
  exit 1
fi

DOTENV_CONFIG_PATH=../.env \
  pnpm exec ts-node \
  --project tsconfig.cli.json \
  -r dotenv/config \
  -r tsconfig-paths/register \
  ./node_modules/typeorm/cli.js \
  migration:generate \
  -d src/db/migration-config/data-source.ts \
  src/db/migrations/$1

pnpm run format