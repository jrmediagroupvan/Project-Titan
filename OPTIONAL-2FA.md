# Project TITAN Version 4 — Optional Two-Step Verification

Two-step verification is now optional for every role, including Owner and
Administrator accounts.

## Behavior

- Accounts without 2FA can sign in using email and password.
- The CRM menu and all permitted pages remain available.
- Accounts that enable 2FA must enter an authenticator or recovery code.
- Trusted devices remain supported for enabled accounts.
- Users can disable 2FA after confirming their current password.
- Disabling 2FA removes recovery codes and trusted-device records.
- Login history and Security Center reporting remain available.
- Legacy `titan_mfa_setup_required` cookies are cleared automatically.

No Prisma migration is required for this change.
