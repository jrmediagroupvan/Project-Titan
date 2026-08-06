import { readFile, rm } from "node:fs/promises";
import { PermissionKey } from "@prisma/client";
import { safeStlName } from "@/lib/ai-stl";
import { requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import { safeDownloadName, safeStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

async function accessibleDesign(id: string, actor: { id: string; role: string }) {
  return db.aiStlDesign.findFirst({
    where: actor.role === "OWNER" ? { id } : { id, userId: actor.id },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.AI_STL_VIEW))) {
    return new Response("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const design = await accessibleDesign(id, actor);
  if (!design) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(safeStoragePath(design.storageKey));
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(bytes, {
      headers: {
        "Content-Type": "model/stl",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeDownloadName(safeStlName(design.title))}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Stored STL not found", { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.AI_STL_DELETE))) {
    return Response.json({ error: "AI STL delete permission is required." }, { status: 403 });
  }
  const { id } = await params;
  const design = await accessibleDesign(id, actor);
  if (!design) return Response.json({ error: "Design not found." }, { status: 404 });
  await db.aiStlDesign.delete({ where: { id } });
  await rm(safeStoragePath(design.storageKey), { force: true }).catch(() => {});
  await db.auditEvent.create({
    data: { userId: actor.id, action: "AI_STL_DELETED", entityType: "AiStlDesign", entityId: id, summary: design.title },
  }).catch(() => {});
  return Response.json({ ok: true });
}
