import { PermissionKey, Role, User } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { customerRelationWhere, customerWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { calculateQuotePricing, currentMaterialCostPerKg, materialRateCatalog, materialWasteMultiplier } from "@/lib/pricing";
import { userAllows } from "@/lib/permissions";
import { safeStoragePath } from "@/lib/storage";
import { analyseStl } from "@/lib/stl";
import { isThreeDPrintingRequest } from "@/lib/ai-scope";

export type AiActor = Pick<User, "id" | "role" | "customerAccessMode">;
export type AiToolMode = "AUTO" | "CRM" | "WEB" | "PRICING";

export type AiToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const text = (value: unknown, max = 160) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function allowed(actor: AiActor, permission: PermissionKey) {
  return actor.role === Role.OWNER || userAllows(actor.id, actor.role, permission);
}

export async function buildAiTools(actor: AiActor, mode: AiToolMode) {
  const tools: AiToolDefinition[] = [];
  const wants = (target: AiToolMode) => mode === "AUTO" || mode === target;

  if (wants("CRM") && await allowed(actor, PermissionKey.AI_CRM_SEARCH)) {
    tools.push(
      {
        type: "function",
        name: "search_customers",
        description: "Search customers the current user is authorized to view.",
        parameters: objectSchema({ query: { type: "string", description: "Name, company, email, or phone." } }, ["query"]),
      },
      {
        type: "function",
        name: "search_quotes",
        description: "Search accessible quotes by quote number, customer, status, material, or description.",
        parameters: objectSchema({ query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } }, ["query"]),
      },
      {
        type: "function",
        name: "search_orders",
        description: "Search accessible orders and include production, payment, and shipping status.",
        parameters: objectSchema({ query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } }, ["query"]),
      },
      {
        type: "function",
        name: "business_snapshot",
        description: "Get a permission-filtered business snapshot of active production, overdue work, inventory alerts, and open tasks.",
        parameters: objectSchema({}),
      },
    );
  }

  if (wants("PRICING") && await allowed(actor, PermissionKey.AI_PRICING_USE)) {
    tools.push({
      type: "function",
      name: "calculate_print_quote",
      description: "Calculate a CAD 3D-print quote using TITAN's live material costs and configured pricing rules. Estimates are drafts until a person approves them.",
      parameters: objectSchema({
        material: { type: "string" },
        grams_per_item: { type: "number", minimum: 0 },
        minutes_per_item: { type: "number", minimum: 0 },
        quantity: { type: "integer", minimum: 1 },
        colour: { type: "string" },
      }, ["material", "grams_per_item", "minutes_per_item", "quantity"]),
    });
  }

  if (wants("CRM") && await allowed(actor, PermissionKey.AI_FILES_ANALYZE)) {
    tools.push({
      type: "function",
      name: "inspect_customer_file",
      description: "Inspect an accessible uploaded file. STL files return dimensions and triangle count.",
      parameters: objectSchema({
        file_name_or_id: { type: "string", description: "Full or partial filename, or exact file ID." },
      }, ["file_name_or_id"]),
    });
  }

  if (await allowed(actor, PermissionKey.AI_ACTIONS_PROPOSE)) {
    tools.push({
      type: "function",
      name: "propose_crm_action",
      description: "Stage a CRM change for human approval. This never performs the change immediately.",
      parameters: objectSchema({
        action_type: { type: "string", enum: ["CREATE_TASK", "UPDATE_ORDER_STATUS"] },
        title: { type: "string" },
        description: { type: "string" },
        payload: {
          type: "object",
          description: "CREATE_TASK: title, description?, priority?, customerId?. UPDATE_ORDER_STATUS: orderId, status.",
          additionalProperties: true,
        },
      }, ["action_type", "title", "description", "payload"]),
    });
  }

  if (wants("WEB") && await allowed(actor, PermissionKey.AI_WEB_SEARCH) && process.env.SEARXNG_URL) {
    tools.push({
      type: "function",
      name: "search_web",
      description: "Search the live web through the server's private SearXNG service and return titles, URLs, and snippets.",
      parameters: objectSchema({ query: { type: "string" } }, ["query"]),
    });
  }

  return tools;
}

async function searchCustomers(actor: AiActor, args: Record<string, unknown>) {
  const query = text(args.query);
  return db.customer.findMany({
    where: {
      ...customerWhere(actor),
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { company: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 15,
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, company: true, email: true, phone: true, notes: true, updatedAt: true },
  });
}

async function searchQuotes(actor: AiActor, args: Record<string, unknown>) {
  const query = text(args.query);
  const status = ["DRAFT","SENT","VIEWED","APPROVED","DECLINED","EXPIRED","INVOICED"].includes(query.toUpperCase())
    ? query.toUpperCase() as any
    : null;
  const limit = Math.min(20, Math.max(1, Math.round(number(args.limit, 10))));
  return db.quote.findMany({
    where: {
      ...customerRelationWhere(actor),
      OR: [
        { number: { contains: query, mode: "insensitive" } },
        ...(status?[{ status: { equals: status } }]:[]),
        { customer: { name: { contains: query, mode: "insensitive" } } },
        { items: { some: { OR: [
          { description: { contains: query, mode: "insensitive" } },
          { material: { contains: query, mode: "insensitive" } },
        ] } } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: { customer: { select: { name: true } }, items: true },
  });
}

async function searchOrders(actor: AiActor, args: Record<string, unknown>) {
  const query = text(args.query);
  const status = ["AWAITING_PAYMENT","PAID","QUEUED","PRINTING","QUALITY_CHECK","READY","SHIPPED","COMPLETED","CANCELLED"].includes(query.toUpperCase())
    ? query.toUpperCase() as any
    : null;
  const limit = Math.min(20, Math.max(1, Math.round(number(args.limit, 10))));
  return db.order.findMany({
    where: {
      ...customerRelationWhere(actor),
      OR: [
        { number: { contains: query, mode: "insensitive" } },
        ...(status?[{ status: { equals: status } }]:[]),
        { customer: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { name: true } },
      jobs: { select: { id: true, status: true, material: true, colour: true, estimatedMinutes: true, printer: { select: { name: true } } } },
      payments: { select: { status: true, amountCents: true, paidAt: true } },
      shipments: { select: { status: true, carrier: true, trackingNumber: true } },
    },
  });
}

async function businessSnapshot(actor: AiActor) {
  const orderScope = customerRelationWhere(actor);
  const taskScope = actor.role === Role.OWNER || actor.customerAccessMode === "ALL"
    ? {}
    : { OR: [{ customer: { assignedToId: actor.id } }, { customerId: null, assignedToId: actor.id }] };
  const [jobs, tasks, lowMaterials, quotes] = await Promise.all([
    db.productionJob.findMany({
      where: { order: orderScope, status: { in: ["QUEUED", "PRINTING", "QUALITY_CHECK"] } },
      take: 30,
      orderBy: { updatedAt: "asc" },
      include: { order: { select: { number: true, dueDate: true, customer: { select: { name: true } } } }, printer: { select: { name: true } } },
    }),
    db.task.findMany({ where: { ...taskScope, status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } }, take: 30, orderBy: [{ priority: "desc" }, { dueAt: "asc" }] }),
    db.material.findMany({ where: { gramsOnHand: { lte: db.material.fields.reorderAtGrams } }, take: 30, orderBy: { gramsOnHand: "asc" } }),
    db.quote.findMany({ where: { ...orderScope, status: { in: ["DRAFT", "SENT", "VIEWED"] } }, take: 20, orderBy: { updatedAt: "asc" }, include: { customer: { select: { name: true } } } }),
  ]);
  return { activeJobs: jobs, openTasks: tasks, lowInventory: lowMaterials, openQuotes: quotes };
}

async function calculatePricing(args: Record<string, unknown>) {
  const material = text(args.material, 40);
  const quantity = Math.max(1, Math.round(number(args.quantity, 1)));
  const grams = Math.max(0, number(args.grams_per_item));
  const minutes = Math.max(0, number(args.minutes_per_item));
  const [costPerKgCents, business] = await Promise.all([
    currentMaterialCostPerKg(material),
    db.businessSetting.findUnique({ where: { id: "primary" } }),
  ]);
  const catalog = materialRateCatalog();
  const result = calculateQuotePricing({
    costPerKgCents,
    gramsPerItem: grams,
    minutesPerItem: minutes,
    quantity,
    wasteMultiplier: materialWasteMultiplier(material),
    hourlyRateCents: Math.round(catalog.defaultMachineHourlyRateCad * 100),
    setupFeeCents: Math.round(catalog.defaultSetupFeeCad * 100),
    markupPercent: business?.quoteMarkupPercent ?? catalog.defaultMarkupPercent,
    minimumQuoteCents: Math.round(catalog.minimumQuoteCad * 100),
  });
  return {
    currency: business?.currency || "CAD",
    material,
    colour: text(args.colour, 60) || null,
    quantity,
    gramsPerItem: grams,
    minutesPerItem: minutes,
    materialCostPerKgCents: costPerKgCents,
    markupPercent: business?.quoteMarkupPercent ?? catalog.defaultMarkupPercent,
    ...result,
    warning: "Draft estimate only. Confirm geometry, supports, failure allowance, taxes, shipping, and customer requirements before sending.",
  };
}

async function inspectFile(actor: AiActor, args: Record<string, unknown>) {
  const query = text(args.file_name_or_id, 240);
  const file = await db.customerFile.findFirst({
    where: {
      ...customerRelationWhere(actor),
      OR: [{ id: query }, { originalName: { contains: query, mode: "insensitive" } }],
    },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!file) return { error: "No accessible matching file was found." };
  let analysis = file.analysisJson;
  if (file.fileType === "STL" && !analysis) {
    const buffer = await readFile(safeStoragePath(file.storageKey));
    analysis = analyseStl(buffer) as never;
    await db.customerFile.update({ where: { id: file.id }, data: { analysisJson: analysis } });
  }
  return {
    id: file.id,
    name: file.originalName,
    customer: file.customer.name,
    type: file.fileType,
    bytes: file.bytes,
    analysis,
  };
}

async function proposeAction(actor: AiActor, conversationId: string | null, args: Record<string, unknown>) {
  const actionType = text(args.action_type, 40);
  if (!["CREATE_TASK", "UPDATE_ORDER_STATUS"].includes(actionType)) throw new Error("Unsupported proposed action");
  const payload = args.payload && typeof args.payload === "object" && !Array.isArray(args.payload)
    ? args.payload as Record<string, unknown>
    : {};
  if (actionType === "CREATE_TASK" && !(await allowed(actor, PermissionKey.TASKS_CREATE))) throw new Error("Task create permission is required");
  if (actionType === "UPDATE_ORDER_STATUS" && !(await allowed(actor, PermissionKey.ORDERS_EDIT))) throw new Error("Order edit permission is required");
  const proposal = await db.aiActionProposal.create({
    data: {
      conversationId,
      proposedById: actor.id,
      actionType,
      title: text(args.title, 120) || actionType,
      description: text(args.description, 1000) || "AI-proposed CRM action",
      payload: payload as never,
    },
  });
  return { proposalId: proposal.id, status: proposal.status, message: "Staged for human approval. No CRM data was changed." };
}

async function searchWeb(args: Record<string, unknown>) {
  const base = String(process.env.SEARXNG_URL || "").replace(/\/+$/, "");
  if (!base) return { error: "Free web search is not configured. Set SEARXNG_URL to a private SearXNG server." };
  const url = new URL(`${base}/search`);
  url.searchParams.set("q", text(args.query, 500));
  url.searchParams.set("format", "json");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Web search returned HTTP ${response.status}`);
  const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results || []).slice(0, 8).map(result => ({
    title: text(result.title, 200),
    url: text(result.url, 600),
    snippet: text(result.content, 500),
  }));
}

export async function executeAiTool(
  actor: AiActor,
  conversationId: string | null,
  name: string,
  args: Record<string, unknown>,
) {
  const started = Date.now();
  let result: unknown;
  let permission: PermissionKey;
  try {
    switch (name) {
      case "search_customers":
      case "search_quotes":
      case "search_orders":
      case "business_snapshot":
        permission = PermissionKey.AI_CRM_SEARCH;
        if (!(await allowed(actor, permission))) throw new Error("AI CRM search permission is required");
        result = name === "search_customers" ? await searchCustomers(actor, args)
          : name === "search_quotes" ? await searchQuotes(actor, args)
          : name === "search_orders" ? await searchOrders(actor, args)
          : await businessSnapshot(actor);
        break;
      case "calculate_print_quote":
        permission = PermissionKey.AI_PRICING_USE;
        if (!(await allowed(actor, permission))) throw new Error("AI pricing permission is required");
        result = await calculatePricing(args);
        break;
      case "inspect_customer_file":
        permission = PermissionKey.AI_FILES_ANALYZE;
        if (!(await allowed(actor, permission))) throw new Error("AI file analysis permission is required");
        result = await inspectFile(actor, args);
        break;
      case "propose_crm_action":
        permission = PermissionKey.AI_ACTIONS_PROPOSE;
        if (!(await allowed(actor, permission))) throw new Error("AI action proposal permission is required");
        result = await proposeAction(actor, conversationId, args);
        break;
      case "search_web":
        permission = PermissionKey.AI_WEB_SEARCH;
        if (!(await allowed(actor, permission))) throw new Error("AI web search permission is required");
        if (actor.role !== Role.OWNER && !isThreeDPrintingRequest(text(args.query, 500))) {
          throw new Error("Restricted users may search the web only for 3D-printing projects");
        }
        result = await searchWeb(args);
        break;
      default:
        throw new Error("Unknown or unauthorized AI tool");
    }
    await db.aiToolRun.create({
      data: { conversationId, userId: actor.id, toolName: name, durationMs: Date.now() - started, inputJson: args as never, outputSummary: JSON.stringify(result).slice(0, 1000) },
    }).catch(() => {});
    return result;
  } catch (error) {
    await db.aiToolRun.create({
      data: { conversationId, userId: actor.id, toolName: name, success: false, durationMs: Date.now() - started, inputJson: args as never, outputSummary: error instanceof Error ? error.message.slice(0, 1000) : "Tool failed" },
    }).catch(() => {});
    throw error;
  }
}

export function shouldUseNativeOpenAiWebSearch(mode: AiToolMode, canWebSearch: boolean) {
  return canWebSearch && (mode === "AUTO" || mode === "WEB");
}
