# TITAN Figure Forge

TITAN Figure Forge is an additive Project TITAN module. It preserves the existing CRM, quoting, Gmail, permissions, customer portal, production, inventory, Bambu, AI assistant, AI STL Developer, reports, pricing, and updater features.

## What it adds

- New **TITAN Figure Forge** sidebar category
- JPG, PNG, and WEBP photo uploads
- Bobblehead, chibi, realistic bust, cartoon, hero, mascot, pet, and trophy styles
- Round, square, hexagon, trophy, and logo bases
- Nameplate text and custom design instructions
- Private per-user projects; the Owner can access all projects
- STL preview and download
- Export to Customer Files for quoting, slicing, and production
- Audit logging and existing Project TITAN permission enforcement
- Customer assignment and deletion of project files

## Provider configuration

The CRM manages the workflow, but a detailed photo-to-figurine STL requires an image-to-3D engine. Connect a provider in `.env`:

```env
TITAN_FORGE_PROVIDER=CUSTOM_HTTP
TITAN_FORGE_API_URL=https://provider.example/v1/photo-to-stl
TITAN_FORGE_API_KEY=replace_me
```

The endpoint receives multipart form fields:

- `image`
- `title`
- `style`
- `baseStyle`
- `nameplateText`
- `instructions`
- `outputFormat=stl`

Supported successful responses:

1. Raw STL bytes with `Content-Type: model/stl` or `application/octet-stream`.
2. JSON with `stlBase64`.
3. JSON with `stlUrl`.
4. JSON with `jobId` and a processing status. Asynchronous provider polling can be added for a specific provider API.

Local HTTP is permitted only for `localhost` and `127.0.0.1`; remote providers must use HTTPS.

## Upgrade

```bash
cd ~/Project-Titan
sudo ./scripts/backup.sh
sudo docker compose build --no-cache app
sudo docker compose up -d
sudo docker compose exec -T app npx prisma migrate deploy
sudo docker compose restart app
```
