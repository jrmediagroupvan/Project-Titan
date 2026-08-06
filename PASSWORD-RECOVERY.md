# Project TITAN Password Recovery

Project TITAN now includes a secure **Forgot Password** workflow.

## What it adds

- `Forgot your password?` link on the login page
- Email-based reset links
- 30-minute expiration
- One-time-use, SHA-256-hashed reset tokens
- Password minimum of 12 characters
- Generic responses that do not reveal whether an account exists
- Two-minute request throttling per account
- Audit events for reset requests and completions

## Required configuration

1. Set a correct public or LAN base URL in `.env`:

```env
TITAN_BASE_URL=http://SERVER-IP:1200
```

2. Configure at least one active OWNER or team mailbox in **Settings → Email Settings**.

Optional: force a specific outbound mailbox by adding its database ID:

```env
TITAN_RECOVERY_EMAIL_ACCOUNT_ID=MAILBOX_DATABASE_ID
```

3. Apply the migration and rebuild:

```bash
sudo docker compose build --no-cache app
sudo docker compose up -d
sudo docker compose exec app npx prisma migrate deploy
sudo docker compose up -d --force-recreate app
```

## Server emergency reset

Email recovery does not replace server-owner access. An OWNER with shell access can still reset the configured admin by changing `ADMIN_PASSWORD` and running a dedicated reset command or database-safe script.

## Emergency OWNER reset from the server

Set `ADMIN_EMAIL` and a new 12+ character `ADMIN_PASSWORD` in `.env`, then run:

```bash
sudo docker compose exec app npm run db:reset-admin
```

After it succeeds, remove or rotate the temporary password in `.env` and restart the app if needed.
