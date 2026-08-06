import path from "node:path";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".stl", ".3mf", ".step", ".stp", ".obj", ".gcode",
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".pdf", ".txt", ".csv", ".zip",
]);

export function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.TITAN_UPLOAD_DIR || "/app/uploads");
}

export function safeStoragePath(storageKey: string) {
  const root = uploadRoot();
  const resolved = path.resolve(/*turbopackIgnore: true*/ root, storageKey);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export function safeDownloadName(value: string) {
  return value.replace(/[\r\n"]/g, "_").replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "download";
}

export function extensionFor(filename: string) {
  return path.extname(filename).toLowerCase();
}
