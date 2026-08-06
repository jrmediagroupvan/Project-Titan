import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeStoragePath } from "@/lib/storage";

export const FIGURE_STYLES = [
  "BOBBLEHEAD", "CHIBI", "REALISTIC_BUST", "CARTOON", "HERO", "BUSINESS_MASCOT", "PET_FIGURINE", "TROPHY",
] as const;
export const BASE_STYLES = ["ROUND", "SQUARE", "HEXAGON", "TROPHY", "LOGO"] as const;

export function safeFigureTitle(value: string) {
  return value.replace(/[^a-zA-Z0-9 _.-]/g, "").trim().slice(0, 80) || "Custom Figurine";
}

export async function storeForgeBytes(storageKey: string, bytes: Uint8Array) {
  const target = safeStoragePath(storageKey);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(temporary, bytes, { flag: "wx" });
  await rename(temporary, target);
}

export type ForgeProviderResult = {
  stlBytes?: Uint8Array;
  jobId?: string;
  status: "READY" | "PROCESSING";
  metadata?: Record<string, unknown>;
};

export async function requestFigureGeneration(input: {
  image: File;
  title: string;
  style: string;
  baseStyle: string;
  nameplateText: string;
  instructions: string;
  callbackUrl?: string;
}): Promise<ForgeProviderResult> {
  const endpoint = process.env.TITAN_FORGE_API_URL?.trim();
  const apiKey = process.env.TITAN_FORGE_API_KEY?.trim();
  const provider = process.env.TITAN_FORGE_PROVIDER?.trim() || "CUSTOM_HTTP";
  if (!endpoint) throw new Error("TITAN Forge provider is not configured. Set TITAN_FORGE_API_URL in .env.");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("TITAN Forge requires HTTPS, except for a local provider.");
  }
  const form = new FormData();
  form.set("image", input.image, input.image.name);
  form.set("title", input.title);
  form.set("style", input.style);
  form.set("baseStyle", input.baseStyle);
  form.set("nameplateText", input.nameplateText);
  form.set("instructions", input.instructions);
  form.set("outputFormat", "stl");
  if (input.callbackUrl) form.set("callbackUrl", input.callbackUrl);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } : {}),
      "X-TITAN-Provider": provider,
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Figure provider returned ${response.status}: ${(await response.text()).slice(0, 250)}`);
  const type = response.headers.get("content-type") || "";
  if (type.includes("model/stl") || type.includes("application/sla") || type.includes("application/octet-stream")) {
    return { status: "READY", stlBytes: new Uint8Array(await response.arrayBuffer()) };
  }
  const body = await response.json().catch(() => null) as null | {
    stlBase64?: string; stlUrl?: string; jobId?: string; status?: string; metadata?: Record<string, unknown>;
  };
  if (!body) throw new Error("Figure provider returned an unsupported response.");
  if (body.stlBase64) return { status: "READY", stlBytes: Uint8Array.from(Buffer.from(body.stlBase64, "base64")), metadata: body.metadata };
  if (body.stlUrl) {
    const stlResponse = await fetch(new URL(body.stlUrl), { cache: "no-store", signal: AbortSignal.timeout(120000) });
    if (!stlResponse.ok) throw new Error(`Could not download generated STL (${stlResponse.status}).`);
    return { status: "READY", stlBytes: new Uint8Array(await stlResponse.arrayBuffer()), metadata: body.metadata };
  }
  if (body.jobId) return { status: "PROCESSING", jobId: body.jobId, metadata: body.metadata };
  throw new Error("Provider response did not include STL data, an STL URL, or a job ID.");
}
