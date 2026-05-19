import { DEFAULT_ALLOWLIST, entryMatchPattern, saveAllowlist } from "../shared/allowlist";
import { STORAGE_KEY } from "../shared/constants";

// Prefix used for content scripts we register dynamically (one per user-added
// host). Distinguishable from anything declared statically in the manifest.
const DYNAMIC_SCRIPT_PREFIX = "pfs-dynamic-";

// Origins baked into manifest host_permissions / content_scripts.matches. The
// dynamic registration path must skip these — the manifest already runs the
// content script on them.
const STATIC_ORIGINS = new Set(DEFAULT_ALLOWLIST.map(entryMatchPattern));

const CONTEXT_MENU_ID = "pfs-lookup-selection";

chrome.runtime.onInstalled.addListener(async (details) => {
  // Seed the default allowlist on first install only — reading the storage
  // key directly because loadAllowlist substitutes DEFAULT_ALLOWLIST when the
  // key is missing.
  if (details.reason === "install") {
    const raw = await chrome.storage.sync.get(STORAGE_KEY);
    if (!Array.isArray(raw[STORAGE_KEY])) {
      await saveAllowlist([...DEFAULT_ALLOWLIST]);
    }
  }
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "查客語辭典 (Hakfa Dictionary)",
    contexts: ["selection"],
  });
  void reconcileDynamicScripts();
});

chrome.runtime.onStartup.addListener(() => {
  void reconcileDynamicScripts();
});

chrome.permissions.onAdded.addListener(() => {
  void reconcileDynamicScripts();
});

chrome.permissions.onRemoved.addListener(() => {
  void reconcileDynamicScripts();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
  const msg = { type: "pfs-context-menu-lookup" };
  const frameId = info.frameId ?? 0;
  const opts = { frameId };
  try {
    await chrome.tabs.sendMessage(tab.id, msg, opts);
  } catch {
    // Content script not present — inject on demand via activeTab grant.
    const js = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
    if (js.length === 0) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frameId] },
        files: js,
      });
      await chrome.tabs.sendMessage(tab.id, msg, opts);
    } catch {
      // Injection not possible (chrome:// pages, Web Store, etc.)
    }
  }
});

// Sync chrome.scripting registrations with current chrome.permissions: register
// a content script for every user-granted origin, unregister any whose
// permission was revoked. Idempotent.
async function reconcileDynamicScripts(): Promise<void> {
  const [perms, registered] = await Promise.all([
    chrome.permissions.getAll(),
    chrome.scripting.getRegisteredContentScripts(),
  ]);

  const userOrigins = (perms.origins ?? []).filter((o) => !STATIC_ORIGINS.has(o));
  const wanted = new Map(
    userOrigins.map((o) => [`${DYNAMIC_SCRIPT_PREFIX}${o}`, o]),
  );

  const existing = new Set(
    registered
      .map((s) => s.id)
      .filter((id) => id.startsWith(DYNAMIC_SCRIPT_PREFIX)),
  );

  const toRemove = [...existing].filter((id) => !wanted.has(id));
  if (toRemove.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: toRemove });
  }

  const contentScriptJs =
    chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  const toAdd: chrome.scripting.RegisteredContentScript[] = [];
  for (const [id, origin] of wanted) {
    if (existing.has(id)) continue;
    toAdd.push({
      id,
      matches: [origin],
      js: contentScriptJs,
      runAt: "document_idle",
      persistAcrossSessions: true,
    });
  }
  if (toAdd.length > 0) {
    await chrome.scripting.registerContentScripts(toAdd);
  }
}
