# Project TITAN 4.0 — QR Two-Step Verification

Two-step verification remains optional.

## QR setup

1. Open Settings → Security.
2. Select **Show setup QR code**.
3. Scan the QR code in an authenticator app.
4. Enter the displayed 6-digit code.
5. Save the generated recovery codes.

A manual setup key and authenticator URI are also provided.

## Privacy

The QR code is generated locally inside the Project TITAN container. The TOTP
secret is not sent to an external QR-code website or API.

## Runtime

The Docker runner includes Python 3 and a vendored copy of the MIT-licensed
`python-qrcode` SVG encoder.
