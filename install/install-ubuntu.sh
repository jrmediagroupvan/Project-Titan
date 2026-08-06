#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo "Run with sudo."; exit 1; }
source /etc/os-release
[[ ${ID:-} == ubuntu ]] || echo "Warning: tested on Ubuntu; detected ${PRETTY_NAME:-unknown}."
missing=()
for item in ca-certificates curl openssl git rsync; do dpkg -s "$item" >/dev/null 2>&1 || missing+=("$item"); done
if ((${#missing[@]})); then apt-get update; DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"; else echo "Required Ubuntu packages already installed."; fi
if ! need docker; then curl -fsSL https://get.docker.com | sh; else echo "Docker already installed."; fi
systemctl enable --now docker >/dev/null 2>&1 || true
if ! docker compose version >/dev/null 2>&1; then apt-get update; DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin; fi
install_stack
install -m 0755 "$ROOT_DIR/scripts/titan" /usr/local/bin/titan
echo "Management command installed: titan"
