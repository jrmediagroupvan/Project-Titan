import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";

export default async function Layout({children}:{children:React.ReactNode}){
  await requirePermission(PermissionKey.AI_CHAT_VIEW);
  return children;
}

