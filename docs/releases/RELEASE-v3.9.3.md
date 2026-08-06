# Project TITAN v3.9.3

## AI STL Developer

- Adds a dedicated AI STL Developer workspace and sidebar entry.
- Generates real binary STL geometry from plain-language design requests.
- Supports safe parametric primitives, text, transforms, and Boolean operations.
- Rejects unsupported operations, malformed plans, oversized geometry, excessive complexity, and arbitrary code.
- Shows an interactive 3D preview, exact bounding dimensions, triangle count, file size, and revision number.
- Supports follow-up revision instructions against the saved design plan.
- Downloads generated STL files through authenticated routes.
- Exports generated models into an authorized customer's 3D Files area.
- Hands exported files into the existing Bambu Studio slice and quote workflow.
- Adds separate View, Create, Edit, Delete, and Export permissions.
- Applies personal ownership, OWNER oversight, assigned-customer checks, Uploads permission checks, and audit logging.

## Upgrade

```bash
cd /home/spectral/Project-Titan

sudo ./scripts/titan backup
sudo docker compose build --no-cache app updater
sudo docker compose run --rm app npx prisma db push
sudo docker compose up -d --force-recreate

sudo docker compose ps
curl http://127.0.0.1:1200/api/health
```

Keep the existing `.env`, persistent storage, uploads, and Docker volumes.
