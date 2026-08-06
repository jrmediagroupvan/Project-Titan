# Installation Guide

## Supported Platforms

- Ubuntu and Debian
- UGREEN UGOS Pro
- TrueNAS SCALE
- Unraid
- Synology
- QNAP
- Generic Linux Docker hosts
- Docker Desktop on Windows and macOS

## Requirements

- Docker Engine and Docker Compose
- Git
- 4 GB RAM recommended
- Persistent storage for PostgreSQL, uploads, MinIO, and backups
- A private `.env`

## Ubuntu Installation

```bash
sudo apt update
sudo apt install -y git curl ca-certificates unzip openssl

git clone https://github.com/jrmediagroupvan/Project-Titan.git
cd Project-Titan

sudo chown -R "$(id -un):$(id -gn)" .

chmod +x install.sh install/*.sh scripts/titan scripts/*.sh

sudo ./install.sh
```

Verify:

```bash
sudo docker compose ps
sudo docker compose logs --tail=150 app
curl http://127.0.0.1:1200/api/health
```

## Manual Docker Installation

```bash
cp .env.example .env
chmod 600 .env
nano .env
sudo docker compose build --no-cache app
sudo docker compose up -d
sudo docker compose run --rm app npx prisma db push
sudo docker compose up -d --force-recreate app
```

## NAS Installation

Place the repository contents directly inside the selected project folder. Do not leave the application inside an extra nested directory. Keep `.env` beside `docker-compose.yml`.

For GUI-based Docker deployment, prepare `.env` first, create persistent directories, then import `docker-compose.yml`.

## Docker Desktop

Clone or extract the repository, create `.env`, then run:

```powershell
docker compose build --no-cache app
docker compose up -d
docker compose run --rm app npx prisma db push
```

Open `http://localhost:1200`.

## First Login

1. Sign in with the temporary OWNER credentials.
2. Change the password.
3. Configure Business Settings.
4. Create staff accounts.
5. Assign permissions.
6. Configure email and integrations.
