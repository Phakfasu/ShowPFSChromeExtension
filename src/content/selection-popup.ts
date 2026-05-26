import { loadDictIndex, lookup } from "../lookup/dict-index";
import type { DictEntry } from "../lookup/types";
import { positionCard, renderNoResult, renderPopup } from "./popup-view";

const HOST_ID = "pfs-lookup-host";
const DEBOUNCE_MS = 150;
const MAX_SELECTION_LENGTH = 200;

let installed = false;
let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let lastQuery = "";
let debounceTimer: number | undefined;

export function installSelectionPopup(): void {
  if (installed) return;
  installed = true;
  console.info("[ShowPFS] selection-lookup active");
  // Warm the index cache so the first selection doesn't stall.
  void loadDictIndex()
    .then((idx) => console.info(`[ShowPFS] dict-index loaded: ${idx.entries.length} entries, version ${idx.version}`))
    .catch((err) => console.warn("[ShowPFS] dict-index load failed:", err));
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("keyup", onKeyUp, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", dismiss, true);
  window.addEventListener("resize", dismiss, true);
}

export function uninstallSelectionPopup(): void {
  if (!installed) return;
  installed = false;
  document.removeEventListener("mouseup", onMouseUp, true);
  document.removeEventListener("keyup", onKeyUp, true);
  document.removeEventListener("pointerdown", onPointerDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("scroll", dismiss, true);
  window.removeEventListener("resize", dismiss, true);
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  dismiss();
  lastQuery = "";
}

function onMouseUp(e: MouseEvent): void {
  if (isInsidePopup(e.target)) return;
  scheduleProcess();
}

function onKeyUp(e: KeyboardEvent): void {
  // Shift+arrow text expansion etc.
  if (!e.shiftKey && e.key !== "ArrowLeft" && e.key !== "ArrowRight" &&
      e.key !== "ArrowUp" && e.key !== "ArrowDown") {
    return;
  }
  scheduleProcess();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape" && host) {
    dismiss();
    e.stopPropagation();
  }
}

function onPointerDown(e: PointerEvent): void {
  if (!host) return;
  if (isInsidePopup(e.target)) return;
  dismiss();
}

function scheduleProcess(): void {
  if (debounceTimer !== undefined) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined;
    void process();
  }, DEBOUNCE_MS);
}

async function process(): Promise<void> {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    if (lastQuery) dismiss();
    lastQuery = "";
    return;
  }
  const raw = sel.toString();
  const text = raw.trim();
  if (!text || text.length > MAX_SELECTION_LENGTH) {
    dismiss();
    lastQuery = "";
    return;
  }
  if (text === lastQuery && host) return;

  let entries;
  try {
    entries = await lookup(text);
  } catch {
    return;
  }
  lastQuery = text;

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (entries.length === 0) showNoResult(text, rect);
  else show(entries, rect);
}

function show(entries: DictEntry[], rect: DOMRect): void {
  const card = renderPopup(ensureShadow(), entries);
  // Position after layout settles so we measure accurately.
  requestAnimationFrame(() => positionCard(card, rect));
}

function showNoResult(query: string, rect: DOMRect): void {
  const card = renderNoResult(ensureShadow(), query);
  requestAnimationFrame(() => positionCard(card, rect));
}

function ensureShadow(): ShadowRoot {
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    // Anchor the host out of flow so it doesn't add layout space while the
    // shadow stylesheet loads asynchronously.
    host.style.cssText =
      "all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647;";
    shadow = host.attachShadow({ mode: "closed" });
    document.documentElement.appendChild(host);
  }
  return shadow!;
}

function dismiss(): void {
  if (!host) return;
  host.remove();
  host = null;
  shadow = null;
}

export async function triggerLookup(): Promise<void> {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const text = sel.toString().trim();
  if (!text || text.length > MAX_SELECTION_LENGTH) return;

  let entries;
  try {
    entries = await lookup(text);
  } catch {
    return;
  }
  lastQuery = text;

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (entries.length === 0) showNoResult(text, rect);
  else show(entries, rect);
  if (!installed) ensureDismissHandlers();
}

// Whether dismiss-only event handlers have been installed for the context-menu
// trigger path. These persist for the lifetime of the page; they no-op cheaply
// when `host` is null, so there is no need to unregister them.
let dismissHandlersInstalled = false;

function ensureDismissHandlers(): void {
  if (dismissHandlersInstalled) return;
  dismissHandlersInstalled = true;
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", dismiss, true);
  window.addEventListener("resize", dismiss, true);
}

function isInsidePopup(target: EventTarget | null): boolean {
  if (!host || !target) return false;
  const path = (target as Element).getRootNode?.();
  if (path === shadow) return true;
  if (target instanceof Node && host.contains(target)) return true;
  return false;
}
