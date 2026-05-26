import { normalizeFolded, normalizeLookup } from "../shared/normalize.mjs";
import type { DictEntry, DictIndex } from "./types";

let pending: Promise<DictIndex> | null = null;
let cached: DictIndex | null = null;

export function loadDictIndex(): Promise<DictIndex> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    const url = chrome.runtime.getURL("src/data/dict-index.json");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`dict-index: ${res.status} ${res.statusText}`);
    const idx = (await res.json()) as DictIndex;
    cached = idx;
    return idx;
  })();
  return pending;
}

export async function lookup(selection: string): Promise<DictEntry[]> {
  const trimmed = selection.trim();
  if (!trimmed) return [];
  const idx = await loadDictIndex();
  const precise = normalizeLookup(trimmed);
  const folded = normalizeFolded(trimmed);

  const seen = new Set<number>();
  const out: DictEntry[] = [];
  const collect = (ids: number[] | undefined) => {
    if (!ids) return;
    for (const i of ids) {
      if (seen.has(i)) continue;
      seen.add(i);
      out.push(idx.entries[i]);
    }
  };
  collect(idx.keys[precise]);
  if (folded && folded !== precise) collect(idx.keysFolded[folded]);
  return out;
}
