#!/usr/bin/env sh
set -eu

# ============================================================
# PROJECT TITAN — COMMON DOCKER INSTALLER
# Windows Docker uses its own PowerShell wrapper.
# Ubuntu and UGREEN call this installer.
# ============================================================

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"

cd "$PROJECT_DIR"

echo
echo "============================================================"
echo "              PROJECT TITAN INSTALLER"
echo "============================================================"
echo
echo "Project directory:"
echo "  $PROJECT_DIR"
echo

# ------------------------------------------------------------
# Check required files
# ------------------------------------------------------------

if [ ! -f "package.json" ] ||
   [ ! -f "Dockerfile" ] ||
   [ ! -f "docker-compose.yml" ]; then
  echo "ERROR: Project TITAN files were not found."
  echo
  echo "Expected repository root:"
  echo "  $PROJECT_DIR"
  exit 1
fi

# ------------------------------------------------------------
# Check Docker
# ------------------------------------------------------------

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is installed but is not running,"
  echo "or your user does not have permission to use it."
  echo
  echo "On Ubuntu, run:"
  echo "  sudo usermod -aG docker \$USER"
  echo
  echo "Then log out and back in."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: The Docker Compose plugin is unavailable."
  exit 1
fi

# ------------------------------------------------------------
# Apply known source fixes
# ------------------------------------------------------------

if [ -f "scripts/apply-cross-platform-fixes.mjs" ]; then
  echo "Applying Project TITAN compatibility fixes..."

  if command -v node >/dev/null 2>&1; then
    node scripts/apply-cross-platform-fixes.mjs
  else
    echo "Node.js is not installed on the host."
    echo "Running the compatibility fixer in a temporary container..."

    docker run --rm \
      -v "$PROJECT_DIR:/project" \
      -w /project \
      node:22-alpine \
      node scripts/apply-cross-platform-fixes.mjs
  fi
else
  echo "WARNING: scripts/apply-cross-platform-fixes.mjs was not found."
  echo "Continuing without automatic source fixes."
fi

# ------------------------------------------------------------
# Create the default environment file
# ------------------------------------------------------------

if [ ! -f ".env" ]; then
  echo
  echo "Creating the default Project TITAN configuration..."

  cat > ".env" <<'EOF'
########################################
# PROJECT TITAN
########################################

NODE_ENV=production
PORT=3000

TITAN_BIND_ADDRESS=0.0.0.0
TITAN_PORT=1200
WEB_PORT=1200

TITAN_BASE_URL=http://localhost:1200
NEXTAUTH_URL=http://localhost:1200

########################################
# POSTGRESQL
########################################

POSTGRES_USER=titan
POSTGRES_PASSWORD=TitanDatabase2026
POSTGRES_DB=titan

DATABASE_URL=postgresql://titan:TitanDatabase2026@postgres:5432/titan

########################################
# REDIS
########################################

REDIS_URL=redis://redis:6379

########################################
# MINIO
########################################

MINIO_ROOT_USER=titan
MINIO_ROOT_PASSWORD=TitanStorage2026

# Compatibility with older TITAN releases
MINIO_ACCESS_KEY=titan
MINIO_SECRET_KEY=TitanStorage2026

MINIO_ENDPOINT=http://minio:9000
MINIO_CONSOLE_PORT=9001

########################################
# AUTHENTICATION
########################################

AUTH_SECRET=4f27d67d658a4203a991763ea62562c96316418518b4464c91873891634e85ab
NEXTAUTH_SECRET=4f27d67d658a4203a991763ea62562c96316418518b4464c91873891634e85ab

########################################
# CREDENTIAL ENCRYPTION
########################################

CREDENTIAL_ENCRYPTION_KEY=2847538f2ce46f42bab163b250d2709a6674188f373b49d7840bd9c6285e520d

########################################
# DEFAULT OWNER ACCOUNT
########################################

OWNER_EMAIL=admin@example.com
OWNER_PASSWORD=TitanAdmin123!

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=TitanAdmin123!

########################################
# STORAGE
########################################

TITAN_UPLOAD_DIR=/app/uploads
TITAN_STORAGE_DIR=/app/storage

########################################
# COOKIE SETTINGS
########################################

COOKIE_SECURE=false

########################################
# OPTIONAL AI PROVIDERS
########################################

OPENROUTER_API_KEY=
OPENAI_API_KEY=

########################################
# OPTIONAL FIGURE FORGE
########################################

TITAN_FORGE_PROVIDER=
TITAN_FORGE_ENDPOINT=
TITAN_FORGE_API_KEY=
EOF

  chmod 600 ".env"

  echo
  echo "Default .env configuration created."
else
  echo
  echo "Existing .env detected."
  echo "Keeping the current passwords and configuration."
fi

# ------------------------------------------------------------
# Validate environment variables
# ------------------------------------------------------------

required_variables="
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
DATABASE_URL
MINIO_ROOT_USER
MINIO_ROOT_PASSWORD
AUTH_SECRET
CREDENTIAL_ENCRYPTION_KEY
"

for variable in $required_variables; do
  if ! grep -q "^${variable}=.\+" ".env"; then
    echo "ERROR: Required .env variable is missing or blank:"
    echo "  $variable"
    exit 1
  fi
done

echo
echo "Environment configuration validated."

# ------------------------------------------------------------
# Validate Docker Compose
# ------------------------------------------------------------

echo
echo "Validating Docker Compose configuration..."

docker compose config --quiet

# ------------------------------------------------------------
# Stop old containers without deleting data
# ------------------------------------------------------------

echo
echo "Stopping any previous Project TITAN containers..."

docker compose down --remove-orphans || true

# ------------------------------------------------------------
# Build Project TITAN
# ------------------------------------------------------------

echo
echo "Building Project TITAN..."
echo "This may take several minutes."
echo

docker compose build \
  --pull \
  --no-cache \
  app

# Build updater when its Dockerfile exists.
if [ -f "Dockerfile.updater" ]; then
  docker compose build \
    --pull \
    --no-cache \
    updater
fi

# ------------------------------------------------------------
# Start database infrastructure
# ------------------------------------------------------------

echo
echo "Starting PostgreSQL, Redis and MinIO..."

docker compose up -d postgres redis minio

# ------------------------------------------------------------
# Wait for a container to become healthy
# ------------------------------------------------------------

wait_for_health() {
  container_name="$1"
  display_name="$2"
  attempts=0

  echo "Waiting for $display_name..."

  while :; do
    status="$(
      docker inspect \
        --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$container_name" \
        2>/dev/null || true
    )"

    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      echo "$display_name is ready."
      break
    fi

    if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ]; then
      echo
      echo "ERROR: $display_name failed to start."
      docker compose logs --tail=150 "$3"
      exit 1
    fi

    attempts=$((attempts + 1))

    if [ "$attempts" -gt 60 ]; then
      echo
      echo "ERROR: Timed out waiting for $display_name."
      docker compose logs --tail=150 "$3"
      exit 1
    fi

    printf '.'
    sleep 3
  done

  echo
}

wait_for_health "titan-postgres" "PostgreSQL" "postgres"
wait_for_health "titan-redis" "Redis" "redis"
wait_for_health "titan-minio" "MinIO" "minio"

# ------------------------------------------------------------
# Initialize the database
# ------------------------------------------------------------

echo
echo "Applying the Project TITAN database schema..."

docker compose run --rm app npx prisma db push

echo
echo "Creating the initial owner account..."

if docker compose run --rm app npx prisma db seed; then
  echo "Database seed completed."
elif docker compose run --rm app npm run seed; then
  echo "Database seed completed using npm."
else
  echo "WARNING: The seed command did not complete."
  echo "Project TITAN may provide first-login owner creation."
fi

# ------------------------------------------------------------
# Start Project TITAN
# ------------------------------------------------------------

echo
echo "Starting Project TITAN..."

docker compose up -d --force-recreate app

# Start updater only if it is enabled without a Compose profile.
if docker compose config --services | grep -qx "updater"; then
  docker compose up -d updater 2>/dev/null || true
fi

# ------------------------------------------------------------
# Wait for the application
# ------------------------------------------------------------

echo
echo "Waiting for the Project TITAN web interface..."

attempts=0

while :; do
  if curl -fsS \
    "http://127.0.0.1:1200/api/health" \
    >/dev/null 2>&1; then
    break
  fi

  if curl -fsS \
    "http://127.0.0.1:1200" \
    >/dev/null 2>&1; then
    break
  fi

  attempts=$((attempts + 1))

  if [ "$attempts" -gt 60 ]; then
    echo
    echo "WARNING: Project TITAN started, but the web health check"
    echo "did not respond within the expected time."
    echo
    docker compose logs --tail=150 app
    break
  fi

  printf '.'
  sleep 3
done

echo
echo

docker compose ps

SERVER_IP="$(
  hostname -I 2>/dev/null |
  awk '{print $1}'
)"

if [ -z "$SERVER_IP" ]; then
  SERVER_IP="YOUR-SERVER-IP"
fi

echo
echo "============================================================"
echo "          PROJECT TITAN INSTALLATION COMPLETE"
echo "============================================================"
echo
echo "Open Project TITAN:"
echo
echo "  http://${SERVER_IP}:1200"
echo
echo "Default owner account:"
echo
echo "  Email:    admin@example.com"
echo "  Password: TitanAdmin123!"
echo
echo "Default database password:"
echo
echo "  TitanDatabase2026"
echo
echo "Default MinIO password:"
echo
echo "  TitanStorage2026"
echo
echo "IMPORTANT:"
echo "Change the owner password and internal secrets before"
echo "exposing Project TITAN to the public internet."
echo
