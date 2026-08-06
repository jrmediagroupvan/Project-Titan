# Project TITAN Commercial Architecture

Project TITAN is organized as a modular commercial application for 3D-printing businesses.

## Application surfaces

- `app/` — current working Next.js application retained for compatibility.
- `apps/admin/` — future administrator and staff application boundary.
- `apps/portal/` — future customer portal boundary.
- `packages/` — reusable business logic and shared libraries.
- `integrations/` — external service adapters.
- `services/` — asynchronous jobs, scheduled work, and webhook processing.
- `infra/` — production deployment and infrastructure configuration.
- `tests/` — unit, integration, and end-to-end tests.

## Core workflow

Customer → AI STL Design or Upload → Analysis → Bambu Slice → Quote → Approval → Payment → Order → Production → Inventory deduction → Shipping → Completion.

## Design principles

1. Business logic must live outside page components.
2. External providers must be accessed through adapters.
3. Secrets must never be committed to Git.
4. Every state-changing action must create an audit event.
5. Database changes must use committed migrations.
6. Payment and webhook operations must be idempotent.
7. Customer data must be isolated and access-controlled.
