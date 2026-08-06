# Configuration Guide

Create the private environment file:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Recommended core values:

```env
TITAN_BIND_ADDRESS=0.0.0.0
TITAN_PORT=1200
TITAN_BASE_URL=http://SERVER-IP:1200
COOKIE_SECURE=false
AUTH_SECRET=REPLACE_WITH_UNIQUE_RANDOM_SECRET
CREDENTIAL_ENCRYPTION_KEY=REPLACE_WITH_DIFFERENT_RANDOM_SECRET
POSTGRES_USER=titan
POSTGRES_PASSWORD=REPLACE_WITH_DATABASE_PASSWORD
POSTGRES_DB=titan
DATABASE_URL=postgresql://titan:REPLACE_WITH_DATABASE_PASSWORD@postgres:5432/titan?schema=public
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=REPLACE_WITH_TEMPORARY_PASSWORD
```

Generate secrets:

```bash
openssl rand -hex 32
```

Do not reuse the same value for every secret.

For HTTPS:

```env
TITAN_BASE_URL=https://titan.example.com
COOKIE_SECURE=true
```

Restart after editing:

```bash
sudo docker compose up -d --force-recreate app
```

Never commit `.env`.
