# Commercial Readiness Checklist

This repository provides the complete project structure and an installable application foundation. It is not considered production-ready until all items below are verified against real services.

## Required before public launch

- [ ] Replace prototype authentication with production session management and password reset.
- [ ] Add MFA for administrators.
- [ ] Complete role and permission enforcement on every route and action.
- [ ] Run database migrations in staging and production.
- [ ] Connect and test Square sandbox, then production.
- [ ] Verify Square webhook signatures and idempotency.
- [ ] Configure a real email provider and domain authentication.
- [ ] Connect Canada Post and test rates, labels, and tracking.
- [ ] Test Bambu and Klipper integrations on actual printers.
- [ ] Configure HTTPS, reverse proxy, firewall, and rate limiting.
- [ ] Add error monitoring, uptime monitoring, and alerting.
- [ ] Verify encrypted backups and a full restore drill.
- [ ] Complete privacy policy, terms, refund policy, and data-retention policy.
- [ ] Complete unit, integration, and end-to-end tests.
- [ ] Complete security review and dependency audit.
