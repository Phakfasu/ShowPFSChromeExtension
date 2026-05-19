import { defineConfig, type Plugin } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

// The KonvertToPFS Kotlin/JS UMD bundles probe `typeof define`/`typeof exports`
// to pick an AMD/CJS/globalThis registration path. Rollup wraps them in a CJS
// shim that makes `typeof exports === "object"` true, so they take the CJS
// branch and call `require("./kotlin-kotlin-stdlib.js")` — which is undefined
// in a browser content script and crashes the script before annotation runs.
// Neutralize the AMD and CJS probes so the bundles fall through to the
// `globalThis["org.phakfasu:lib"]` branch that konverttopfs.ts reads from.
//
// If a future Kotlin/JS release changes the UMD header shape, the literal
// replacements silently no-op and the crash returns. Fail the build instead.
const KOTLIN_UMD_FILES = [
  "lib/KonvertToPFS/lib/build/dist/js/productionLibrary/kotlin-kotlin-stdlib.js",
  "lib/KonvertToPFS/lib/build/dist/js/productionLibrary/KonvertToPFS-lib.js",
];
const forceKotlinUmdGlobalThis = (): Plugin => ({
  name: "force-kotlin-umd-globalthis",
  enforce: "pre",
  transform(code, id) {
    if (!KOTLIN_UMD_FILES.some((suffix) => id.endsWith(suffix))) {
      return null;
    }
    const amdProbe = "typeof define === 'function' && define.amd";
    const cjsProbe = "typeof exports === 'object'";
    if (!code.includes(amdProbe) || !code.includes(cjsProbe)) {
      throw new Error(
        `force-kotlin-umd-globalthis: expected UMD probes not found in ${id}. ` +
          "The Kotlin/JS UMD header shape may have changed — update this plugin " +
          "or the content script will crash with `require is not defined`.",
      );
    }
    return {
      code: code.split(amdProbe).join("false").split(cjsProbe).join("false"),
      map: null,
    };
  },
});

export default defineConfig({
  plugins: [forceKotlinUmdGlobalThis(), crx({ manifest })],
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      // The KonvertToPFS Kotlin/JS bundle ships .js.map files that reference
      // Kotlin sources via paths relative to the Gradle build sandbox. Once
      // bundled by vite, rollup can't resolve those sources and warns. The
      // warning is harmless (build succeeds; runtime is unaffected); silence
      // it so real warnings are not lost in the noise.
      onwarn(warning, defaultHandler) {
        const msg = typeof warning.message === "string" ? warning.message : "";
        if (
          msg.includes("Sourcemap") &&
          msg.includes("points to missing source files") &&
          msg.includes("KonvertToPFS")
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
});
