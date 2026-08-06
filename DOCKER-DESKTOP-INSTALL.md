# Project TITAN — Docker Desktop Installation Guide

This guide installs Project TITAN on Windows with Docker Desktop, Git, PowerShell, and the official GitHub repository:

```text
https://github.com/jrmediagroupvan/Project-Titan
```

Project TITAN opens at:

```text
http://localhost:1200
```

> [!IMPORTANT]
> Never commit `.env` to GitHub. It contains passwords, encryption keys, API keys, and other private configuration.

## Requirements

Install the following before continuing:

- Windows 10 or Windows 11 with WSL 2 support
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git for Windows](https://git-scm.com/download/win)
- Docker Desktop configured to use **Linux containers**
- At least 8 GB of available RAM and 10 GB of free disk space

If you plan to use Docker's Gordon assistant, install Docker Desktop 4.74 or newer and sign in to your Docker account.

## Option 1 — Install with PowerShell

### 1. Start Docker Desktop

Open Docker Desktop and wait until the Docker engine reports that it is running.

### 2. Clone Project TITAN

Open PowerShell and run:

```powershell
cd "$HOME\Documents"
git clone https://github.com/jrmediagroupvan/Project-Titan.git
cd Project-Titan
```

If the `Project-Titan` folder already exists, do not clone over it. See [Updating an existing installation](#updating-an-existing-installation).

### 3. Create the private environment file

```powershell
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

notepad .env
```

Complete every required value described in `.env.example`.

Use long, unique passwords. You can generate random 64-character secrets in PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

Generate a different value each time the application requests a separate secret. Do not reuse database, administrator, encryption, session, update, or API credentials.

Save `.env`, then close Notepad.

### 4. Validate the Compose configuration

```powershell
docker compose config --quiet
```

If this command reports a missing or invalid environment value, correct `.env` before continuing.

### 5. Build and start the supporting services

```powershell
docker compose build
docker compose up -d postgres redis minio
docker compose ps
```

Wait until the supporting services are healthy.

### 6. Apply the database schema

```powershell
docker compose run --rm app npx prisma db push
```

> [!WARNING]
> If Prisma warns that data may be lost, stop. Do not add `--accept-data-loss`. Back up the installation and review the migration before continuing.

### 7. Start Project TITAN

```powershell
docker compose up -d --force-recreate
docker compose ps
docker compose logs --tail=150 app
```

### 8. Verify the installation

```powershell
Invoke-RestMethod http://localhost:1200/api/health
```

When the response reports that TITAN is healthy, open:

[http://localhost:1200](http://localhost:1200)

Sign in using the owner credentials configured in your private `.env` file. Change any temporary password immediately.

## Option 2 — Install with Docker Desktop Gordon

Gordon is available in Docker Desktop 4.74 or newer. It proposes actions and waits for your approval before executing them.

### 1. Open Gordon

1. Open Docker Desktop and sign in.
2. Select **Gordon** in the sidebar.
3. Choose your Windows `Documents` folder as the working directory.

You can also start Gordon from PowerShell:

```powershell
cd "$HOME\Documents"
docker ai
```

### 2. Give Gordon this installation prompt

Copy the entire prompt below into Gordon:

```text
Install Project TITAN from:
https://github.com/jrmediagroupvan/Project-Titan.git

Use the current working directory and clone the repository into a folder named
Project-Titan. If that folder already exists, stop and ask whether this is an
update. Never overwrite an existing .env file.

Before starting TITAN:

1. Inspect README.md, DOCKER-DESKTOP-INSTALL.md, compose.yaml,
   docker-compose.yml, .env.example, Dockerfile, and the installation helpers
   that actually exist in the repository.
2. Confirm Docker Desktop is running Linux containers.
3. Copy .env.example to .env only when .env does not exist.
4. Tell me which required .env values need to be completed, then pause.
5. Never display passwords, tokens, encryption keys, API keys, or other secrets.
6. Never run docker compose down -v.
7. Never delete or replace volumes, databases, uploads, backups, or customer data.

After I confirm that .env is ready:

1. Run docker compose config --quiet.
2. Build the required Project TITAN images.
3. Start PostgreSQL, Redis, and MinIO and wait for them to become healthy.
4. Run docker compose run --rm app npx prisma db push.
5. If Prisma warns about data loss, stop without accepting data loss.
6. Start all Project TITAN services.
7. Show docker compose ps.
8. Inspect recent app and updater logs for errors.
9. Test http://localhost:1200/api/health.
10. If the health check succeeds, tell me to open http://localhost:1200.
11. If anything fails, diagnose it from the configuration, service health,
    and container logs, then propose the safest correction.
```

When Gordon pauses, edit:

```text
Documents\Project-Titan\.env
```

After saving the file, tell Gordon:

```text
I completed the .env configuration. Continue the installation and verify every Project TITAN service.
```

Review every proposed command before approving it.

## Updating an existing installation

These steps preserve `.env` and Docker volumes. Commit or safely store any local source-code changes before updating.

```powershell
cd "$HOME\Documents\Project-Titan"
git status
git pull --ff-only origin main
docker compose build --no-cache app updater
docker compose run --rm app npx prisma db push
docker compose up -d --force-recreate
docker compose ps
Invoke-RestMethod http://localhost:1200/api/health
```

If `git pull --ff-only` reports local changes or a conflict, stop and resolve those changes first. Do not force-reset the repository if it contains work you need.

> [!IMPORTANT]
> Do not replace your existing `.env` with `.env.example` during an update.

## Routine Docker commands

Run these commands from the `Project-Titan` folder.

### View service status

```powershell
docker compose ps
```

### View recent logs

```powershell
docker compose logs --tail=200 app updater
```

### Follow live application logs

```powershell
docker compose logs -f --tail=100 app
```

Press `Ctrl+C` to stop following logs. This does not stop TITAN.

### Restart TITAN

```powershell
docker compose restart
```

### Stop TITAN without deleting data

```powershell
docker compose stop
```

### Start TITAN again

```powershell
docker compose start
```

### Rebuild after source changes

```powershell
docker compose build app updater
docker compose up -d --force-recreate
```

## Troubleshooting

### TITAN does not open on port 1200

```powershell
docker compose ps
docker compose logs --tail=250 app
Get-NetTCPConnection -LocalPort 1200 -ErrorAction SilentlyContinue
```

Confirm that another program is not already using port `1200` and that Docker Desktop is running.

### A service is unhealthy

```powershell
docker compose ps
docker compose logs --tail=250 postgres redis minio app updater
```

Correct the first reported configuration or connection error, then recreate the affected services:

```powershell
docker compose up -d --force-recreate
```

### The application was changed but the browser looks old

Rebuild the application and refresh the browser:

```powershell
docker compose build --no-cache app
docker compose up -d --force-recreate app
```

Then press `Ctrl+F5` in the browser.

### The health check fails

```powershell
docker compose ps
docker compose logs --since=10m app
curl.exe http://localhost:1200/api/health
```

### Docker Desktop does not have enough resources

Open **Docker Desktop → Settings → Resources** and increase the available memory or disk capacity. Restart Docker Desktop afterward.

### Reset warnings

Never use the following command during ordinary troubleshooting:

```text
docker compose down -v
```

The `-v` option deletes named volumes and can permanently remove the TITAN database and stored service data.

## Security checklist

- Keep `.env` private and excluded from Git.
- Use different random values for different secrets.
- Do not publish logs containing credentials or private customer information.
- Do not expose PostgreSQL, Redis, or MinIO ports to the public internet.
- Restrict TITAN to trusted users and use HTTPS when accessing it beyond the local computer.
- Back up the database and uploaded files before every major update.
- Review Gordon's proposed commands before approving them.
- Never accept Prisma data loss without first confirming and backing up the affected data.

## Official references

- [Docker Gordon documentation](https://docs.docker.com/ai/gordon/)
- [Using Gordon in Docker Desktop](https://docs.docker.com/ai/gordon/how-to/docker-desktop/)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [Project TITAN repository](https://github.com/jrmediagroupvan/Project-Titan)

---

© 2026 3D Print BC / Justin Ruscheinski. All Rights Reserved.
