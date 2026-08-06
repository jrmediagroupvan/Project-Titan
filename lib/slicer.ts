import { unzipSync } from "fflate";

export type SliceEstimate = {
  status: "SLICED";
  materialGrams: number;
  modelTimeSeconds: number;
  totalTimeSeconds: number;
  slicer: string;
  slicerVersion?: string;
  profileKey: string;
  printer?: string;
  process?: string;
  filament?: string;
  nozzleMm?: number;
  material?: string;
  colour?: string;
  quantity?: number;
  slicedAt: string;
};

function durationSeconds(value: string) {
  let total = 0;
  for (const match of value.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/gi)) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    total += amount * (unit === "d" ? 86400 : unit === "h" ? 3600 : unit === "m" ? 60 : 1);
  }
  return Math.round(total);
}

export function parseBambuGcodeEstimate(gcode: string) {
  const weight = gcode.match(/total filament weight\s*\[g\]\s*:\s*([\d.]+)/i)
    || gcode.match(/total filament used\s*\[g\]\s*=\s*([\d.]+)/i);
  const combined = gcode.match(/model printing time\s*:\s*([^;\r\n]+)\s*;\s*total estimated time\s*:\s*([^;\r\n]+)/i);
  const legacy = gcode.match(/estimated printing time\s*\(normal mode\)\s*=\s*([^;\r\n]+)/i);
  const modelTimeSeconds = combined ? durationSeconds(combined[1]) : legacy ? durationSeconds(legacy[1]) : 0;
  const totalTimeSeconds = combined ? durationSeconds(combined[2]) : modelTimeSeconds;
  const materialGrams = weight ? Number(weight[1]) : 0;
  const version = gcode.match(/;\s*BambuStudio\s+([^\r\n]+)/i)?.[1]?.trim();
  if (!(materialGrams > 0) || !(totalTimeSeconds > 0)) {
    throw new Error("Bambu Studio output did not contain usable filament weight and print-time estimates");
  }
  return { materialGrams, modelTimeSeconds, totalTimeSeconds, slicerVersion: version };
}

export function parseBambuArchive(buffer: Buffer) {
  const entries = unzipSync(new Uint8Array(buffer));
  const gcodeEntries = Object.entries(entries).filter(([name]) => /\.gcode$/i.test(name));
  if (!gcodeEntries.length) throw new Error("The sliced 3MF does not contain G-code");
  const estimates = gcodeEntries.map(([, bytes]) => parseBambuGcodeEstimate(Buffer.from(bytes).toString("utf8")));
  return {
    materialGrams: estimates.reduce((sum, item) => sum + item.materialGrams, 0),
    modelTimeSeconds: estimates.reduce((sum, item) => sum + item.modelTimeSeconds, 0),
    totalTimeSeconds: estimates.reduce((sum, item) => sum + item.totalTimeSeconds, 0),
    slicerVersion: estimates.find(item => item.slicerVersion)?.slicerVersion,
  };
}

export async function requestBambuSlice(options: {
  bytes: Buffer;
  fileName: string;
  profileKey: string;
  quantity: number;
}) {
  const endpoint = String(process.env.TITAN_SLICER_URL || "").replace(/\/+$/, "");
  const token = String(process.env.TITAN_SLICER_TOKEN || "");
  if (!endpoint || !token) throw new Error("Bambu slicer bridge is not configured");
  const response = await fetch(`${endpoint}/slice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fileName: options.fileName,
      fileBase64: options.bytes.toString("base64"),
      profileKey: options.profileKey,
      quantity: Math.min(100, Math.max(1, Math.round(options.quantity))),
    }),
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const payload = await response.json().catch(() => ({})) as Partial<SliceEstimate> & { error?: string };
  if (!response.ok) throw new Error(String(payload.error || `Slicer bridge returned HTTP ${response.status}`).slice(0, 500));
  if (!(Number(payload.materialGrams) > 0) || !(Number(payload.totalTimeSeconds) > 0)) throw new Error("Slicer bridge returned an incomplete estimate");
  return {
    status: "SLICED",
    materialGrams: Number(payload.materialGrams),
    modelTimeSeconds: Number(payload.modelTimeSeconds) || Number(payload.totalTimeSeconds),
    totalTimeSeconds: Number(payload.totalTimeSeconds),
    slicer: "Bambu Studio",
    slicerVersion: payload.slicerVersion,
    profileKey: options.profileKey,
    printer: payload.printer,
    process: payload.process,
    filament: payload.filament,
    nozzleMm: Number(payload.nozzleMm) || undefined,
    slicedAt: new Date().toISOString(),
  } satisfies SliceEstimate;
}
