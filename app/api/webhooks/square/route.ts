import { db } from "@/lib/db";
import { WebhooksHelper } from "square";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";
  const url = process.env.SQUARE_WEBHOOK_URL || "";

  if (!key || !url) return Response.json({ error: "Square webhook is not configured." }, { status: 503 });

  const valid = await WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader: signature,
    signatureKey: key,
    notificationUrl: url
  });

  if (!valid) return Response.json({ error: "Invalid signature." }, { status: 401 });

  const event = JSON.parse(rawBody);
  await db.webhookEvent.upsert({
    where: { id: event.event_id },
    update: {},
    create: {
      id: event.event_id,
      provider: "square",
      eventType: event.type,
      payload: event
    }
  });

  // Event-specific invoice/payment synchronisation is intentionally queued
  // for the next implementation milestone.
  return Response.json({ received: true });
}
