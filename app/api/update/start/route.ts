import { NextResponse } from "next/server";
import {
  requireUpdateOwner,
  updaterHeaders,
  updaterUrl,
} from "../_shared";

export async function POST() {
  const authorization = await requireUpdateOwner();

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const response = await fetch(updaterUrl("/update"), {
      method: "POST",
      headers: updaterHeaders(),
      cache: "no-store",
    });

    const payload = await response.json();

    return NextResponse.json(payload, {
      status: response.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The TITAN updater service is unavailable.",
      },
      { status: 503 },
    );
  }
}
