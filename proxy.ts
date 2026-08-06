import { NextRequest, NextResponse } from "next/server";
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/login") || path.startsWith("/two-factor") || path.startsWith("/forgot-password") || path.startsWith("/reset-password") || path.startsWith("/portal/") || path.startsWith("/api/health") || path.startsWith("/_next")) return NextResponse.next();
  if (!req.cookies.get("titan_session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!favicon.ico).*)"] };
