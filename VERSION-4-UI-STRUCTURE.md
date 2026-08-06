# Project TITAN — Version 4 UI Structure

Visible product branding is fixed as:

```text
Project TITAN
Version 4
```

Patch and build identifiers remain internal for safe updates.

## Foundation added

```text
components/
└── ui/
    ├── index.ts
    ├── TitanUI.tsx
    └── TitanUI.module.css
```

Reusable components:

- `TitanPage`
- `TitanPageHeader`
- `TitanGrid`
- `TitanCard`
- `TitanMetric`
- `TitanBadge`
- `TitanButton`
- `TitanTableFrame`
- `TitanEmptyState`
- `TitanList`
- `TitanListItem`

## Migration approach

The backend, Prisma schema, APIs, permissions, Docker services, authentication,
2FA, updater, and existing business logic remain intact.

Frontend modules can now migrate one at a time:

1. Dashboard
2. Customers
3. Quotes
4. Orders
5. Production
6. Inventory
7. Calendar and Tasks
8. Email
9. TITAN AI
10. Reports
11. Settings and Security
12. Customer Portal

The Dashboard has already been migrated as the visual reference implementation.

## Responsive rules

- Full navigation sidebar on desktop
- Hamburger drawer on tablets and phones
- Four-column metrics on wide displays
- Two-column metrics on tablets
- Single-column metrics on phones
- Scrollable data tables
- iPhone safe-area support
- Touch targets at least 44 pixels
