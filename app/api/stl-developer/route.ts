import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PermissionKey } from "@prisma/client";
import { generateAiStlPlan, buildStlFromPlan } from "@/lib/ai-stl";
import { aiScopeAllows } from "@/lib/ai-scope";
import { loadAiConfiguration } from "@/lib/ai";
import { requireUser } from "@/lib/authorization";
import { requireCustomerAccess } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import { safeStoragePath } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const actor = await requireUser();
  const body = await request.json().catch(() => ({})) as {
    prompt?: unknown;
    designId?: unknown;
    customerId?: unknown;
  };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const designId = typeof body.designId === "string" ? body.designId : "";
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const permission = designId ? PermissionKey.AI_STL_EDIT : PermissionKey.AI_STL_CREATE;
  if (!(await userAllows(actor.id, actor.role, permission))) {
    return Response.json({ error: "AI STL Developer permission is required." }, { status: 403 });
  }
  if (!prompt || prompt.length > 3000) {
    return Response.json({ error: "Describe the model in 3,000 characters or fewer." }, { status: 400 });
  }
  if (!aiScopeAllows({ role: actor.role, message: `STL 3D-printing design request: ${prompt}`, recentMessages: [] })) {
    return Response.json({ error: "This account can use AI only for 3D-printing projects." }, { status: 403 });
  }
  if (customerId) await requireCustomerAccess(customerId, actor);

  const existing = designId
    ? await db.aiStlDesign.findFirst({
        where: actor.role === "OWNER" ? { id: designId } : { id: designId, userId: actor.id },
      })
    : null;
  if (designId && !existing) return Response.json({ error: "Design not found." }, { status: 404 });

  try {
    const config = await loadAiConfiguration(actor.id);
    const plan = await generateAiStlPlan({
      config,
      prompt,
      currentPlan: existing?.designJson,
    });
    const compiled = buildStlFromPlan(plan);
    const id = existing?.id || randomUUID();
    const storageKey = existing?.storageKey || path.posix.join("ai-stl", `${id}.stl`);
    const target = safeStoragePath(storageKey);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(temporary, compiled.bytes, { flag: "wx" });
    await rename(temporary, target);

    const design = existing
      ? await db.aiStlDesign.update({
          where: { id },
          data: {
            customerId: customerId || existing.customerId,
            title: plan.title,
            prompt,
            summary: plan.summary,
            designJson: plan,
            bytes: compiled.bytes.length,
            dimensions: compiled.dimensions,
            provider: config.provider,
            model: config.model,
            revision: { increment: 1 },
          },
        })
      : await db.aiStlDesign.create({
          data: {
            id,
            userId: actor.id,
            customerId: customerId || null,
            title: plan.title,
            prompt,
            summary: plan.summary,
            designJson: plan,
            storageKey,
            bytes: compiled.bytes.length,
            dimensions: compiled.dimensions,
            provider: config.provider,
            model: config.model,
          },
        });
    await db.auditEvent.create({
      data: {
        userId: actor.id,
        action: existing ? "AI_STL_REVISED" : "AI_STL_CREATED",
        entityType: "AiStlDesign",
        entityId: design.id,
        summary: `${design.title} · revision ${design.revision}`,
        metadata: { dimensions: compiled.dimensions, provider: config.provider, model: config.model },
      },
    }).catch(() => {});
    return Response.json({ id: design.id, revision: design.revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI STL generation failed.";
    const status = /not configured|configuration is incomplete/i.test(message) ? 503
      : /invalid|malformed|empty|complex|dimensions|triangle|geometry|torus/i.test(message) ? 422
      : 502;
    return Response.json({ error: message.slice(0, 500) }, { status });
  }
}
