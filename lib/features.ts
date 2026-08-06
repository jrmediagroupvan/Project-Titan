import { FeatureCategory, PermissionKey, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authorization";

export const FEATURE_LABELS: Record<FeatureCategory, string> = {
  DASHBOARD: "Dashboard",
  AI_STL_DEVELOPER: "AI STL Developer",
  AI_ASSISTANT: "AI Assistant",
  CUSTOMERS: "Customers",
  CUSTOMER_PORTAL: "Customer Portal",
  EMAIL: "My Email",
  QUOTES: "Quotes",
  ORDERS: "Orders",
  UPLOADS: "Uploads",
  PRODUCTION: "Production",
  INVENTORY: "Inventory",
  MARKET_PRICING: "Market Pricing",
  TASKS: "Tasks",
  EXPENSES: "Expenses",
  REPORTS: "Reports",
  INTEGRATIONS: "Integrations",
  ACTIVITY: "Activity Log",
  SETTINGS: "Settings",
  USER_MANAGEMENT: "User Management",
};

export const PERMISSION_FEATURE: Record<PermissionKey, FeatureCategory> = {
  AI_STL_VIEW: FeatureCategory.AI_STL_DEVELOPER,
  AI_STL_CREATE: FeatureCategory.AI_STL_DEVELOPER,
  AI_STL_EDIT: FeatureCategory.AI_STL_DEVELOPER,
  AI_STL_DELETE: FeatureCategory.AI_STL_DEVELOPER,
  AI_STL_EXPORT: FeatureCategory.AI_STL_DEVELOPER,
  AI_CHAT_VIEW: FeatureCategory.AI_ASSISTANT,
  AI_CHAT_CREATE: FeatureCategory.AI_ASSISTANT,
  AI_CHAT_DELETE: FeatureCategory.AI_ASSISTANT,
  AI_IMAGES_CREATE: FeatureCategory.AI_ASSISTANT,
  AI_CRM_SEARCH: FeatureCategory.AI_ASSISTANT,
  AI_WEB_SEARCH: FeatureCategory.AI_ASSISTANT,
  AI_PRICING_USE: FeatureCategory.AI_ASSISTANT,
  AI_FILES_ANALYZE: FeatureCategory.AI_ASSISTANT,
  AI_ACTIONS_PROPOSE: FeatureCategory.AI_ASSISTANT,
  AI_ACTIONS_APPROVE: FeatureCategory.AI_ASSISTANT,
  CUSTOMERS_VIEW: FeatureCategory.CUSTOMERS,
  CUSTOMERS_CREATE: FeatureCategory.CUSTOMERS,
  CUSTOMERS_EDIT: FeatureCategory.CUSTOMERS,
  CUSTOMERS_DELETE: FeatureCategory.CUSTOMERS,
  QUOTES_VIEW: FeatureCategory.QUOTES,
  QUOTES_CREATE: FeatureCategory.QUOTES,
  QUOTES_EDIT: FeatureCategory.QUOTES,
  QUOTES_DELETE: FeatureCategory.QUOTES,
  ORDERS_VIEW: FeatureCategory.ORDERS,
  ORDERS_CREATE: FeatureCategory.ORDERS,
  ORDERS_EDIT: FeatureCategory.ORDERS,
  ORDERS_DELETE: FeatureCategory.ORDERS,
  PRODUCTION_VIEW: FeatureCategory.PRODUCTION,
  PRODUCTION_CREATE: FeatureCategory.PRODUCTION,
  PRODUCTION_EDIT: FeatureCategory.PRODUCTION,
  PRODUCTION_DELETE: FeatureCategory.PRODUCTION,
  INVENTORY_VIEW: FeatureCategory.INVENTORY,
  INVENTORY_CREATE: FeatureCategory.INVENTORY,
  INVENTORY_EDIT: FeatureCategory.INVENTORY,
  INVENTORY_DELETE: FeatureCategory.INVENTORY,
  TASKS_VIEW: FeatureCategory.TASKS,
  TASKS_CREATE: FeatureCategory.TASKS,
  TASKS_EDIT: FeatureCategory.TASKS,
  TASKS_DELETE: FeatureCategory.TASKS,
  EXPENSES_VIEW: FeatureCategory.EXPENSES,
  EXPENSES_CREATE: FeatureCategory.EXPENSES,
  EXPENSES_EDIT: FeatureCategory.EXPENSES,
  EXPENSES_DELETE: FeatureCategory.EXPENSES,
  REPORTS_VIEW: FeatureCategory.REPORTS,
  PORTAL_VIEW: FeatureCategory.CUSTOMER_PORTAL,
  PORTAL_CREATE: FeatureCategory.CUSTOMER_PORTAL,
  PORTAL_EDIT: FeatureCategory.CUSTOMER_PORTAL,
  PORTAL_DELETE: FeatureCategory.CUSTOMER_PORTAL,
  EMAIL_VIEW: FeatureCategory.EMAIL,
  EMAIL_CREATE: FeatureCategory.EMAIL,
  EMAIL_EDIT: FeatureCategory.EMAIL,
  EMAIL_DELETE: FeatureCategory.EMAIL,
  UPLOADS_VIEW: FeatureCategory.UPLOADS,
  UPLOADS_CREATE: FeatureCategory.UPLOADS,
  UPLOADS_EDIT: FeatureCategory.UPLOADS,
  UPLOADS_DELETE: FeatureCategory.UPLOADS,
  PRICING_VIEW: FeatureCategory.MARKET_PRICING,
  PRICING_CREATE: FeatureCategory.MARKET_PRICING,
  PRICING_EDIT: FeatureCategory.MARKET_PRICING,
  PRICING_DELETE: FeatureCategory.MARKET_PRICING,
  USERS_VIEW: FeatureCategory.USER_MANAGEMENT,
  USERS_CREATE: FeatureCategory.USER_MANAGEMENT,
  USERS_EDIT: FeatureCategory.USER_MANAGEMENT,
  USERS_DELETE: FeatureCategory.USER_MANAGEMENT,
  USERS_MANAGE: FeatureCategory.USER_MANAGEMENT,
  INTEGRATIONS_VIEW: FeatureCategory.INTEGRATIONS,
  INTEGRATIONS_MANAGE: FeatureCategory.INTEGRATIONS,
  AUDIT_VIEW: FeatureCategory.ACTIVITY,
};

export type FeatureActor = {
  id: string;
  role: Role;
  featureAccessMode: "ALL" | "ASSIGNED";
};

export async function userHasFeature(user: FeatureActor, category: FeatureCategory) {
  if (user.role === Role.OWNER || user.featureAccessMode === "ALL") return true;
  return Boolean(await db.userFeatureCategory.findUnique({
    where: { userId_category: { userId: user.id, category } },
    select: { id: true },
  }));
}

export async function requireFeature(category: FeatureCategory) {
  const user = await requireUser();
  if (!(await userHasFeature(user, category))) redirect("/settings/profile?error=feature");
  return user;
}

export async function featureSetForUser(user: FeatureActor) {
  if (user.role === Role.OWNER || user.featureAccessMode === "ALL") {
    return Object.values(FeatureCategory);
  }
  const rows = await db.userFeatureCategory.findMany({
    where: { userId: user.id },
    select: { category: true },
  });
  return rows.map((row) => row.category);
}
