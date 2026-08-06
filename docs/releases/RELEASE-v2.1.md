# Project TITAN v2.1 — Editable Commercial Update

This release adds working edit and delete controls to the existing Project TITAN commercial beta.

## Added

- Edit and protected delete for customers
- Edit and delete for materials
- Edit and delete for tasks
- Edit and owner-only delete for expenses
- Edit, disable, and protected delete for printers
- Delete queued or cancelled production jobs
- Edit and protected delete for quotes
- Edit and protected delete for orders
- Owner-only payment deletion with paid-total correction
- Shipment deletion
- Uploaded-file record deletion
- Confirmation prompts before destructive actions
- Audit events for edits and deletions
- Correct multiline Prisma enum syntax

## Safety rules

- Customers with linked financial or fulfilment records cannot be deleted.
- Quotes converted to orders cannot be edited or deleted.
- Orders with payments or shipments cannot be deleted.
- Printers linked to production jobs cannot be deleted.
- Active production jobs cannot be deleted.
- Expense and payment deletion requires owner access.

## Upgrade

Use the included Git updater or follow `GITHUB-UPDATES.md`. Always back up before applying a release.
