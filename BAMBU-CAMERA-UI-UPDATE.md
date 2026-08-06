# Bambu Camera UI Update

This update changes only the Project TITAN Bambu dashboard interface.

## Included

- Compact printer cards arranged in a responsive grid.
- Smaller 16:9 live-camera previews.
- Click any camera to open a large modal viewer.
- Escape key, outside click, or Close button exits the modal.
- Refresh button reloads the Bambu Buddy stream.
- Camera error message and retry control.
- Existing printer settings, camera URLs, tokens, bridge configuration, database records, and permissions remain unchanged.

## Deploy

```bash
cd ~/Project-Titan
sudo docker compose build --no-cache app
sudo docker compose up -d --force-recreate app
sudo docker compose logs --tail=120 app
```

This UI update does not require a Prisma database migration.
