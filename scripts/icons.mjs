#!/usr/bin/env node
// Regenerate icon PNGs from store/icons/icon.svg.
// Requires rsvg-convert (brew install librsvg).

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const svg = resolve(root, "store/icons/icon.svg");

const targets = [
  { size: 16, path: "src/icons/icon-16.png" },
  { size: 32, path: "src/icons/icon-32.png" },
  { size: 48, path: "src/icons/icon-48.png" },
  { size: 128, path: "src/icons/icon-128.png" },
  { size: 128, path: "store/icons/store-icon-128.png" },
];

for (const { size, path } of targets) {
  const out = resolve(root, path);
  execFileSync(
    "rsvg-convert",
    ["-w", String(size), "-h", String(size), svg, "-o", out],
    { stdio: "inherit" },
  );
  console.log(`  ${size}x${size}  ${path}`);
}
