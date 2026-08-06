import { readFile } from "node:fs/promises";
import { PermissionKey } from "@prisma/client";
import createOcct from "occt-import-js";
import { requireUser } from "@/lib/authorization";
import { customerRelationWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { userAllows } from "@/lib/permissions";
import { safeStoragePath } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser();
  if (!(await userAllows(actor.id, actor.role, PermissionKey.UPLOADS_VIEW))) {
    return Response.json({ error: "Uploads view permission is required." }, { status: 403 });
  }
  const { id } = await params;
  const file = await db.customerFile.findFirst({ where: { id, ...customerRelationWhere(actor) } });
  if (!file) return Response.json({ error: "File not found." }, { status: 404 });
  if (!["STEP", "STP"].includes(file.fileType)) {
    return Response.json({ error: "STEP/STP conversion is not required for this file." }, { status: 400 });
  }
  try {
    const bytes = await readFile(/*turbopackIgnore: true*/ safeStoragePath(file.storageKey));
    const occt = await createOcct();
    const result = occt.ReadStepFile(bytes, {
      linearUnit: "millimeter",
      linearDeflectionType: "bounding_box_ratio",
      linearDeflection: 0.001,
      angularDeflection: 0.5,
    });
    if (!result.success || !result.meshes?.length) {
      return Response.json({ error: "The STEP/STP file could not be converted to viewable geometry." }, { status: 422 });
    }
    return Response.json({ meshes: result.meshes }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error("STEP preview conversion failed", error);
    return Response.json({ error: "TITAN could not convert this STEP/STP file for preview." }, { status: 500 });
  }
}
