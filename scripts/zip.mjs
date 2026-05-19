#!/usr/bin/env node
// Package dist/ into a versioned zip for Chrome Web Store upload.
// Reads the version from manifest.json → showpfs-v{version}.zip in the project root.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const version = manifest.version;
const zipName = `showpfs-v${version}.zip`;

execFileSync("zip", ["-r", resolve(root, zipName), "."], {
  cwd: resolve(root, "dist"),
  stdio: "inherit",
});
console.log(`\n✓ ${zipName}`);
