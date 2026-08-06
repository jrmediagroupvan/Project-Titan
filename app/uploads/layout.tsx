import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermission(PermissionKey.UPLOADS_VIEW);
  return children;
}
