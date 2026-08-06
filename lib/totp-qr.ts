import "server-only";

import { spawnSync } from "node:child_process";
import path from "node:path";

const MAX_URI_LENGTH = 2048;

export function generateTotpQrSvg(uri: string): string {
  if (
    !uri.startsWith("otpauth://totp/") ||
    uri.length > MAX_URI_LENGTH
  ) {
    throw new Error("Invalid authenticator URI.");
  }

  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "generate-totp-qr.py",
  );

  const result = spawnSync("python3", [scriptPath], {
    input: uri,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });

  if (result.status !== 0 || !result.stdout.includes("<svg")) {
    console.error("TOTP QR generation failed", result.stderr);
    throw new Error("Unable to generate the authenticator QR code.");
  }

  return result.stdout
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/g, "")
    .trim();
}
