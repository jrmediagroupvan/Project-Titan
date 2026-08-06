import { randomUUID } from "node:crypto";
import path from "node:path";
import { PermissionKey, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/authorization";
import { requireCustomerAccess } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { FIGURE_STYLES, BASE_STYLES, requestFigureGeneration, safeFigureTitle, storeForgeBytes } from "@/lib/figure-forge";
import { userAllows } from "@/lib/permissions";
import { extensionFor, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 180;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.AI_STL_CREATE))) return Response.json({ error: "AI STL Create permission is required." }, { status: 403 });
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !IMAGE_TYPES.has(image.type) || image.size <= 0 || image.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Upload a JPG, PNG, or WEBP image under 50 MB." }, { status: 400 });
  }
  const title = safeFigureTitle(String(form.get("title") || ""));
  const style = String(form.get("style") || "BOBBLEHEAD");
  const baseStyle = String(form.get("baseStyle") || "ROUND");
  const nameplateText = String(form.get("nameplateText") || "").trim().slice(0, 60);
  const instructions = String(form.get("instructions") || "").trim().slice(0, 1500);
  const customerId = String(form.get("customerId") || "").trim();
  if (!FIGURE_STYLES.includes(style as never) || !BASE_STYLES.includes(baseStyle as never)) return Response.json({ error: "Invalid figure or base style." }, { status: 400 });
  if (customerId) await requireCustomerAccess(customerId, actor);

  const id = randomUUID();
  const extension = extensionFor(image.name) || ".jpg";
  const sourceImageKey = path.posix.join("figure-forge", id, `source${extension}`);
  await storeForgeBytes(sourceImageKey, new Uint8Array(await image.arrayBuffer()));
  const project = await db.forgeProject.create({ data: {
    id, userId: actor.id, customerId: customerId || null, title, style, baseStyle,
    nameplateText: nameplateText || null, instructions: instructions || null,
    status: "PROCESSING", sourceImageKey, sourceImageName: image.name.slice(0, 180), sourceMimeType: image.type,
    provider: process.env.TITAN_FORGE_PROVIDER || "CUSTOM_HTTP",
  }});
  try {
    const result = await requestFigureGeneration({ image, title, style, baseStyle, nameplateText, instructions });
    let stlStorageKey: string | null = null;
    if (result.stlBytes) {
      stlStorageKey = path.posix.join("figure-forge", id, `${id}.stl`);
      await storeForgeBytes(stlStorageKey, result.stlBytes);
    }
    await db.forgeProject.update({ where: { id }, data: {
      status: result.status, stlStorageKey, providerJobId: result.jobId || null,
      metadata: result.metadata
        ? (JSON.parse(JSON.stringify(result.metadata)) as Prisma.InputJsonValue)
        : undefined,
      errorMessage: null,
    }});
    await db.auditEvent.create({ data: { userId: actor.id, action: "FIGURE_FORGE_CREATED", entityType: "ForgeProject", entityId: id, summary: `${title} · ${style}` } }).catch(() => {});
    return Response.json({ id, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Figure generation failed.";
    await db.forgeProject.update({ where: { id }, data: { status: "FAILED", errorMessage: message.slice(0, 500) } });
    return Response.json({ id, error: message.slice(0, 500) }, { status: /not configured/i.test(message) ? 503 : 502 });
  }
}
