import { ENABLED_KEY, STORAGE_KEY } from "./constants";

// An allowlist entry is an address prefix: either a bare host
// ("hakkadict.moe.edu.tw") or host + path prefix ("www.moedict.tw/:"). A URL
// is allowed when (hostname + pathname) starts with the entry.
export const DEFAULT_ALLOWLIST: readonly string[] = [
  "hakkadict.moe.edu.tw",
  "elearning.hakka.gov.tw/hakka/dictionary",
  "elearning.hakka.gov.tw/hakka/cert/vocabulary",
  "www.moedict.tw/:",
];

// Convert an allowlist entry to a chrome.permissions / chrome.scripting match
// pattern. Bare hosts produce `*://host/*`; host+path entries produce
// `*://host/path*` with the path glob.
export function entryMatchPattern(entry: string): string {
  const slash = entry.indexOf("/");
  if (slash === -1) return `*://${entry}/*`;
  const host = entry.slice(0, slash);
  const path = entry.slice(slash);
  return `*://${host}${path}*`;
}

export function isDefaultEntry(entry: string): boolean {
  return (DEFAULT_ALLOWLIST as readonly string[]).includes(entry);
}

export async function loadAllowlist(): Promise<string[]> {
  const raw = await chrome.storage.sync.get(STORAGE_KEY);
  const value = raw[STORAGE_KEY];
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === "string");
  return [...DEFAULT_ALLOWLIST];
}

export async function saveAllowlist(list: string[]): Promise<void> {
  const cleaned = Array.from(new Set(list.map(normalizeEntry).filter(Boolean)));
  await chrome.storage.sync.set({ [STORAGE_KEY]: cleaned });
}

function normalizeEntry(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const slash = s.indexOf("/");
  if (slash === -1) return s.toLowerCase();
  return s.slice(0, slash).toLowerCase() + s.slice(slash);
}

export function isAllowed(
  loc: { hostname: string; pathname: string },
  allowlist: readonly string[],
): boolean {
  const target = loc.hostname + loc.pathname;
  return allowlist.some((entry) => target.startsWith(entry));
}

export async function loadEnabled(): Promise<boolean> {
  const raw = await chrome.storage.sync.get(ENABLED_KEY);
  const value = raw[ENABLED_KEY];
  return value !== false;
}

export async function saveEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [ENABLED_KEY]: enabled });
}
