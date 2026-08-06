# Project TITAN Cross-Platform GitHub Overlay

This package is designed to be copied over the current Project TITAN repository.

It provides one Docker deployment for:

- Windows 10/11 x64 with Docker Desktop
- Ubuntu with Docker Engine and the Compose plugin
- UGREEN NAS with the Docker app enabled

## Important

This is an **overlay**, not a replacement for the application folders. Keep the
existing `app`, `components`, `lib`, `prisma`, `public`, and other source folders.

## Upload to GitHub

Copy the contents of this folder into the root of the Project TITAN repository,
preserving all paths.

Then run once from the repository root:

```bash
node scripts/apply-cross-platform-fixes.mjs
```

Commit the resulting changes, including the updated `package.json` and
`app/api/figure-forge/route.ts`.

## Windows

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install\install-windows.ps1
```

## Ubuntu

```bash
chmod +x install/*.sh
./install/install-ubuntu.sh
```

## UGREEN

Enable Docker from the UGREEN App Center, open SSH in the Project TITAN folder,
then run:

```bash
chmod +x install/*.sh
./install/install-ugreen.sh
```

## Access

Open:

```text
http://DEVICE-IP:1200
```

## Data portability

PostgreSQL, Redis, MinIO, uploads, and application storage use Docker named
volumes. This avoids Windows/Linux/NAS bind-mount permission differences.
