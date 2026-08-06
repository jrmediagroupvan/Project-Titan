# Project TITAN v4.0 — Operation FORGE

Project TITAN is a self-hosted 3D-printing CRM and business operating platform.

## Quick install

### Ubuntu
```bash
git clone https://github.com/jrmediagroupvan/Project-Titan.git
cd Project-Titan
sudo ./install.sh
```

### Windows
Run `install\install-windows.cmd` as Administrator. Docker Desktop may require a first-run confirmation or restart.

## Validate before release
```bash
npm ci
npm run validate
npm test
```

## Safe update
```bash
sudo ./scripts/update.sh
```

See `RELEASE-v4.0.md` for the complete release summary.

---

# Project TITAN

<p align="center">
  <img src="docs/images/Project-Titan.png" alt="Project TITAN" width="100%">
</p>

<p align="center">
  <strong>Project TITAN v4.0 — Operation FORGE</strong><br>
  Self-hosted CRM, quoting, production, email, AI, inventory, and operations platform for 3D-printing businesses.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-4.0.0-blue">
  <img alt="Docker" src="https://img.shields.io/badge/docker-ready-2496ED">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/database-PostgreSQL-336791">
  <img alt="License" src="https://img.shields.io/badge/Free%20to%20Use-brightgreen">
</p>

> **Build Anything. Manage Everything. Powered by AI.**

Project TITAN brings customer management, quoting, email, file handling, production, inventory, reporting, permissions, and self-hosted business operations into one platform.

This repository uses generic example values only. Never commit passwords, API keys, OAuth secrets, customer files, database exports, mailbox credentials, printer access codes, or private configuration.

---

## Documentation

| Guide | Description |
|---|---|
| [Official Repository](docs/REPOSITORY.md) | Correct GitHub URL, clone command, and Git remote setup |
| [Installation](docs/INSTALLATION.md) | Ubuntu, Docker, UGREEN, TrueNAS, Unraid, Synology, QNAP, and Docker Desktop |
| [Configuration](docs/CONFIGURATION.md) | `.env`, ports, database, storage, URLs, and secrets |
| [CRM & Customers](docs/CRM.md) | Customer records, assignments, uploads, deletion, portal access, and audit history |
| [Quotes & Pricing](docs/QUOTE-ENGINE.md) | 13% default markup, materials, machine rates, tax, slicing data, and quote workflow |
| [Email](docs/EMAIL.md) | Gmail OAuth, IMAP, SMTP, private mailboxes, shared mailboxes, and Email-to-Quote |
| [TITAN AI](docs/AI.md) | AI Assistant, provider setup, permissions, private keys, and approval gates |
| [AI STL Developer](docs/AI-STL-DEVELOPER.md) | Parametric model generation, validation, previews, revisions, and exports |
| [Uploads & 3D Files](docs/UPLOADS.md) | STL, 3MF, STEP, OBJ, G-code, documents, previews, and secure storage |
| [Production & Printers](docs/PRODUCTION.md) | Production jobs, printer assignments, slicing, Bambu bridge, and Bambuddy |
| [Users & Permissions](docs/PERMISSIONS.md) | Roles, feature access, action permissions, customer restrictions, and approvals |
| [Operations & Reporting](docs/OPERATIONS.md) | Dashboards, tasks, calendar, expenses, KPIs, reports, and activity logs |
| [Updates](docs/UPDATES.md) | GitHub updater, manual upgrades, backups, rebuilds, and rollback protection |
| [Backup & Restore](docs/BACKUP-RESTORE.md) | Backup commands, restore planning, persistent data, and validation |
| [Security](docs/SECURITY.md) | Secret handling, HTTPS, access control, audit logs, and deployment hardening |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Docker, Prisma, email, uploads, builds, updates, and common errors |
| [Planned Features](docs/PLANNED-FEATURES.md) | Clearly labeled roadmap items not included in the current release |
| [Roadmap](docs/ROADMAP.md) | Planned release direction and long-term product vision |
| [Changelog](docs/CHANGELOG.md) | Version history and release summary |

---

## Current Core Features

### CRM and Customer Management

- Customer and company profiles
- Contact details, notes, files, tasks, quotes, orders, payments, and shipments
- Assigned-customer access for restricted users
- Customer portal links with expiration and revocation
- Permission-controlled editing and deletion
- Audit records for sensitive actions

### Quotes and Pricing

- Material, machine time, setup fees, minimum charges, tax, and waste allowances
- Inventory and market-price lookup
- Default **13% markup**
- Manual price overrides with permissions
- Saved Bambu slicing weight and print-time data
- Draft quote workflow before customer delivery

### Email

- Private email configuration per user
- Gmail and Google Workspace OAuth
- IMAP and SMTP
- Shared team mailboxes with explicit read/send access
- Inbox, compose, reply, CC, signatures, and deletion permissions
- Email-to-Quote draft workflow

### TITAN AI

- Shared or private AI provider configuration
- Permission-aware CRM context
- AI chat and image permissions
- Live web research when configured
- Quote calculations, file inspection, planning, and writing
- Approval-gated actions
- Private conversation history

### AI STL Developer

- Plain-language part descriptions
- Validated geometry plans
- Binary STL generation
- Revisions using follow-up instructions
- Interactive 3D previews
- Dimensions, triangle count, and revision history
- Customer-file export with permissions and audit logging

### Uploads and 3D Files

- STL, 3MF, STEP/STP, OBJ, G-code, images, PDF, TXT, CSV, and ZIP
- Authenticated downloads
- Customer access enforcement
- Persistent Docker storage
- Browser 3D preview
- Bambu slicing workflow

### Operations

- Production queue
- Printer records and job assignments
- Inventory and reorder levels
- Tasks and calendar
- Expenses and reports
- Operations dashboard
- Audit trail
- Health, backup, doctor, and update scripts

### Security and Permissions

- OWNER, ADMIN, MANAGER, STAFF, PRODUCTION, ACCOUNTING, and VIEWER roles
- Feature category assignments
- View, Create, Edit, and Delete controls
- Assigned-customer restrictions
- Server-side permission enforcement
- Encrypted integration credentials
- OWNER-controlled settings and updates

---
<p align="center">
  <img src="docs/images/Project-Titan-Details.png" alt="Project TITAN" width="100%">
</p>
---


## Dashboard Calendar & Task Upgrade

This update improves the **Operations Dashboard → Upcoming calendar** card.

### Included improvements

- Shows calendar events occurring during the next **30 days**
- Shows events that are already in progress
- Shows shared events with no customer or assignee
- Shows events created by or assigned to the signed-in user
- Shows customer events permitted by the current user profile
- Shows order deadlines in the same calendar panel
- Shows open tasks in a dedicated section below calendar events
- Includes overdue tasks and order deadlines with an **OVERDUE** label
- Keeps completed and cancelled tasks out of the dashboard
- Preserves role-based and assigned-customer access controls

This is a dashboard-only update and does not delete or recreate database records.

---

## Quick Start

```bash
git clone https://github.com/jrmediagroupvan/Project-Titan.git
cd Project-Titan
cp .env.example .env
chmod 600 .env
nano .env
sudo docker compose build --no-cache app
sudo docker compose up -d
sudo docker compose run --rm app npx prisma db push
sudo docker compose up -d --force-recreate app
```

Open:

```text
http://SERVER-IP:1200
```

For complete instructions, see [docs/INSTALLATION.md](docs/INSTALLATION.md).

---
<p align="center">
  <img src="/public/installer.png" alt="Project TITAN" width="100%">
</p>


## Important Deployment Notes

- Keep `.env` private.
- Use independent random secrets.
- Do not run `docker compose down -v` unless you intentionally want to remove persistent volumes.
- Create a backup before updates.
- Use HTTPS before exposing TITAN outside a trusted private network.
- External providers require their own credentials, billing, approvals, and testing.

---

## Planned Features

Future ideas are documented separately and explicitly labeled as planned:

- TITAN Figure Forge photo-to-figurine workflows
- AI image-to-3D generation
- Native mobile applications
- Multi-company and multi-location operations
- Marketplace synchronization
- Vision-based print monitoring
- Advanced warehouse, barcode, and RFID workflows
- Plugin marketplace

See [docs/PLANNED-FEATURES.md](docs/PLANNED-FEATURES.md).

---


## Update Notes — Dashboard Calendar Visibility

The dashboard now uses one consistent server timestamp per request and a 30-day display window. General shared events, ongoing events, user-created events, assigned events, customer-linked events, overdue tasks, and overdue order deadlines can appear when the signed-in user is authorized to see them.

---

## Support

Before reporting a problem:

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 app
curl http://127.0.0.1:1200/api/health
```

Then review [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## License and Commercial Use

Review the repository license and commercial terms before redistribution, resale, hosted-service use, or publishing modified builds.

Project TITAN v4.0 — Operation FORGE  
Designed and maintained as a self-hosted free to use platform.


## v4.3 True One-Click Update

The Owner-only Update Center now performs a complete staged GitHub update with
database/upload backup, clean validation, Prisma migrations, health checks, and
automatic source/database rollback. See `ONE-CLICK-UPDATES.md`.
