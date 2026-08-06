# Project TITAN Bambu Integration

Open **Settings → Bambu Printer Settings**, paste your JSON, enable the integration, and save.

Secrets are encrypted in PostgreSQL using `CREDENTIAL_ENCRYPTION_KEY`. Never commit real access codes or bridge tokens to GitHub.

The built-in dashboard supports browser-viewable camera URLs. Direct Bambu camera streams may require a LAN camera proxy or bridge. Controls use an optional bridge with:

- `GET /api/printers/{id}/status`
- `POST /api/printers/{id}/commands` with `{ "command": "pause|resume|stop|light-on|light-off" }`
- Optional `Authorization: Bearer <bridgeToken>`

After installing the update:

```bash
sudo docker compose build --no-cache app
sudo docker compose up -d --force-recreate app
```
