import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export type TitanSession = { id: string; email: string; role: string };

export async function createSession(user: TitanSession) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(authSecret());

  const secure = process.env.COOKIE_SECURE === "true";
  (await cookies()).set("titan_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 604800,
  });
  const jar = await cookies();
  jar.delete("titan_2fa_pending");
  // Remove the legacy mandatory-enrollment cookie from older Version 4 builds.
  jar.delete("titan_mfa_setup_required");
}

export async function createPendingTwoFactor(user: TitanSession) {
  const token = await new SignJWT({ ...user, purpose: "two-factor" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(authSecret());
  (await cookies()).set("titan_2fa_pending", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 600,
  });
}

export async function getPendingTwoFactor() {
  const token = (await cookies()).get("titan_2fa_pending")?.value;
  if (!token) return null;
  try {
    const payload = (await jwtVerify(token, authSecret())).payload as TitanSession & { purpose?: string };
    return payload.purpose === "two-factor" ? payload : null;
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = (await cookies()).get("titan_session")?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, authSecret())).payload as TitanSession;
  } catch {
    return null;
  }
}

export async function setMfaSetupRequired(required: boolean) {
  const jar = await cookies();
  if (!required) { jar.delete("titan_mfa_setup_required"); return; }
  jar.set("titan_mfa_setup_required", "1", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function setTrustedDeviceCookie(token: string) {
  (await cookies()).set("titan_trusted_device", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getTrustedDeviceCookie() {
  return (await cookies()).get("titan_trusted_device")?.value ?? null;
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete("titan_session");
  jar.delete("titan_2fa_pending");
  jar.delete("titan_mfa_setup_required");
  jar.delete("titan_trusted_device");
}
