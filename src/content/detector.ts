import { convertHakfa } from "../converter/konverttopfs";
import type { KppyFormat } from "../converter";
export type { KppyFormat };

// Modifier letters used by KPPY 調型: ˊ (U+02CA) high-rising, ˇ (U+02C7)
// low-rising, ˋ (U+02CB) low-falling. The '+' modifier appears on some
// non-Si-yen rows (e.g. Tai-pu 大埔).
const UNICODE_TONE_RE = /[ˊˇˋ+]/;

// Trailing tone-number on a syllable: 調號 is single digit (1, 2, 3, 4, 5, 8
// in Si-yen 八聲 numbering); 調值 is two-digit Chao pitch (11, 24, 31, 55) on
// open syllables and single digit (2, 5) on checked syllables.
const DIGIT_TONE_RE = /[A-Za-zÀ-ÿˀ-˿̀-ͯ]\d/;

// Tokens include letters, diacritic combining marks, KPPY modifier letters,
// '+', and ASCII digits. Letters and digits must be glued so 'siib8' tokenises
// as one unit.
const TOKEN_RE = /[A-Za-zÀ-ÿˀ-˿̀-ͯ0-9+]+/g;

// A token must contain at least one Latin letter to be a syllable candidate.
const HAS_LETTER = /[A-Za-zÀ-ÿ]/;

export interface DetectedRun {
  start: number;
  end: number;
  text: string;
  format: KppyFormat;
}

interface Token {
  start: number;
  end: number;
  text: string;
}

/**
 * Find runs of KPPY-shaped tokens in [text]. Any token the converter
 * recognizes as a valid Hakfa syllable (or that carries a KPPY tone marker)
 * can start or join a run. Adjacent tokens separated by space, NBSP, or
 * hyphen are merged into one run. Bare tone symbols (e.g. a lone ˇ) without
 * any Latin letter are excluded.
 */
export function detectKppyRuns(text: string): DetectedRun[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const isHakfa = tokens.map(
    (t) => isToneMarked(t.text) || isLikelyHakfaSyllable(t.text),
  );

  const runs: DetectedRun[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isHakfa[i]) {
      i++;
      continue;
    }
    let hi = i;
    while (
      hi + 1 < tokens.length &&
      isHakfa[hi + 1] &&
      isSeparator(text, tokens[hi].end, tokens[hi + 1].start)
    ) {
      hi++;
    }
    const start = tokens[i].start;
    const end = tokens[hi].end;
    const runText = text.slice(start, end);
    runs.push({ start, end, text: runText, format: detectFormat(runText) });
    i = hi + 1;
  }
  return runs;
}

// '+' after a letter (not '++') is a Tai-pu tone modifier, not arithmetic.
const PLUS_TONE_RE = /[A-Za-zÀ-ÿˀ-˿̀-ͯ]\+(?!\+)/;

function isToneMarked(token: string): boolean {
  return /[ˊˇˋ]/.test(token) || DIGIT_TONE_RE.test(token) || PLUS_TONE_RE.test(token);
}

/**
 * Determine which KPPY tone-display format a run uses:
 *   - 'unicode' (調型): modifier letters, '+', or no markers at all (unmarked
 *     tone, e.g. 陰平 in Si-yen).
 *   - 'pitch'   (調值): any digit group ≥ 2 digits (Chao pitch values).
 *   - 'category'(調號): single-digit 八聲 tone numbers throughout.
 */
function detectFormat(text: string): KppyFormat {
  if (UNICODE_TONE_RE.test(text)) return "unicode";
  const digitGroups = text.match(/\d+/g);
  if (!digitGroups) return "unicode";
  if (digitGroups.some((g) => g.length >= 2)) return "pitch";
  return "category";
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    const t = m[0];
    if (!HAS_LETTER.test(t)) continue;
    out.push({ start: idx, end: idx + t.length, text: t });
  }
  return out;
}

// Accept any non-empty run of ASCII spaces, no-break spaces (U+00A0 — common
// in HTML produced by word processors and CMSes), and ASCII hyphens between
// two KPPY-shaped tokens.
function isSeparator(text: string, from: number, to: number): boolean {
  if (to <= from) return false;
  for (let i = from; i < to; i++) {
    const c = text.charCodeAt(i);
    // 0x20 space, 0xA0 NBSP, 0x2D hyphen-minus
    if (c !== 0x20 && c !== 0xa0 && c !== 0x2d) return false;
  }
  return true;
}

// Caches converter results for individual tokens.
const SYLLABLE_CACHE = new Map<string, boolean>();
const CACHE_LIMIT = 4096;

function isLikelyHakfaSyllable(token: string): boolean {
  const key = token.toLowerCase();
  const cached = SYLLABLE_CACHE.get(key);
  if (cached !== undefined) {
    SYLLABLE_CACHE.delete(key);
    SYLLABLE_CACHE.set(key, cached);
    return cached;
  }
  const result = convertHakfa(key, "KPPY_UNICODE", "KPPY_INPUT") !== key;
  if (SYLLABLE_CACHE.size >= CACHE_LIMIT) {
    SYLLABLE_CACHE.delete(SYLLABLE_CACHE.keys().next().value as string);
  }
  SYLLABLE_CACHE.set(key, result);
  return result;
}
