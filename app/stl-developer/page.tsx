import { PermissionKey } from "@prisma/client";
import AiStlWorkspace from "@/components/AiStlWorkspace";
import { customerWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { requirePermission, userAllows } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function StlDeveloperPage({ searchParams }: {
  searchParams: Promise<{ design?: string; new?: string }>;
}) {
  const actor = await requirePermission(PermissionKey.AI_STL_VIEW);
  const query = await searchParams;
  const where = actor.role === "OWNER" ? {} : { userId: actor.id };
  const [designs, customers, canCreate, canEdit, canDelete, canExport, canUpload] = await Promise.all([
    db.aiStlDesign.findMany({
      where,
      include: { user: { select: { name: true } }, customer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.customer.findMany({
      where: customerWhere(actor),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_CREATE),
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_EDIT),
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_DELETE),
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_EXPORT),
    userAllows(actor.id, actor.role, PermissionKey.UPLOADS_CREATE),
  ]);
  const selected = query.new === "1" ? null : designs.find((design) => design.id === query.design) || designs[0] || null;
  return (
    <AiStlWorkspace
      designs={designs.map((design) => ({
        id: design.id,
        title: design.title,
        summary: design.summary || "",
        prompt: design.prompt,
        revision: design.revision,
        bytes: design.bytes,
        dimensions: design.dimensions as { x: number; y: number; z: number; triangles: number },
        ownerName: design.user.name,
        customerName: design.customer?.name || null,
        customerId: design.customerId,
        updatedAt: design.updatedAt.toISOString(),
      }))}
      customers={customers}
      selectedId={selected?.id || null}
      permissions={{ canCreate, canEdit, canDelete, canExport: canExport && canUpload }}
    />
  );
}
