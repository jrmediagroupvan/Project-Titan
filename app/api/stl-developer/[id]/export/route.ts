import { randomBytes } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { PermissionKey } from "@prisma/client";
import { safeStlName } from "@/lib/ai-stl";
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
  if (!canExport || !canUpload) {
    return Response.json({ error: "AI STL export and Uploads Create permissions are required." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({})) as { customerId?: unknown };
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  if (!customerId) return Response.json({ error: "Choose a customer." }, { status: 400 });
  await requireCustomerAccess(customerId, actor);
  const { id } = await params;
  const design = await db.aiStlDesign.findFirst({
    where: actor.role === "OWNER" ? { id } : { id, userId: actor.id },
  });
  if (!design) return Response.json({ error: "Design not found." }, { status: 404 });
  const storageKey = path.posix.join(customerId, `${randomBytes(16).toString("hex")}.stl`);
  const target = safeStoragePath(storageKey);
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(safeStoragePath(design.storageKey), target);
    const file = await db.customerFile.create({
      data: {
        customerId,
        originalName: safeStlName(design.title),
        storageKey,
        mimeType: "model/stl",
        bytes: design.bytes,
        fileType: "STL",
        analysisJson: {
          source: "TITAN_AI_STL_DEVELOPER",
          sourceDesignId: design.id,
          revision: design.revision,
          dimensions: design.dimensions,
        },
      },
    });
    await db.aiStlDesign.update({ where: { id }, data: { customerId } });
    await db.auditEvent.create({
      data: {
        userId: actor.id,
        action: "AI_STL_EXPORTED",
        entityType: "CustomerFile",
        entityId: file.id,
        summary: `${design.title} saved to customer files`,
        metadata: { sourceDesignId: design.id, customerId },
      },
    }).catch(() => {});
    return Response.json({ fileId: file.id });
  } catch (error) {
    await rm(target, { force: true }).catch(() => {});
    console.error("AI STL export failed", error);
    return Response.json({ error: "TITAN could not save this STL to Customer Files." }, { status: 500 });
  }
}
