import { isAllowed, loadAllowlist, loadEnabled } from "../shared/allowlist";
import { isHakfaConverterLoaded } from "../converter/konverttopfs";
import { installSelectionPopup, triggerLookup, uninstallSelectionPopup } from "./selection-popup";
import { scanSubtree, startObserving, stopObserving } from "./walker";

let allowlist: readonly string[] = [];
let active = false;

async function main(): Promise<void> {
  const enabled = await loadEnabled();
  if (!enabled) return;

  allowlist = await loadAllowlist();
  injectStyles();
  watchUrlChanges();
  syncToCurrentUrl();
}

// Activate or deactivate the annotation observer and the selection-lookup
// popup based on whether the current URL matches the allowlist. SPA hosts
// (e.g. moedict.tw) navigate without reload, so we re-check on every URL
// transition rather than only at injection time. The popup doesn't depend
// on the Kotlin converter — it reads pre-computed PFS from the bundled
// index — so it activates even if the converter failed to load.
function syncToCurrentUrl(): void {
  const allowedNow = isAllowed(location, allowlist);
  if (allowedNow && !active) {
    if (isHakfaConverterLoaded) {
      scanSubtree(document.body);
      startObserving();
    }
    installSelectionPopup();
    active = true;
  } else if (!allowedNow && active) {
    if (isHakfaConverterLoaded) stopObserving();
    uninstallSelectionPopup();
    active = false;
  }
}

function watchUrlChanges(): void {
  const fire = () => queueMicrotask(syncToCurrentUrl);
  addEventListener("popstate", fire);
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m];
    history[m] = function (...args: Parameters<typeof orig>) {
      const ret = orig.apply(this, args);
      fire();
      return ret;
    };
  }
}

function injectStyles(): void {
  const parent = document.head ?? document.documentElement;
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = chrome.runtime.getURL("src/content/styles.css");
  parent.appendChild(sheet);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "pfs-context-menu-lookup") {
    void triggerLookup();
  }
});

main().catch((err) => console.error("[ShowPFS]", err));
