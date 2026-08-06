#!/usr/bin/env bash
set -euo pipefail
if grep -RInE '(ACCESS_TOKEN|API_KEY|PASSWORD|SECRET)=.{8,}' . --exclude-dir=.git --exclude='.env.example' --exclude='check-secrets.sh'; then
  echo 'Possible committed secret detected.' >&2
  exit 1
fi
echo 'No obvious committed secrets detected.'
