import {
  DEFAULT_ALLOWLIST,
  entryMatchPattern,
  isDefaultEntry,
  loadAllowlist,
  loadEnabled,
  saveAllowlist,
  saveEnabled,
} from "../shared/allowlist";

const listEl = document.getElementById("list") as HTMLUListElement;
const formEl = document.getElementById("add-form") as HTMLFormElement;
const inputEl = document.getElementById("add-input") as HTMLInputElement;
const resetEl = document.getElementById("reset") as HTMLButtonElement;
const toggleEl = document.getElementById("enabled-toggle") as HTMLInputElement;

async function render(): Promise<void> {
  const items = await loadAllowlist();
  const granted = await chrome.permissions.getAll();
  const grantedOrigins = new Set(granted.origins ?? []);
  listEl.replaceChildren();
  for (const entry of items) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = entry;

    // An entry can appear in the allowlist without a matching permission when
    // chrome.storage.sync syncs an entry from another device (permissions
    // aren't synced). Surface that so users can re-grant.
    if (!grantedOrigins.has(entryMatchPattern(entry)) && !isDefaultEntry(entry)) {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "needs-grant";
      badge.textContent = "Grant access";
      badge.title = `This device hasn't granted access to ${entry}. Click to grant.`;
      badge.addEventListener("click", async () => {
        const ok = await chrome.permissions.request({
          origins: [entryMatchPattern(entry)],
        });
        if (ok) await render();
      });
      li.append(span, badge);
    } else {
      li.append(span);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `Remove ${entry}`;
    remove.addEventListener("click", async () => {
      await removeEntry(entry);
      await render();
    });
    li.append(remove);
    listEl.append(li);
  }
}

function sanitizeEntryInput(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^\*\.?/, "");
  const slash = s.indexOf("/");
  if (slash === -1) return s.toLowerCase();
  // Lowercase the host but preserve path case (URL paths are case-sensitive).
  return s.slice(0, slash).toLowerCase() + s.slice(slash);
}

async function addEntry(entry: string): Promise<boolean> {
  const current = await loadAllowlist();
  if (current.includes(entry)) return true;

  // Default entries are baked into manifest host_permissions — no request needed.
  if (!isDefaultEntry(entry)) {
    const granted = await chrome.permissions.request({
      origins: [entryMatchPattern(entry)],
    });
    if (!granted) return false;
  }
  await saveAllowlist([...current, entry]);
  return true;
}

async function removeEntry(entry: string): Promise<void> {
  const current = await loadAllowlist();
  await saveAllowlist(current.filter((e) => e !== entry));
  if (!isDefaultEntry(entry)) {
    await chrome.permissions.remove({ origins: [entryMatchPattern(entry)] });
  }
}

toggleEl.addEventListener("change", async () => {
  await saveEnabled(toggleEl.checked);
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const entry = sanitizeEntryInput(inputEl.value);
  if (!entry) return;
  const ok = await addEntry(entry);
  if (ok) inputEl.value = "";
  await render();
});

resetEl.addEventListener("click", async () => {
  const current = await loadAllowlist();
  const toRevoke = current.filter((e) => !isDefaultEntry(e));
  if (toRevoke.length > 0) {
    await chrome.permissions.remove({
      origins: toRevoke.map(entryMatchPattern),
    });
  }
  await saveAllowlist([...DEFAULT_ALLOWLIST]);
  await render();
});

async function init(): Promise<void> {
  toggleEl.checked = await loadEnabled();
  await render();
}

void init();
