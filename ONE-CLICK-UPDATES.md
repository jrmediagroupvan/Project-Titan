# Project TITAN v4.3 True One-Click Updates

The Owner can open **Update Center** and press **Update Now**.

The update process automatically:

1. Creates a PostgreSQL database dump.
2. Archives uploads and preserves `.env`.
3. Saves the current source for rollback.
4. Clones the newest configured GitHub branch into staging.
5. Runs a clean staged Docker builder validation.
6. Activates the validated source.
7. Builds the application and updater images.
8. Starts PostgreSQL, Redis, and MinIO.
9. Applies Prisma migrations.
10. Starts the full TITAN stack.
11. Runs the application health check.
12. Restores the previous source and database automatically if deployment fails.

## Required `.env` values

```env
TITAN_UPDATE_TOKEN=use-a-random-secret-of-at-least-64-characters
TITAN_UPDATE_BRANCH=main
TITAN_GIT_REPOSITORY=https://github.com/jrmediagroupvan/Project-Titan.git
TITAN_PROJECT_DIR=/project-titan
TITAN_UPDATER_URL=http://updater:8787
```

Generate the updater token with:

```bash
openssl rand -hex 48
```

Only users with the `OWNER` role can call the update API.
