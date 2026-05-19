import { convertHakfa } from "./konverttopfs";
import type { KppyFormat } from "./index";

// Official KPPY 調號 (八聲 slot) → lib KPPY_INPUT digit (PFS-style 1–6).
// Source: hakfa-roman-orthography skill master tone table.
// The lib's KPPY_INPUT parser expects single digits 1–6 (PFS-style numbering),
// NOT Chao pitch values.
const CATEGORY_TO_LIB: Record<string, string> = {
  "1": "1", // 陰平 → lib tone 1
  "2": "3", // 上聲 → lib tone 3
  "3": "4", // 去聲 → lib tone 4
  "4": "6", // 陰入 → lib tone 6 (checked, low)
  "5": "2", // 陽平 → lib tone 2
  "8": "5", // 陽入 → lib tone 5 (checked, high)
};

// KPPY 調值 (Chao pitch) → lib KPPY_INPUT digit (PFS-style 1–6).
// Open syllables carry two-digit values; checked syllables carry one digit.
const PITCH_TO_LIB: Record<string, string> = {
  "24": "1", // 陰平
  "11": "2", // 陽平
  "31": "3", // 上聲
  "55": "4", // 去聲
  "5": "5", //  陽入 (checked, high)
  "2": "6", //  陰入 (checked, low)
};

function remapDigits(
  text: string,
  table: Record<string, string>,
  multiDigit: boolean,
): string {
  const re = multiDigit
    ? /([A-Za-zÀ-ÿˀ-˿̀-ͯ]+)(\d+)/g
    : /([A-Za-zÀ-ÿˀ-˿̀-ͯ]+)(\d)(?!\d)/g;
  return text.replace(re, (_, syl, tone) => syl + (table[tone] ?? tone));
}

/**
 * Si-yen (四縣) KPPY → PFS conversion.
 * Delegates to the bundled KonvertToPFS Kotlin/JS library.
 *
 * Format selection:
 *   - 'unicode'  (調型): pass through as KPPY_UNICODE
 *   - 'pitch'    (調值): remap Chao pitch digits → lib 1–6, then KPPY_INPUT
 *   - 'category' (調號): remap 八聲 digits → lib 1–6, then KPPY_INPUT
 */
export function convertSiyen(kppy: string, format: KppyFormat): string {
  if (format === "unicode") {
    return convertHakfa(kppy, "KPPY_UNICODE", "PFS_UNICODE");
  }
  const input =
    format === "category"
      ? remapDigits(kppy, CATEGORY_TO_LIB, false)
      : remapDigits(kppy, PITCH_TO_LIB, true);
  return convertHakfa(input, "KPPY_INPUT", "PFS_UNICODE");
}
