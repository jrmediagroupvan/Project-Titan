#!/usr/bin/env python3
"""Generate a local SVG QR code without sending the TOTP secret externally."""

from __future__ import annotations

import io
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR_ROOT = os.path.join(PROJECT_ROOT, "vendor", "python")
sys.path.insert(0, VENDOR_ROOT)

import qrcode
from qrcode.constants import ERROR_CORRECT_M
from qrcode.image.svg import SvgPathImage


def main() -> int:
    uri = sys.stdin.read().strip()

    if not uri.startswith("otpauth://totp/"):
        print("Invalid authenticator URI.", file=sys.stderr)
        return 2

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)

    image = qr.make_image(
        image_factory=SvgPathImage,
        fill_color="#07111f",
        back_color="#ffffff",
    )

    output = io.BytesIO()
    image.save(output)
    sys.stdout.buffer.write(output.getvalue())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
