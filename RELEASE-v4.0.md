# Project TITAN v4.0 — Operation FORGE

## Stabilization
- Removed malformed duplicate root theme files that broke TypeScript.
- Added UTF-8 and misplaced-file validation.
- Added local import validation and GitHub Actions.
- Standardized version 4.0.0.

## Branding and themes
- Animated transparent Project TITAN logo in the top-left sidebar and top bar.
- Improved dark, light, and system themes.
- Reduced-motion support.

## Deployment
- Staged updater validates a clean clone before replacing active source.
- Automatic source rollback on deployment or health-check failure.
- Existing `.env`, uploads, storage, and backups are preserved.
- Windows PowerShell bootstrap and Ubuntu installer are included.
