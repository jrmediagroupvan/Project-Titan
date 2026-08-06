import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function requireUpdateOwner() {
  const session = await getSession();

  if (!session) {
    return {
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, active: true },
  });

  if (!user?.active || user.role !== "OWNER") {
    return {
      response: NextResponse.json(
        { error: "Only the Project TITAN owner can run updates." },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export function updaterHeaders() {
  const token = process.env.TITAN_UPDATE_TOKEN;

  if (!token || token.length < 32) {
    throw new Error(
      "TITAN_UPDATE_TOKEN must contain at least 32 characters.",
    );
  }

  return {
    authorization: `Bearer ${token}`,
  };
}

export function updaterUrl(path: string) {
  const base =
    process.env.TITAN_UPDATER_URL ?? "http://updater:8787";

  return `${base.replace(/\/$/, "")}${path}`;
}
