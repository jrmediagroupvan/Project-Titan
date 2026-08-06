#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
need docker || { echo "Docker/Container Manager is required on UGOS Pro."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose is required."; exit 1; }
install_stack
