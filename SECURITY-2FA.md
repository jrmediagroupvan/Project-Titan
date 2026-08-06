# Project TITAN v4.2 Security Update

## Included

- TOTP authenticator-app two-step verification
- Mandatory enrollment for OWNER and ADMIN roles
- Ten one-time hashed recovery codes
- Trusted-device tokens for 30 days, stored only as SHA-256 hashes
- Encrypted TOTP secrets using TITAN's credential-encryption key
- Recent successful and failed login history
- Trusted-device revocation
- Audit event when two-step verification is enabled
- Forced enrollment guard at the request-proxy layer

## Setup

After updating, apply the Prisma migration:

```bash
docker compose run --rm app npx prisma migrate deploy
```

Owners and administrators are redirected to:

```text
/settings/security
```

The setup page provides an authenticator secret and an `otpauth://` URI. Add it
using the "enter setup key" option in Microsoft Authenticator, Google
Authenticator, 1Password, Bitwarden, Authy, or another TOTP application.

## Environment requirements

`AUTH_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` must each be at least 32
characters. Use HTTPS and set `COOKIE_SECURE=true` before exposing TITAN outside
a trusted local network.
