# CRM and Customer Management

Project TITAN stores customer identity, contact information, notes, assignments, quotes, orders, files, tasks, payments, shipments, portal access, and activity history.

## Access Models

- All customers
- Assigned customers only
- Feature-level access
- Action-level View, Create, Edit, and Delete permissions

## Customer Deletion

Permanent deletion is restricted and should:

1. Require an authorized user.
2. Check linked financial and fulfilment records.
3. Remove dependent CRM records in the correct order.
4. Preserve required accounting history.
5. Record the action in the audit log.

Use archive or anonymization when financial history must remain.

## Customer Portal

Portal links may expire or be revoked. Customers should see only their own authorized quotes, orders, payments, shipments, and files.
