#!/usr/bin/env node
// Build the KonvertToPFS Kotlin/JS library inside the lib/KonvertToPFS git submodule.
// The TypeScript wrapper (src/converter/konverttopfs.ts) imports the
// resulting JS directly from lib/lib/build/dist/js/productionLibrary/ —
// there's no copy step.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");
const libRoot = resolve(projectRoot, "lib", "KonvertToPFS");

function runGradle() {
  return new Promise((res, rej) => {
    const child = spawn("./gradlew", [":lib:jsBrowserProductionLibraryDistribution"], {
      cwd: libRoot,
      stdio: "inherit",
    });
    child.on("close", (code) => (code === 0 ? res() : rej(new Error(`gradle exit ${code}`))));
    child.on("error", rej);
  });
}

console.log("[build-lib] running ./gradlew :lib:jsBrowserProductionLibraryDistribution");
runGradle().catch((err) => {
  console.error("[build-lib] failed:", err);
  process.exit(1);
});
