#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
backup="${1:-}"; [[ -n $backup && -f $backup/database.sql.gz ]] || { echo "Usage: $0 /path/to/backup-folder" >&2; exit 1; }
echo "Restoring database from $backup"
docker compose exec -T postgres psql -U titan -d titan -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c "$backup/database.sql.gz" | docker compose exec -T postgres psql -U titan -d titan
[[ -f $backup/uploads.tar.gz ]] && tar -xzf "$backup/uploads.tar.gz" -C "$ROOT"
echo "Restore completed."
