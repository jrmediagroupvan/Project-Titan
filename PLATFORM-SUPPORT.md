# Project TITAN platform support

Project TITAN uses one GitHub `main` branch for every supported Docker platform. Application features must not be implemented in separate platform-specific copies.

## Supported deployment targets

- Ubuntu Server with Docker Engine and Docker Compose v2
- UGREEN UGOS Pro with the Docker app and Docker Compose projects
- TrueNAS SCALE
- Unraid
- Synology Container Manager
- QNAP Container Station
- Windows and macOS with Docker Desktop
- Generic Linux hosts with Docker Compose v2
- AMD64 and ARM64 hosts

Use `./install-platform.sh PLATFORM` for a command-line deployment, or add
`--prepare-only` to generate and validate the private environment before
importing `docker-compose.yml` in a NAS or Docker Desktop interface.

## Shared release requirements

Every update must:

1. Keep application paths relative to the repository or configurable through `.env`.
2. Avoid hard-coded usernames, NAS volume numbers, LAN IP addresses, and host-specific home folders in runtime code.
3. Keep `docker-compose.yml` valid for command-line Docker Compose and the UGREEN Docker Project importer.
4. Keep required build inputs such as `config/material-rates.json` inside the repository and Docker build context.
5. Preserve existing `.env`, PostgreSQL data, Redis data, MinIO data, uploads, and backups.
6. Support AMD64 and ARM64 images and dependencies.
7. Document new environment variables in `.env.example` and `README.md`.
8. Never commit real credentials, customer information, uploads, databases, or backups.

## Validation checklist

Before publishing a release:

```bash
npm ci
npx prisma validate
npm run typecheck
npm test
npm run build
docker compose config
```

Also verify:

- `config/material-rates.json` and every other static import are present in a fresh Git checkout.
- Ubuntu entry point: `sudo ./install.sh`
- UGREEN entry point: `./install-ugreen.sh`
- Universal entry point: `./install-platform.sh auto`
- NAS/desktop preparation: `./install-platform.sh PLATFORM --prepare-only`
- UGREEN GUI import: `docker-compose.yml` loads with `.env` beside it.
- Health endpoint: `http://HOST-IP:1200/api/health`

Live SMTP, IMAP, Gmail OAuth, Square, and external storage checks require the operator's own credentials and network access.

## Update policy

Publish complete source releases to `main`. Incremental ZIPs may be supplied for existing installations, but they must never replace the complete GitHub repository or be presented as fresh-install packages.
