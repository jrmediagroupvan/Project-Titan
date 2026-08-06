import { PermissionKey, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authorization";
import { PERMISSION_FEATURE, userHasFeature } from "@/lib/features";

const ALL = Object.values(PermissionKey);

const ROLE_DEFAULTS: Record<Role, PermissionKey[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((permission) => !permission.endsWith("_DELETE") && permission !== PermissionKey.AI_ACTIONS_APPROVE),
  MANAGER: [
    PermissionKey.AI_STL_VIEW, PermissionKey.AI_STL_CREATE, PermissionKey.AI_STL_EDIT, PermissionKey.AI_STL_EXPORT,
    PermissionKey.AI_CHAT_VIEW, PermissionKey.AI_CHAT_CREATE, PermissionKey.AI_CHAT_DELETE,
    PermissionKey.AI_CRM_SEARCH, PermissionKey.AI_WEB_SEARCH, PermissionKey.AI_PRICING_USE,
    PermissionKey.AI_FILES_ANALYZE, PermissionKey.AI_ACTIONS_PROPOSE,
    PermissionKey.CUSTOMERS_VIEW, PermissionKey.CUSTOMERS_CREATE, PermissionKey.CUSTOMERS_EDIT,
    PermissionKey.QUOTES_VIEW, PermissionKey.QUOTES_CREATE, PermissionKey.QUOTES_EDIT,
    PermissionKey.ORDERS_VIEW, PermissionKey.ORDERS_CREATE, PermissionKey.ORDERS_EDIT,
    PermissionKey.PRODUCTION_VIEW, PermissionKey.PRODUCTION_CREATE, PermissionKey.PRODUCTION_EDIT,
    PermissionKey.INVENTORY_VIEW, PermissionKey.INVENTORY_CREATE, PermissionKey.INVENTORY_EDIT,
    PermissionKey.TASKS_VIEW, PermissionKey.TASKS_CREATE, PermissionKey.TASKS_EDIT,
    PermissionKey.PORTAL_VIEW, PermissionKey.PORTAL_EDIT,
    PermissionKey.EMAIL_VIEW, PermissionKey.EMAIL_CREATE, PermissionKey.EMAIL_EDIT,
    PermissionKey.UPLOADS_VIEW, PermissionKey.UPLOADS_CREATE, PermissionKey.UPLOADS_EDIT,
    PermissionKey.PRICING_VIEW, PermissionKey.PRICING_CREATE, PermissionKey.PRICING_EDIT,
    PermissionKey.REPORTS_VIEW,
  ],
  STAFF: [
    PermissionKey.AI_STL_VIEW, PermissionKey.AI_STL_CREATE, PermissionKey.AI_STL_EDIT, PermissionKey.AI_STL_EXPORT,
    PermissionKey.AI_CHAT_VIEW, PermissionKey.AI_CHAT_CREATE, PermissionKey.AI_CHAT_DELETE,
    PermissionKey.AI_CRM_SEARCH, PermissionKey.AI_WEB_SEARCH, PermissionKey.AI_PRICING_USE,
    PermissionKey.AI_FILES_ANALYZE, PermissionKey.AI_ACTIONS_PROPOSE,
    PermissionKey.CUSTOMERS_VIEW, PermissionKey.CUSTOMERS_CREATE, PermissionKey.CUSTOMERS_EDIT,
    PermissionKey.QUOTES_VIEW, PermissionKey.QUOTES_CREATE, PermissionKey.QUOTES_EDIT,
    PermissionKey.ORDERS_VIEW, PermissionKey.TASKS_VIEW, PermissionKey.TASKS_CREATE, PermissionKey.TASKS_EDIT,
    PermissionKey.PORTAL_VIEW, PermissionKey.EMAIL_VIEW, PermissionKey.EMAIL_CREATE, PermissionKey.EMAIL_EDIT,
    PermissionKey.UPLOADS_VIEW, PermissionKey.UPLOADS_CREATE, PermissionKey.UPLOADS_EDIT,
  ],
  PRODUCTION: [
    PermissionKey.AI_STL_VIEW, PermissionKey.AI_STL_CREATE, PermissionKey.AI_STL_EDIT, PermissionKey.AI_STL_EXPORT,
    PermissionKey.ORDERS_VIEW, PermissionKey.PRODUCTION_VIEW,
    PermissionKey.PRODUCTION_EDIT, PermissionKey.INVENTORY_VIEW,
    PermissionKey.INVENTORY_CREATE, PermissionKey.INVENTORY_EDIT, PermissionKey.TASKS_VIEW,
    PermissionKey.UPLOADS_VIEW, PermissionKey.UPLOADS_CREATE, PermissionKey.UPLOADS_EDIT,
  ],
  ACCOUNTING: [
    PermissionKey.CUSTOMERS_VIEW, PermissionKey.QUOTES_VIEW,
    PermissionKey.ORDERS_VIEW, PermissionKey.ORDERS_EDIT,
    PermissionKey.EXPENSES_VIEW, PermissionKey.EXPENSES_CREATE, PermissionKey.EXPENSES_EDIT,
    PermissionKey.REPORTS_VIEW,
    PermissionKey.EMAIL_VIEW, PermissionKey.EMAIL_CREATE, PermissionKey.EMAIL_EDIT,
  ],
  VIEWER: [
    PermissionKey.CUSTOMERS_VIEW, PermissionKey.QUOTES_VIEW,
    PermissionKey.ORDERS_VIEW, PermissionKey.PRODUCTION_VIEW,
    PermissionKey.INVENTORY_VIEW, PermissionKey.TASKS_VIEW,
    PermissionKey.EMAIL_VIEW,
  ],
};

export function roleAllows(role: Role, permission: PermissionKey) {
  return ROLE_DEFAULTS[role].includes(permission);
}

export async function userAllows(userId: string, role: Role, permission: PermissionKey) {
  if (role === Role.OWNER) return true;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, featureAccessMode: true },
  });
  if (!user || !(await userHasFeature(user, PERMISSION_FEATURE[permission]))) return false;
  const override = await db.userPermission.findUnique({
    where: { userId_permission: { userId, permission } },
  });
  return override?.allowed ?? roleAllows(role, permission);
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireUser();
  if (!(await userAllows(user.id, user.role, permission))) redirect("/?error=forbidden");
  return user;
}

export { ALL as ALL_PERMISSIONS, ROLE_DEFAULTS };
