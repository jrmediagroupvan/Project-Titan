import { readFile } from "node:fs/promises";
import { PermissionKey } from "@prisma/client";
import { requireUser } from "@/lib/authorization";
import { customerRelationWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import { safeDownloadName, safeStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.UPLOADS_VIEW))) {
    return new Response("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const file = await db.customerFile.findFirst({ where: { id, ...customerRelationWhere(actor) } });
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(/*turbopackIgnore: true*/ safeStoragePath(file.storageKey));
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(bytes, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeDownloadName(file.originalName)}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Stored file not found", { status: 404 });
  }
}
