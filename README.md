# Project TITAN Version 4.0

# Project TITAN

```{=html}
<p align="center">
```
`<img src="docs/images/Project-Titan.png" alt="Project TITAN" width="100%">`{=html}
```{=html}
</p>
```
```{=html}
<p align="center">
```
`<strong>`{=html}Project TITAN Version
4.0`</strong>`{=html}`<br>`{=html} Self-hosted CRM, quoting, production,
AI, inventory, email and business operating platform for modern
3D-printing companies.
```{=html}
</p>
```
## What's New in Version 4.0

-   Responsive interface for Desktop, Android, iPhone and tablets
-   Light & Dark themes
-   Mobile hamburger navigation
-   Optional QR-code Two-Step Verification
-   Security Center
-   Trusted devices
-   Recovery codes
-   Login history
-   One-click GitHub updater
-   Automatic rollback protection
-   Enhanced TITAN AI
-   AI STL Developer improvements
-   Figure Forge framework
-   Improved Bambu integration
-   Better dashboard widgets
-   Faster Docker deployment
-   Improved permissions and audit logging

## Documentation

Keep your existing documentation table and expand it with:

  Guide             Description
  ----------------- -------------------------------------------
  Security Center   QR setup, trusted devices, recovery codes
  Mobile            Responsive UI and navigation
  Update Center     One-click updates and rollback
  Installer         Windows and Linux installation
  Figure Forge      AI figurine generation workflow

## Platform Highlights

### Business Management

-   CRM
-   Quotes
-   Orders
-   Production
-   Inventory
-   Reporting
-   Customer Portal

### Artificial Intelligence

-   TITAN AI
-   AI STL Developer
-   Live AI assistance
-   Permission-aware AI actions

### Security

-   Optional 2FA
-   QR authenticator
-   Login history
-   Audit logs
-   Encrypted credentials

### Supported Platforms

-   Ubuntu
-   Windows
-   Docker
-   TrueNAS
-   Synology
-   QNAP
-   Unraid
-   Android
-   iPhone

# Current Core Features

## CRM & Customer Management

Project TITAN centralizes customers, companies, contacts, files,
production, quotes and communications into a single workspace.

### Highlights

-   Customer & company profiles
-   Unlimited contacts
-   Customer notes
-   File management
-   Customer portal
-   Assigned customer restrictions
-   Permission controlled editing
-   Audit logging
-   Activity timeline

------------------------------------------------------------------------

## Quotes & Pricing

-   Material pricing
-   Machine time
-   Setup fees
-   Waste calculations
-   Default 13% markup
-   Manual overrides
-   Draft quote workflow
-   Print weight & time import from Bambu Studio

------------------------------------------------------------------------

## Production

-   Production queue
-   Printer assignments
-   Job status
-   Scheduling
-   Due dates
-   Completion tracking

------------------------------------------------------------------------

## Inventory

-   Material inventory
-   Low stock alerts
-   Reorder levels
-   Cost tracking
-   Supplier management

------------------------------------------------------------------------

## Email

-   Gmail OAuth
-   IMAP
-   SMTP
-   Shared mailboxes
-   Private mailboxes
-   Email to Quote workflow
-   Attachments
-   Signatures

------------------------------------------------------------------------

## TITAN AI

Version 4.0 expands TITAN AI with:

-   CRM-aware conversations
-   Quote assistance
-   Production planning
-   Live web research (when configured)
-   Writing assistance
-   Image analysis
-   Permission-aware actions
-   Approval gated operations

------------------------------------------------------------------------

## AI STL Developer

-   Plain-language part creation
-   Parametric workflows
-   STL generation
-   Revision history
-   Interactive previews
-   Export management

------------------------------------------------------------------------

## Figure Forge

Future-ready workflow for AI-assisted figurine generation.

------------------------------------------------------------------------

## Uploads & 3D Files

Supported formats:

-   STL
-   3MF
-   STEP/STP
-   OBJ
-   G-code
-   PDF
-   Images
-   ZIP
-   CSV

Features:

-   Browser preview
-   Secure downloads
-   Customer permissions
-   Persistent Docker storage

------------------------------------------------------------------------

## Dashboard

Version 4.0 includes:

-   Responsive dashboard
-   Desktop layout
-   Mobile layout
-   Light theme
-   Dark theme
-   Improved calendar
-   Task widgets
-   KPI cards
-   Operations overview

------------------------------------------------------------------------

## Security Center

New in Version 4.0

-   Optional QR-code Two-Step Verification
-   Manual setup key
-   Trusted devices
-   Recovery codes
-   Login history
-   Device management
-   Audit logs

------------------------------------------------------------------------

## Mobile Experience

Designed for:

-   Desktop
-   Laptop
-   Android
-   iPhone
-   Tablets

Includes:

-   Responsive layout
-   Hamburger navigation
-   Touch-friendly controls
-   Optimized cards

# Installation

## Supported Platforms

-   Ubuntu Server
-   Windows 11
-   Docker
-   TrueNAS SCALE
-   Synology
-   QNAP
-   Unraid
-   UGREEN NAS

## Quick Start

``` bash
git clone https://github.com/jrmediagroupvan/Project-Titan.git
cd Project-Titan
cp .env.example .env
chmod 600 .env
nano .env
docker compose build --no-cache app
docker compose up -d
docker compose run --rm app npx prisma db push
docker compose up -d --force-recreate app
```

Open:

``` text
http://SERVER-IP:1200
```

## Environment

Configure:

-   DATABASE_URL
-   AUTH_SECRET
-   NEXTAUTH_URL
-   Redis
-   MinIO
-   Email
-   AI Provider
-   Printer integration

## One-Click Installer

Version 4.0 includes an installer workflow designed to:

-   Validate prerequisites
-   Create the application environment
-   Build Docker containers
-   Initialize the database
-   Verify application health

## One-Click Update Center

Owner users can update from GitHub with:

-   Backup
-   Download latest release
-   Validation
-   Database migration
-   Restart
-   Health check
-   Automatic rollback if validation fails

## Backup & Restore

Recommended before every update:

-   Database backup
-   Uploads backup
-   Configuration backup
-   Verify restore process

## Troubleshooting

Useful commands:

``` bash
docker compose ps
docker compose logs --tail=200 app
curl http://127.0.0.1:1200/api/health
```

Check:

-   Database connectivity
-   Docker status
-   Environment variables
-   Storage permissions
-   Email configuration

## Best Practices

-   Keep `.env` private.
-   Use strong unique secrets.
-   Enable HTTPS before Internet exposure.
-   Review permissions regularly.
-   Back up before upgrades.

## Roadmap

Future enhancements include:

-   Expanded Figure Forge
-   Additional AI workflows
-   Multi-company support
-   Marketplace synchronization
-   Mobile applications
-   Plugin ecosystem

## Support

Before opening an issue:

1.  Gather logs.
2.  Confirm the latest version.
3.  Review troubleshooting documentation.
4.  Include reproduction steps.

## License

Project TITAN Version 4.0 is intended as a self-hosted platform.

Never commit:

-   Passwords
-   API keys
-   OAuth secrets
-   Customer files
-   Database exports
-   Private configuration

------------------------------------------------------------------------
