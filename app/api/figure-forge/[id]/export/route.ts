import { randomBytes } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { PermissionKey } from "@prisma/client";
import { requireUser } from "@/lib/authorization";
import { requireCustomerAccess } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import { safeStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  const [canExport, canUpload] = await Promise.all([
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_EXPORT),
    userAllows(actor.id, actor.role, PermissionKey.UPLOADS_CREATE),
  ]);
  if (!canExport || !canUpload) return Response.json({ error: "AI STL Export and Uploads Create permissions are required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { customerId?: unknown };
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  if (!customerId) return Response.json({ error: "Choose a customer." }, { status: 400 });
  await requireCustomerAccess(customerId, actor);
  const { id } = await params;
  const project = await db.forgeProject.findFirst({ where: actor.role === "OWNER" ? { id } : { id, userId: actor.id } });
  if (!project?.stlStorageKey || project.status !== "READY") return Response.json({ error: "A completed STL is required." }, { status: 400 });
  const storageKey = path.posix.join(customerId, `${randomBytes(16).toString("hex")}.stl`);
  const target = safeStoragePath(storageKey);
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(safeStoragePath(project.stlStorageKey), target);
    const stats = await import("node:fs/promises").then(({ stat }) => stat(target));
    const file = await db.customerFile.create({ data: {
      customerId, originalName: `${project.title}.stl`, storageKey, mimeType: "model/stl", bytes: stats.size, fileType: "STL",
      analysisJson: { source: "TITAN_FIGURE_FORGE", forgeProjectId: project.id, style: project.style, baseStyle: project.baseStyle, nameplateText: project.nameplateText },
    }});
    await db.forgeProject.update({ where: { id }, data: { customerId } });
    await db.auditEvent.create({ data: { userId: actor.id, action: "FIGURE_FORGE_EXPORTED", entityType: "CustomerFile", entityId: file.id, summary: `${project.title} saved to customer files` } }).catch(() => {});
    return Response.json({ fileId: file.id });
  } catch (error) {
    await rm(target, { force: true }).catch(() => {});
    console.error("Figure Forge export failed", error);
    return Response.json({ error: "TITAN could not save this STL to Customer Files." }, { status: 500 });
  }
}
