# Integrations

Each integration follows the same contract:

- configuration schema
- encrypted credential storage
- connection test
- enable/disable state
- health status
- webhook verification where applicable
- retry and error logging

The folders in `integrations/` define the implementation boundaries for Square, Canada Post, email providers, OpenAI, Bambu, Klipper, and S3-compatible storage.
