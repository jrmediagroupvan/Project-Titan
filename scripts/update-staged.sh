#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${TITAN_UPDATE_BRANCH:-main}"
REPO="${TITAN_GIT_REPOSITORY:-https://github.com/jrmediagroupvan/Project-Titan.git}"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/titan-update.XXXXXX")"
ROLLBACK="$ROOT/backups/update-$STAMP"
SOURCE_BACKUP="$ROLLBACK/source"
RUNTIME_BACKUP="$ROLLBACK/runtime"

cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

restore_previous_release() {
  log "Restoring the previous Project TITAN release..."

  docker compose stop app updater 2>/dev/null || true

  if [[ -d "$SOURCE_BACKUP" ]]; then
    rsync -a --delete \
      --exclude='.git' \
      --exclude='.env' \
      --exclude='uploads' \
      --exclude='storage' \
      --exclude='backups' \
      "$SOURCE_BACKUP/" "$ROOT/"
  fi

  if [[ -f "$RUNTIME_BACKUP/database.sql.gz" ]]; then
    log "Restoring the database backup..."
    docker compose up -d postgres
    for _ in $(seq 1 60); do
      if docker compose exec -T postgres pg_isready -U titan -d titan >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    docker compose exec -T postgres \
      psql -U titan -d postgres \
      -c 'DROP DATABASE IF EXISTS titan WITH (FORCE);' || true

    docker compose exec -T postgres \
      psql -U titan -d postgres \
      -c 'CREATE DATABASE titan OWNER titan;' || true

    gunzip -c "$RUNTIME_BACKUP/database.sql.gz" |
      docker compose exec -T postgres psql -U titan -d titan || true
  fi

  log "Rebuilding the previous release..."
  docker compose build app updater || true
  docker compose up -d --force-recreate || true
}

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "The live Project TITAN .env file is missing." >&2
  exit 1
fi

mkdir -p "$SOURCE_BACKUP" "$RUNTIME_BACKUP"

log "Creating database, uploads, and configuration backup..."
./scripts/backup.sh "$RUNTIME_BACKUP"

log "Saving the current application source for rollback..."
rsync -a \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='uploads' \
  --exclude='storage' \
  --exclude='backups' \
  "$ROOT/" "$SOURCE_BACKUP/"

log "Cloning GitHub branch '$BRANCH' into staging..."
git clone --depth 1 --branch "$BRANCH" "$REPO" "$STAGE/source"

cp -f "$ROOT/.env" "$STAGE/source/.env"
mkdir -p \
  "$STAGE/source/uploads" \
  "$STAGE/source/storage" \
  "$STAGE/source/backups"

log "Validating the staged source with a clean Docker build..."
(
  cd "$STAGE/source"
  docker compose config >/dev/null
  docker build \
    --pull \
    --no-cache \
    --target builder \
    -t project-titan:staged \
    .
)

log "Staged validation passed. Stopping the live application..."
docker compose stop app updater || true

log "Activating the validated source..."
rsync -a --delete \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='uploads' \
  --exclude='storage' \
  --exclude='backups' \
  "$STAGE/source/" "$ROOT/"

cd "$ROOT"

if ! docker compose config >/dev/null; then
  restore_previous_release
  exit 1
fi

log "Building the validated application and updater..."
if ! docker compose build --pull app updater; then
  restore_previous_release
  exit 1
fi

log "Starting database infrastructure..."
if ! docker compose up -d postgres redis minio; then
  restore_previous_release
  exit 1
fi

log "Waiting for PostgreSQL..."
POSTGRES_READY=0
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U titan -d titan >/dev/null 2>&1; then
    POSTGRES_READY=1
    break
  fi
  sleep 2
done

if [[ "$POSTGRES_READY" -ne 1 ]]; then
  echo "PostgreSQL did not become ready." >&2
  restore_previous_release
  exit 1
fi

log "Applying Prisma migrations..."
if ! docker compose run --rm app npx prisma migrate deploy; then
  restore_previous_release
  exit 1
fi

log "Starting the updated Project TITAN release..."
if ! docker compose up -d --force-recreate; then
  restore_previous_release
  exit 1
fi

log "Running the post-update health check..."
if ! ./scripts/healthcheck.sh --wait; then
  restore_previous_release
  exit 1
fi

printf '%s\n' "$STAMP" > "$ROLLBACK/UPDATE_COMPLETED"
log "Project TITAN one-click update completed successfully."
log "Rollback backup retained at: $ROLLBACK"
