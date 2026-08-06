#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const required = [
  "components/TitanBrand.tsx",
  "components/TitanBrand.module.css",
  "public/project-titan-logo-ui.png",
  "public/project-titan-mark-ui.png",
];

let failed = false;

for (const relative of required) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    console.error(`MISSING: ${relative}`);
    failed = true;
    continue;
  }
  if (fs.statSync(full).size === 0) {
    console.error(`EMPTY: ${relative}`);
    failed = true;
    continue;
  }
  console.log(`OK: ${relative}`);
}

const component = fs.readFileSync(
  path.join(root, "components", "TitanBrand.tsx"),
  "utf8"
);

if (component.includes('from "next/image"')) {
  console.error("TitanBrand still imports next/image.");
  failed = true;
}

if (!component.includes("<img")) {
  console.error("TitanBrand does not contain a static img element.");
  failed = true;
}

process.exit(failed ? 1 : 0);
