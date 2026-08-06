import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PermissionKey } from "@prisma/client";
import { requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import { safeDownloadName, safeStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

async function accessible(id: string, actor: { id: string; role: string }) {
  return db.forgeProject.findFirst({ where: actor.role === "OWNER" ? { id } : { id, userId: actor.id } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.AI_STL_VIEW))) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const project = await accessible(id, actor);
  if (!project?.stlStorageKey) return new Response("Generated STL not found", { status: 404 });
  try {
    const bytes = await readFile(safeStoragePath(project.stlStorageKey));
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(bytes, { headers: {
      "Content-Type": "model/stl", "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeDownloadName(`${project.title}.stl`)}"`,
      "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff",
    }});
  } catch { return new Response("Stored STL not found", { status: 404 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.AI_STL_DELETE))) return Response.json({ error: "AI STL Delete permission is required." }, { status: 403 });
  const { id } = await params;
  const project = await accessible(id, actor);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  await db.forgeProject.delete({ where: { id } });
  await rm(path.dirname(safeStoragePath(project.sourceImageKey)), { recursive: true, force: true }).catch(() => {});
  await db.auditEvent.create({ data: { userId: actor.id, action: "FIGURE_FORGE_DELETED", entityType: "ForgeProject", entityId: id, summary: project.title } }).catch(() => {});
  return Response.json({ ok: true });
}
