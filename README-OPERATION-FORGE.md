# Project TITAN v8.0 — Operation FORGE

**Build Anything. Manage Everything. Powered by AI.**

Operation FORGE is the consolidated Project TITAN enterprise update. It keeps the existing CRM and production platform while bringing the major expansion modules into one GitHub-ready source tree.

## Included platform areas

- Customer CRM, notes, files, portal access, tasks, calendar and audit history
- Quotes, orders, payments, shipments, expenses and business reporting
- Default quote markup of 13%, material pricing sources and margin intelligence
- Users, roles, granular permissions, password management and security center
- Per-user email accounts, Gmail OAuth support and permission-controlled shared mailboxes
- Production queue, printers, Bambu integration, universal connector records and maintenance
- Inventory, suppliers, purchase orders, reorder controls and cost tracking
- TITAN Figure Forge and AI STL development project workflows
- Customer support tickets, knowledge base, quality control and recurring service plans
- Automation rules, plugins, sales channels, API credentials and webhooks
- Notification center, backup registry, update center and business intelligence

## External services

Some modules require credentials or compatible external services before they can perform live actions:

- Gmail requires Google OAuth credentials.
- Figure Forge requires a photo-to-3D provider or self-hosted generation service.
- Square, shipping, marketplaces and printer commands require their respective API credentials.
- AI features require the configured AI provider.

The application should fail clearly when an optional provider is not configured rather than pretending an external operation succeeded.

## Clean installation

```bash
cd ~
git clone https://github.com/YOUR-USERNAME/Project-TITAN.git Project-Titan
cd Project-Titan
cp .env.example .env
nano .env
chmod +x install.sh scripts/*.sh install/*.sh 2>/dev/null || true
sudo docker compose build --no-cache --pull app
sudo docker compose up -d
sudo docker compose exec -T app npx prisma migrate deploy
sudo docker compose exec -T app npm run db:seed
sudo docker compose restart app
sudo docker compose ps
```

Default local address:

```text
http://10.0.1.127:1200
```

## Updating an existing installation

Back up first:

```bash
cd ~/Project-Titan
sudo ./scripts/backup.sh
```

Then update:

```bash
git fetch origin
git reset --hard origin/main
sudo docker compose build --no-cache --pull app
sudo docker compose up -d
sudo docker compose exec -T app npx prisma migrate deploy
sudo docker compose restart app
sudo docker compose ps
```

Never run `docker compose down -v` unless you deliberately want to erase Docker volumes.

## GitHub upload

Upload the contents of this folder to the root of the repository. Do not commit live secrets or runtime data:

```text
.env
uploads/
storage/
backups/
node_modules/
.next/
```

Suggested commit message:

```text
Release Project TITAN v8.0 Operation FORGE
```

## Build status

This archive is a source release. The final Prisma generation, database migration and Next.js production compilation occur during the Docker build on the deployment server.
