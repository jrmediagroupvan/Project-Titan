# Changelog

## 4.0.0
- Stable theme rebuild and animated branding.
- Removed malformed root-level theme files.
- Added CI, encoding checks, import checks, staged updates, rollback, and Windows bootstrap.

# Project TITAN Changelog

## 8.0.0 — Operation FORGE

Project TITAN v8.0 is the consolidated commercial and enterprise release. It keeps the existing CRM and production platform while standardizing the expanded modules under one version.

### Highlights

- TITAN Figure Forge photo-to-figurine project workflow
- AI STL tools and provider-ready generation adapters
- CRM, customer editing, archival, and protected permanent deletion
- Quotes, orders, payments, shipments, production, inventory, and reporting
- Default quote markup of 13 percent with permission-controlled overrides
- Per-user Gmail and email account isolation
- Shared team mailboxes with explicit read and send grants
- User management, roles, granular permissions, and audit trails
- Customer portal, support tickets, tasks, calendar, and knowledge base
- Printer connectors, production scheduling, maintenance, and quality control
- Supplier records, purchase orders, material market pricing, and margin intelligence
- Sales-channel, plugin, automation, notification, API-key, and webhook foundations
- Security center, backup registry, update center, and operational diagnostics

### Version consistency fixes

- Updated `VERSION` to `8.0.0`
- Updated `package.json` and root `package-lock.json` metadata to `8.0.0`
- Updated the application shell version label
- Promoted the Operation FORGE documentation to the primary `README.md`
- Retained the v7 README under `docs/releases/README-v7.0-legacy.md`

### Deployment note

This archive is a source release. Run the Docker build and Prisma migration on the deployment server before using it in production.

## 4.0.1 - Logo Runtime Fix

- Replaced next/image branding with static public image assets.
- Added cropped transparent sidebar and top-bar logo files.
- Preserved animated float and blue-glow effects.
- Prevented broken image icons in standalone Docker deployments.
