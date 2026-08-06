import { EmailAccount } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { SignJWT, jwtVerify } from "jose";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function stateKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

export async function createGoogleState(userId: string) {
  return new SignJWT({ userId, purpose: "gmail-connect" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(stateKey());
}

export async function verifyGoogleState(state: string) {
  const { payload } = await jwtVerify(state, stateKey());
  if (payload.purpose !== "gmail-connect" || typeof payload.userId !== "string") throw new Error("Invalid OAuth state");
  return payload.userId;
}

export function googleOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${process.env.TITAN_BASE_URL}/api/gmail/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function refresh(account: EmailAccount) {
  if (!account.encryptedRefreshToken) throw new Error("Gmail refresh token is missing");
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: decryptSecret(account.encryptedRefreshToken),
    grant_type: "refresh_token",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", body, cache: "no-store" });
  if (!response.ok) throw new Error("Gmail authorization expired");
  const token = await response.json() as { access_token: string; expires_in: number };
  await db.emailAccount.update({
    where: { id: account.id },
    data: {
      encryptedAccessToken: encryptSecret(token.access_token),
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    },
  });
  return token.access_token;
}

export async function accessToken(account: EmailAccount) {
  if (account.encryptedAccessToken && account.tokenExpiresAt && account.tokenExpiresAt > new Date(Date.now() + 60_000)) {
    return decryptSecret(account.encryptedAccessToken);
  }
  return refresh(account);
}

export async function listInbox(account: EmailAccount) {
  const token = await accessToken(account);
  const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox", {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!list.ok) throw new Error("Unable to load Gmail inbox");
  const data = await list.json() as { messages?: { id: string }[] };
  return Promise.all((data.messages || []).map(async ({ id }) => {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    const message = await response.json() as { id: string; snippet?: string; payload?: { headers?: { name: string; value: string }[] } };
    const headers = new Map((message.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value]));
    return { id: message.id, from: headers.get("from") || "", subject: headers.get("subject") || "(no subject)", date: headers.get("date") || "", snippet: message.snippet || "" };
  }));
}
