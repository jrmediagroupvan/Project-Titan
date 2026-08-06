#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function write(relative, value) {
  fs.writeFileSync(path.join(root, relative), value, "utf8");
}

function patchPackageJson() {
  const relative = "package.json";
  const pkg = JSON.parse(read(relative));

  pkg.scripts ??= {};
  pkg.scripts.build = "prisma generate && next build --webpack";
  pkg.scripts["validate:types"] = "tsc --noEmit";
  pkg.scripts["validate:build"] = "next build --webpack";
  pkg.scripts["validate:prisma"] = "prisma validate && prisma generate";
  pkg.scripts.validate =
    "npm run check:encoding && npm run check:imports && npm run validate:prisma && npm run validate:types && npm run validate:build";

  write(relative, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Updated package.json scripts.");
}

function patchFigureForge() {
  const relative = "app/api/figure-forge/route.ts";
  const full = path.join(root, relative);

  if (!fs.existsSync(full)) {
    console.warn(`Skipped ${relative}: file was not found.`);
    return;
  }

  let source = read(relative);

  const broken =
    "metadata: result.metadata || undefined, errorMessage: null,";

  const fixed = `metadata: result.metadata
        ? JSON.parse(JSON.stringify(result.metadata))
        : undefined,
      errorMessage: null,`;

  if (source.includes(broken)) {
    source = source.replace(broken, fixed);
    write(relative, source);
    console.log(`Fixed ${relative}.`);
    return;
  }

  if (source.includes("JSON.parse(JSON.stringify(result.metadata))")) {
    console.log(`${relative} is already fixed.`);
    return;
  }

  throw new Error(
    `${relative} did not match the expected source. Review the metadata assignment manually.`
  );
}

patchPackageJson();
patchFigureForge();

console.log("Cross-platform Project TITAN source fixes completed.");
