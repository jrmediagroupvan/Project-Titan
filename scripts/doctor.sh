#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
fail=0
check(){ printf '%-32s' "$1"; shift; if "$@" >/dev/null 2>&1; then echo OK; else echo FAILED; fail=1; fi; }
check "Docker command" command -v docker
check "Docker daemon" docker info
check "Docker Compose v2" docker compose version
check "Environment file" test -s .env
check "Storage writable" test -w storage
check "PostgreSQL" docker compose exec -T postgres pg_isready -U titan -d titan
check "Redis" docker compose exec -T redis redis-cli ping
check "TITAN HTTP health" curl -fsS "http://127.0.0.1:${TITAN_PORT:-3000}/api/health"
echo; docker compose ps
exit "$fail"
