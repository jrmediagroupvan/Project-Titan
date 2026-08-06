# Security

Never commit:

- `.env`
- API keys
- OAuth secrets and tokens
- mailbox passwords
- printer access codes
- database exports
- uploads
- backups
- private customer records
- `.next`
- `node_modules`

Use:

- HTTPS for outside access
- strong unique passwords
- independent encryption secrets
- restricted firewall rules
- role-based access
- audit logs
- tested backups
- updated Docker and operating system packages

Docker socket access grants extensive control and should be restricted to trusted updater containers.
