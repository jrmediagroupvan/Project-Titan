#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
stamp="$(date +%Y%m%d-%H%M%S)"; dest="${1:-$ROOT/backups/titan-$stamp}"
mkdir -p "$dest"
docker compose exec -T postgres pg_dump -U titan -d titan | gzip > "$dest/database.sql.gz"
tar -czf "$dest/uploads.tar.gz" uploads 2>/dev/null || true
cp .env "$dest/environment.env"
printf '%s\n' "$stamp" > "$dest/BACKUP_CREATED"
echo "Backup saved to: $dest"
