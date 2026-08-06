#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created .env. Edit it before continuing, then rerun this script."
  exit 1
fi

docker compose build --pull --no-cache app updater
docker compose up -d postgres redis minio

for attempt in $(seq 1 60); do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' titan-postgres 2>/dev/null || true)"
  [[ "$status" == "healthy" ]] && break
  sleep 3
done

docker compose run --rm app npx prisma migrate deploy
docker compose run --rm app npx prisma db seed || true
docker compose up -d --force-recreate
docker compose ps
