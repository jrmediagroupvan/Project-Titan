# Backup and Restore

Create a backup:

```bash
sudo ./scripts/titan backup
```

Check health:

```bash
sudo ./scripts/healthcheck.sh --wait
```

Back up:

- PostgreSQL
- `.env`
- uploads
- storage
- MinIO data
- configuration
- optional generated assets

Do not restore over a live production database without reviewing the procedure and version compatibility.
