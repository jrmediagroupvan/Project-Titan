# Project TITAN v4 Release Checklist

- [ ] `npm ci` succeeds on a clean clone
- [ ] `npm run validate` succeeds
- [ ] `npm test` succeeds
- [ ] `docker build --target builder .` succeeds
- [ ] `docker compose config` succeeds with a test `.env`
- [ ] Fresh Ubuntu install passes health check
- [ ] Fresh Windows install passes health check
- [ ] Existing database, uploads, storage, and `.env` survive update
- [ ] Failed staged update rolls back automatically
- [ ] Dark, light, and system themes work
- [ ] Animated logo works and respects reduced-motion
- [ ] GitHub Actions is green before release tagging
