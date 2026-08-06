#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
WAIT=false; [[ ${1:-} == --wait ]] && WAIT=true
attempts=1; $WAIT && attempts=60
for ((i=1;i<=attempts;i++)); do
  app_state="$(docker inspect -f '{{.State.Health.Status}}' titan-app 2>/dev/null || true)"
  if [[ $app_state == healthy ]] && curl -fsS "http://127.0.0.1:${TITAN_PORT:-3000}/api/health" >/dev/null 2>&1; then
    echo "TITAN health check passed."; exit 0
  fi
  sleep 2
done
docker compose ps
echo "TITAN health check failed." >&2
exit 1
