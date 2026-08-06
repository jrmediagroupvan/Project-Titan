# Production Deployment

1. Provision an Ubuntu server or supported NAS with Docker.
2. Create a DNS record for TITAN.
3. Copy `.env.example` to `.env` and supply secrets.
4. Run `./install.sh`.
5. Put TITAN behind HTTPS using Nginx or another reverse proxy.
6. Run migrations and seed only the initial administrator.
7. Configure off-device encrypted backups.
8. Connect integrations in sandbox mode first.
9. Run smoke tests before enabling public access.
