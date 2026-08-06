# Security Requirements

- Use Argon2id or bcrypt with an appropriate work factor for passwords.
- Store sessions in secure, HTTP-only, same-site cookies.
- Encrypt provider credentials at rest with a server-held master key.
- Apply CSRF protection to browser mutations.
- Rate-limit authentication, uploads, public links, and webhooks.
- Validate file type and size; scan uploads before processing.
- Verify webhook signatures and reject replayed events.
- Keep audit logs append-only.
- Never log passwords, access tokens, payment data, or complete API keys.
