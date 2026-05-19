import { convertSiyen } from "./siyen";
import type { KppyFormat } from "./index";

/**
 * Nam Si-yen (南四縣) KPPY → PFS conversion.
 *
 * v1 stub: delegates to the Si-yen converter. The two dialects share orthography
 * for the vast majority of syllables (KPPY/PFS encode tone *categories*, not
 * surface pitch — the actual pitch realization differs but the spelling does not).
 *
 * Known divergences that need upstream lib work before they can be honored here:
 *   - -ieu / -iet rhymes used in Nam Si-yen where Si-yen has -eu / -et in some lexical items
 *   - Sandhi-driven tone-mark differences in particular compounds
 *   - A handful of lexical splits where the same KPPY spelling reads to a different
 *     PFS word in each dialect
 *
 * When the upstream lib gains Nam Si-yen support, replace the body of this function
 * with a Nam-Si-yen-specific call; the rest of the pipeline already handles divergent
 * output.
 */
export function convertNamSiyen(kppy: string, format: KppyFormat): string {
  return convertSiyen(kppy, format);
}
