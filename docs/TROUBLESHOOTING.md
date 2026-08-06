# Troubleshooting

## Check Services

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 app
curl http://127.0.0.1:1200/api/health
```

## Changes Not Visible

```bash
sudo docker compose build --no-cache app
sudo docker compose up -d --force-recreate app
```

Then hard-refresh the browser.

## Prisma Error

Do not use `--accept-data-loss` without understanding the change. Back up first and inspect the schema difference.

## Email Problems

Test SMTP and IMAP separately. Confirm provider access, ports, TLS mode, app passwords, and permissions.

## Delete Errors

Check application logs for a Prisma constraint name. Linked records may need to be removed, detached, archived, or protected before the parent record can be deleted.

## Update Problems

Check:

```bash
git status
git remote -v
git branch -vv
```

Runtime files should be ignored by Git.
