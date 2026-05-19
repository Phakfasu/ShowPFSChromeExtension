// Lookup-key normalization shared by the build-time index generator
// (scripts/build-index.mjs) and the content-script runtime lookup
// (src/lookup/dict-index.ts). Authored in plain ESM so Node can import it
// directly without a TS toolchain; TypeScript consumers get types from
// the sibling .d.mts file.

const ZERO_WIDTH = /[​-‍﻿]/g;
// ASCII hyphen, ideographic spaces, NBSP — all collapse to a single space.
const SEPARATOR = /[\s 　\-]+/g;

// Combining marks that we strip for the diacritic-folded fallback. Covers
// Unicode combining-diacritic blocks plus the standalone KPPY modifier
// letters (ˊ ˇ ˋ) and the Tai-pu '+' tone modifier.
const COMBINING = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g;
const KPPY_MODIFIERS = /[ˊˇˋ+]/g;

export function normalizeLookup(s) {
  if (!s) return "";
  return s
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(SEPARATOR, " ")
    .trim()
    .toLowerCase();
}

export function normalizeFolded(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(KPPY_MODIFIERS, "")
    .replace(ZERO_WIDTH, "")
    .replace(SEPARATOR, " ")
    .trim()
    .toLowerCase();
}

export function normalizeVariants(s) {
  const out = [];
  const precise = normalizeLookup(s);
  if (precise) out.push(precise);
  const folded = normalizeFolded(s);
  if (folded && folded !== precise) out.push(folded);
  return out;
}
