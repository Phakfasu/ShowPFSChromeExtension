import { convertSiyen } from "./siyen";
import { convertNamSiyen } from "./namSiyen";

// Which on-page KPPY notation a phrase uses, so the converter can decode it
// correctly. Lives in the converter package because it describes the
// converter's input contract — the detector tags each run with one of these
// before handing off.
export type KppyFormat = "unicode" | "category" | "pitch";

export interface DialectPfs {
  siyen: string;
  namSiyen: string;
}

export function convertToPfsBothDialects(
  kppy: string,
  format: KppyFormat = "unicode",
): DialectPfs {
  const joined = joinSyllablesWithHyphen(kppy);
  return {
    siyen: joinSyllablesWithHyphen(convertSiyen(joined, format)),
    namSiyen: joinSyllablesWithHyphen(convertNamSiyen(joined, format)),
  };
}

export function formatPfsText(pair: DialectPfs): string {
  if (pair.siyen === pair.namSiyen) return pair.siyen;
  return `${pair.siyen} / ${pair.namSiyen}`;
}

// Collapse ASCII space (0x20), NBSP (U+00A0), and hyphen into single hyphens.
// The Kotlin converter is NBSP-blind, so we normalize before and after it.
// Assumption: PFS output from the Kotlin converter is always hyphen-separated
// syllables — it never produces meaningful spaces. If the converter ever emits
// multi-word output with intentional spaces, this post-conversion join would
// need to be revisited.
const SEP_RE = /[  \-]+/g;
const SEP_TRIM_RE = /^[  \-]+|[  \-]+$/g;

function joinSyllablesWithHyphen(text: string): string {
  return text.replace(SEP_TRIM_RE, "").replace(SEP_RE, "-");
}
