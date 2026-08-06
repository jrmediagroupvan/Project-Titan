#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT_DIR/install/common.sh"

platform="${1:-auto}"
mode="${2:-deploy}"

if [[ "$platform" == "auto" ]]; then
  if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    platform="${ID:-linux}"
  else
    case "$(uname -s)" in
      Darwin) platform="docker-desktop" ;;
      MINGW*|MSYS*|CYGWIN*) platform="docker-desktop" ;;
      *) platform="linux" ;;
    esac
  fi
fi

case "$platform" in
  ubuntu|debian|linux|ugreen|truenas|unraid|synology|qnap|docker-desktop) ;;
  *)
    echo "Supported values: auto, ubuntu, debian, linux, ugreen, truenas, unraid, synology, qnap, docker-desktop" >&2
    exit 2
    ;;
esac

need openssl || { echo "OpenSSL is required to generate secure TITAN secrets." >&2; exit 1; }
need docker || {
  echo "Docker is not available. Install Docker/Container Manager for $platform, then run this helper again." >&2
  [[ "$platform" == "ubuntu" || "$platform" == "debian" ]] && echo "On Ubuntu/Debian, you can use: sudo ./install.sh" >&2
  exit 1
}
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required." >&2; exit 1; }

prepare_env
docker compose config >/dev/null

if [[ "$mode" == "--prepare-only" || "$mode" == "prepare" ]]; then
  echo "TITAN is prepared for $platform."
  echo "Import docker-compose.yml in the platform's Docker/Compose interface, with .env beside it."
  exit 0
fi

install_stack
echo "TITAN deployment completed for $platform."

