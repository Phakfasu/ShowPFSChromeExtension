// Bridge to the KonvertToPFS Kotlin/JS library (lib/KonvertToPFS git
// submodule). Imports point at the submodule's Gradle build output.
//
// The Kotlin/JS distribution is a UMD bundle. Under ES modules it falls
// through to its globalThis registration branch and exposes the namespace at
// globalThis["org.phakfasu:lib"]. Load order matters — the stdlib must
// register itself before the library reads it.
import "../../lib/KonvertToPFS/lib/build/dist/js/productionLibrary/kotlin-kotlin-stdlib.js";
import "../../lib/KonvertToPFS/lib/build/dist/js/productionLibrary/KonvertToPFS-lib.js";

type Format =
  | "PFS_INPUT"
  | "PFS_UNICODE"
  | "KPPY_INPUT"
  | "KPPY_UNICODE"
  | "FHL_DICT_INPUT"
  | "FHL_UNICODE"
  | "IPA";
type ConvertFn = (text: string, from: Format, to: Format) => string;

interface KonvertNamespace {
  org: {
    phakfasu: {
      konverttopfs: {
        convertHakfa: ConvertFn;
      };
    };
  };
}

const ns = (globalThis as Record<string, unknown>)["org.phakfasu:lib"] as
  | KonvertNamespace
  | undefined;

const liveConvert = ns?.org.phakfasu.konverttopfs.convertHakfa;

// One-shot self-test at module load. Catches the case where the UMD
// registered a namespace but the underlying converter is broken (wrong build,
// renamed export). Without this, a half-working bundle would silently produce
// passthrough-shaped annotations that *look* right.
//
// Two probes distinguish a tone-mark bug from an initial-mapping bug:
//   - "aˊ" → "â": zero-initial syllable, exercises only tone-1 vowel rendering
//   - "gaˊ" → "kâ": adds the KPPY-g → PFS-k initial mapping on top
function selfTest(fn: ConvertFn | undefined): boolean {
  if (!fn) return false;
  try {
    if (fn("aˊ", "KPPY_UNICODE", "PFS_UNICODE") !== "â") return false;
    if (fn("gaˊ", "KPPY_UNICODE", "PFS_UNICODE") !== "kâ") return false;
    return true;
  } catch {
    return false;
  }
}

const isLive = selfTest(liveConvert);

export const isHakfaConverterLoaded: boolean = isLive;

let warned = false;
const passthrough: ConvertFn = (text) => {
  if (!warned) {
    warned = true;
    console.error(
      "[ShowPFS] KonvertToPFS converter is not loaded or failed its self-test " +
        "(probes: aˊ → â, gaˊ → kâ). Annotations are disabled and input is " +
        "passed through unchanged. Re-run `npm run build:lib` and reload the " +
        "extension.",
    );
  }
  return text;
};

export const convertHakfa: ConvertFn = isLive && liveConvert ? liveConvert : passthrough;
