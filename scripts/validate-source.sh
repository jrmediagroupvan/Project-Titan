#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_DIR="$ROOT/validation-logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/validation-$STAMP.log"

required=(
  package.json
  package-lock.json
  Dockerfile
  docker-compose.yml
  prisma/schema.prisma
  app
  components
  lib
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required source item is missing: $path" | tee -a "$LOG" >&2; exit 1; }
done

# Next.js projects may have no static assets yet, but the production Docker
# stage still expects /app/public. Create it automatically and preserve it in Git.
mkdir -p public
[[ -e public/.gitkeep ]] || : > public/.gitkeep

# Catch common incomplete feature uploads before Docker spends time building.
python3 - <<'PY' | tee -a "$LOG"
from pathlib import Path
import re, sys
roots=[Path('app'),Path('components'),Path('lib')]
missing=[]
pat=re.compile(r'''(?:from\s+|import\s*\()['\"]@/([^'\"]+)['\"]''')
for root in roots:
    if not root.exists(): continue
    for f in root.rglob('*'):
        if f.suffix not in {'.ts','.tsx','.js','.jsx'}: continue
        try: text=f.read_text(encoding='utf-8')
        except Exception: continue
        for rel in pat.findall(text):
            base=Path(rel)
            candidates=[base,base.with_suffix('.ts'),base.with_suffix('.tsx'),base.with_suffix('.js'),base.with_suffix('.jsx'),base/'index.ts',base/'index.tsx']
            if not any(c.exists() for c in candidates):
                missing.append((str(f),rel))
if missing:
    print('Missing @/ imports detected:')
    for f,rel in sorted(set(missing)): print(f'  {f}: @/{rel}')
    sys.exit(1)
print('Import completeness check passed.')
PY

# Build only through the builder stage. This runs npm ci, Prisma validation,
# Prisma generation, TypeScript checking, and the full Next.js production build.
echo "Running clean Docker validation build..." | tee -a "$LOG"
if ! docker build --pull --no-cache --target builder -t project-titan:validated . 2>&1 | tee -a "$LOG"; then
  echo >&2
  echo "Project TITAN validation failed. Nothing was installed or replaced." >&2
  echo "Full log: $LOG" >&2
  echo "First useful errors:" >&2
  grep -nA12 -B5 -E 'Type error:|Failed to type check|Module not found|Prisma schema validation|Error code:|ERROR:' "$LOG" | head -160 >&2 || true
  exit 1
fi

echo "Project TITAN source validation passed." | tee -a "$LOG"
