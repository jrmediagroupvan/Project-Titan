#!/usr/bin/env bash
set -Eeuo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/install/install-ugreen.sh" "$@"
