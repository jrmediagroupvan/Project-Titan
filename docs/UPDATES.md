# Updating Project TITAN

Always back up first:

```bash
sudo ./scripts/titan backup
```

## Git Update

```bash
git fetch origin
git pull --ff-only
sudo docker compose build --no-cache app
sudo docker compose run --rm app npx prisma db push
sudo docker compose up -d --force-recreate app
sudo ./scripts/healthcheck.sh --wait
```

## Important

- Preserve `.env`.
- Preserve uploads and persistent volumes.
- Do not use `docker compose down -v`.
- Stop if Prisma reports destructive changes.
- Use a trusted Git origin.
- Review release notes before updating.
