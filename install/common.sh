#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
need(){ command -v "$1" >/dev/null 2>&1; }
compose(){ docker compose "$@"; }
random_secret(){ openssl rand -hex "${1:-24}"; }
prepare_env(){
 if [[ ! -f .env ]]; then
   AUTH="$(random_secret 32)"
   ENCRYPTION_KEY="$(random_secret 32)"
   DB_PASSWORD="$(random_secret 24)"
   STORAGE_PASSWORD="$(random_secret 24)"
   INITIAL_ADMIN_PASSWORD="$(random_secret 12)"
   UPDATE_TOKEN="$(random_secret 32)"
   cat > .env <<EOF
NODE_ENV=production
TITAN_BIND_ADDRESS=0.0.0.0
TITAN_PORT=${TITAN_PORT:-1200}
TITAN_BASE_URL=${TITAN_BASE_URL:-http://localhost:${TITAN_PORT:-1200}}
TITAN_PROJECT_DIR=$ROOT_DIR
TITAN_DATA_DIR=./storage
TITAN_UPLOAD_DIR=/app/uploads
COOKIE_SECURE=false
POSTGRES_USER=titan
POSTGRES_DB=titan
POSTGRES_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://titan:$DB_PASSWORD@postgres:5432/titan?schema=public
REDIS_URL=redis://redis:6379
MINIO_ACCESS_KEY=titan-storage
MINIO_SECRET_KEY=$STORAGE_PASSWORD
MINIO_ENDPOINT=http://minio:9000
MINIO_CONSOLE_PORT=9001
AUTH_SECRET=$AUTH
CREDENTIAL_ENCRYPTION_KEY=$ENCRYPTION_KEY
TITAN_UPDATE_TOKEN=$UPDATE_TOKEN
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
ADMIN_PASSWORD=$INITIAL_ADMIN_PASSWORD
TITAN_UPDATE_BRANCH=main
TITAN_GIT_REPOSITORY=https://github.com/jrmediagroupvan/Project-Titan.git
SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_WEBHOOK_NOTIFICATION_URL=
EOF
   chmod 600 .env
   echo "Default administrator: admin@example.com"
   echo "Temporary password: $INITIAL_ADMIN_PASSWORD (change after first login)"
   echo "Set TITAN_BASE_URL in .env to this server's real IP or HTTPS address."
 else
   echo "Using existing .env configuration."
   grep -q '^TITAN_PROJECT_DIR=' .env || printf '\nTITAN_PROJECT_DIR=%s\n' "$ROOT_DIR" >> .env
   grep -q '^TITAN_UPDATE_TOKEN=' .env || printf 'TITAN_UPDATE_TOKEN=%s\n' "$(random_secret 32)" >> .env
   grep -q '^TITAN_GIT_REPOSITORY=' .env || printf 'TITAN_GIT_REPOSITORY=https://github.com/jrmediagroupvan/Project-Titan.git\n' >> .env
 fi
 mkdir -p storage/postgres storage/redis storage/minio uploads backups public
 chmod -R u+rwX storage uploads backups
}

install_stack(){
 prepare_env
 echo "Running automatic Project TITAN source validation..."
 "$ROOT_DIR/scripts/validate-source.sh"
 echo "Validation passed. Building production images..."
 compose build --pull app updater
 compose up -d
 echo "Waiting for TITAN to initialize the database..."
 port="$(grep '^TITAN_PORT=' .env|cut -d= -f2)"
 healthy=false
 for i in $(seq 1 36); do
   if curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then healthy=true; break; fi
   sleep 5
 done
 compose ps
 if [[ "$healthy" != true ]]; then
   echo "TITAN failed its post-install health check." >&2
   compose logs --tail=200 app >&2 || true
   exit 1
 fi
 echo "TITAN: http://SERVER-IP:${port}"
 echo "Admin email: $(grep '^ADMIN_EMAIL=' .env|cut -d= -f2-)"
 echo "Admin password: $(grep '^ADMIN_PASSWORD=' .env|cut -d= -f2-)"
}
