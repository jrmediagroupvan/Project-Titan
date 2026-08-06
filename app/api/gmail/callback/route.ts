import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { verifyGoogleState } from "@/lib/gmail";
import { PermissionKey } from "@prisma/client";
import { userAllows } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const base = process.env.TITAN_BASE_URL || url.origin;
  try {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new Error("Missing OAuth response");
    const ownerId = await verifyGoogleState(state);
    const owner = await db.user.findUnique({ where: { id: ownerId } });
    if (!owner || !(await userAllows(owner.id, owner.role, PermissionKey.EMAIL_EDIT))) {
      throw new Error("Email access is no longer assigned");
    }
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${base}/api/gmail/callback`,
      grant_type: "authorization_code",
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body, cache: "no-store" });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error("Google profile request failed");
    const profile = await profileResponse.json() as { email: string; name?: string };
    const existing = await db.emailAccount.findUnique({ where: { provider_emailAddress: { provider: "GOOGLE", emailAddress: profile.email.toLowerCase() } } });
    if (existing && existing.ownerId !== ownerId) throw new Error("That mailbox is already connected to another user");
    await db.emailAccount.upsert({
      where: { provider_emailAddress: { provider: "GOOGLE", emailAddress: profile.email.toLowerCase() } },
      create: {
        ownerId, provider: "GOOGLE", emailAddress: profile.email.toLowerCase(), displayName: profile.name,
        encryptedAccessToken: encryptSecret(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000), scopes: token.scope,
      },
      update: {
        encryptedAccessToken: encryptSecret(token.access_token),
        ...(token.refresh_token ? { encryptedRefreshToken: encryptSecret(token.refresh_token) } : {}),
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000), scopes: token.scope, active: true,
      },
    });
    return NextResponse.redirect(new URL("/messages?connected=1", base));
  } catch {
    return NextResponse.redirect(new URL("/messages?error=oauth", base));
  }
}
