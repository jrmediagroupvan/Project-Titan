import { PermissionKey } from "@prisma/client";
import { requireUser } from "@/lib/authorization";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import FigureForgeWorkspace from "@/components/FigureForgeWorkspace";

export default async function FigureForgePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.AI_STL_VIEW))) return <p className="alert">AI STL access is required.</p>;
  const [{ project }, projects, customers, canCreate, canDelete, canExport] = await Promise.all([
    searchParams,
    db.forgeProject.findMany({
      where: actor.role === "OWNER" ? {} : { userId: actor.id },
      orderBy: { updatedAt: "desc" },
      include: { customer: { select: { id: true, name: true } } },
    }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_CREATE),
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_DELETE),
    userAllows(actor.id, actor.role, PermissionKey.AI_STL_EXPORT),
  ]);
  return <FigureForgeWorkspace projects={projects.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} customers={customers} selectedId={project || null} permissions={{ canCreate, canDelete, canExport }} />;
}
