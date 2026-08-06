import { NextResponse } from "next/server";
import { createGoogleState, googleOAuthUrl } from "@/lib/gmail";
import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";

export async function GET() {
  const user = await requirePermission(PermissionKey.EMAIL_EDIT);
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/messages?error=google-config", process.env.TITAN_BASE_URL || "http://localhost:1200"));
  }
  return NextResponse.redirect(googleOAuthUrl(await createGoogleState(user.id)));
}
