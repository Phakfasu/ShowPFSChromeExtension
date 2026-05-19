# GEMINI.md

This file provides architectural context and development guidelines for **ShowPFS** (Chrome Web Store title: *ShowPFS - 客語 Pha̍k-fa-sṳ Annotator & Dictionary*), a Chrome extension with two complementary features for reading Hakfa (客家話) on the web:

1. **Annotator** — finds Hakfa **KPPY** (教育部客家語拼音方案) runs on the page and appends a sibling `<span>` containing the corresponding **PFS** (Pha̍k-fa-sṳ / 白話字) reading.
2. **Dictionary** — when the user selects any Hakfa text (Hanji or Romanized), a closed-Shadow-DOM card pops up next to the selection with the matching entry from the MOE Hakkadict (教育部客家語辭典) open data.

Both features run entirely locally; neither makes a network request.

## Core Technologies
- **Frontend**: TypeScript, Vite, CRXJS (Vite plugin for Chrome Extensions).
- **Conversion Engine**: [KonvertToPFS](https://github.com/Phakfasu/KonvertToPFS) Kotlin/JS library, included as a git submodule at `lib/KonvertToPFS`.
- **Dictionary Data**: [HakkaDictMoeDataMirror](https://github.com/Phakfasu/HakkaDictMoeDataMirror) git submodule at `lib/HakkaDictMoeDataMirror`. The build script filters its CSV/JSON down to Si-yen + Nam Si-yen entries (~35k) and emits `src/data/dict-index.json` (~18MB, gitignored).
- **Styling**: Bundled NunitoPOJ font for PFS rendering — no Google Fonts, no CDN fetches at runtime.

## Architecture

### 1. Activation & Gating
- **Content Script (`src/content/content.ts`)**: The manifest `content_scripts.matches` lists specific host patterns for the four default allowlist entries. `optional_host_permissions: ["*://*/*"]` lets users grant additional sites at runtime via the popup without reinstalling. The service worker dynamically registers content scripts for user-granted origins via `chrome.scripting.registerContentScripts`. At runtime the content script performs two checks before activating: (1) the global enabled flag (`chrome.storage.sync` key `pfs.enabled`, defaults to `true`), and (2) whether `location.hostname + pathname` starts with an allowlist entry (`chrome.storage.sync` key `pfs.allowlist`). The runtime allowlist gate is the source of truth, not the manifest matches. URL changes are re-checked via patched `history.pushState/replaceState` + `popstate` so SPA navigations toggle activation correctly.
- **Service Worker (`src/background/service_worker.ts`)**: Initializes the default allowlist on install; creates the "查客語辭典 (Hakfa Dictionary)" context menu (selection context only); reconciles dynamic content-script registrations on `chrome.permissions.onAdded/onRemoved` and `onStartup`; routes context-menu clicks to the content script (and injects the content script on demand via `activeTab` for tabs not otherwise covered).
- **Popup (`src/popup/*`)**: On/off toggle + allowlist editor. Full dark mode via CSS custom properties + `prefers-color-scheme`.

### 2. Detection & Annotation
- **DOM Filters (`src/content/dom-filters.ts`)**: Shared helpers — `SKIP_SELECTOR`, `BLOCK_SELECTOR`, `isBlock`, `isSkipped`, `mayContainKppy`.
- **Walker (`src/content/walker.ts`)**: Iterates block-level elements under the scan root and runs a `MutationObserver` (childList + subtree + characterData) for dynamic/SPA content. The observer recognizes self-induced writes by `addedNodes` carrying the `pfs-pfs` class; `characterData` records are cheap-rejected when the changed text contains no tone-marker character.
- **Detector (`src/content/detector.ts`)**: Identifies KPPY runs seeded by a modifier-letter tone mark (`ˊ ˇ ˋ +`) or a trailing digit (調號 single-digit or 調值 multi-digit). Tags each run with a `KppyFormat` (`unicode` / `category` / `pitch`).
- **Annotator (`src/content/annotator.ts`)**: Builds a virtual string across the block's inline text nodes (stopping at nested blocks and the skip selector), runs the detector, and inserts a `<span class="pfs-pfs"> (PFS)</span>` after each detected run. Handles MOE Hakkadict-style HTML where tone marks live in their own `<sup>` elements, separated from the syllable letters.

### 3. Conversion Pipeline
- **Bridge (`src/converter/konverttopfs.ts`)**: Bridges the Kotlin/JS UMD bundle into the TypeScript environment via side-effect imports and `globalThis` access. Performs a self-test (`aˊ → â`, `gaˊ → kâ`) at load time; on failure sets `isHakfaConverterLoaded = false` so `content.ts` aborts annotation (the selection-lookup popup still activates — it doesn't depend on the converter).
- **Format Wrappers (`src/converter/siyen.ts`, `namSiyen.ts`)**: Thin format-aware wrappers around `convertHakfa(text, fromFmt, toFmt)`. The `KppyFormat` arg controls which converter format to use: `'unicode'` → `KPPY_UNICODE`; `'pitch'` → remap Chao pitch values to PFS-style 1–6 digits then `KPPY_INPUT`; `'category'` → remap official KPPY 調號 (八聲 slots) to PFS-style digits then `KPPY_INPUT`.
- **Dialect Support (`src/converter/index.ts`)**: `convertToPfsBothDialects` runs both **Si-yen** and **Nam Si-yen** dialects. `formatPfsText` collapses to a single string when they agree, else `"${siyen} / ${namSiyen}"`. v1 has `namSiyen` delegating to `siyen`; the dialect-divergent display path already exists for the day the lib gains Nam Si-yen rules.

### 4. Selection-based Dictionary Lookup
- **Selection popup (`src/content/selection-popup.ts`)**: Debounced (150 ms) `mouseup` / `keyup` / `pointerdown` / `keydown` listeners read `window.getSelection().toString()`, dispatch to `lookup()`, and on a hit mount a single `<div id="pfs-lookup-host">` with a **closed Shadow DOM** at `document.documentElement`. Dismissal: Esc, outside `pointerdown`, scroll, resize, new/cleared selection. The right-click context menu path (`triggerLookup`) takes the same code path on demand.
- **Renderer (`src/content/popup-view.ts`, `src/content/popup.css`)**: Pure-DOM (`createElement`/`createTextNode`) renderer for the lookup card, with `positionCard` anchoring next to the selection rect (flips above the line when there's no room below, clamps to viewport otherwise). The stylesheet is injected via `chrome.runtime.getURL` into the shadow root; critical positioning is inline so the card doesn't reflow when the stylesheet finishes loading.
- **Index loader (`src/lookup/dict-index.ts`)**: Single-flight `fetch(chrome.runtime.getURL("src/data/dict-index.json"))` on first lookup, cached for the page lifetime. Warmed eagerly by `installSelectionPopup` (fire-and-forget) so the first selection doesn't stall on the ~18MB JSON parse. `lookup()` probes the precise `keys` map and the `keysFolded` fallback so users selecting `pâu-sân` and `pau-san` both hit the same entry.
- **Normalization (`src/shared/normalize.mjs`)**: NFC + lowercase + collapsed whitespace/hyphens (precise key); same plus diacritics + KPPY-modifier-letter stripping (folded fallback). Plain ESM so the build script and runtime import the same module, keeping build-time keys and runtime queries in lockstep.
- **Index generation (`scripts/build-index.mjs`)**: Reads `lib/HakkaDictMoeDataMirror/public/<latest_version>/bunji/HakkaDictMoeData.json`, filters to Dialect ∈ {四縣腔, 南四縣腔}, strips heavy fields, and emits `src/data/dict-index.json` and `src/data/dict-version.json`. Runs as `prebuild` so a fresh `npm run build` always regenerates.

### The Submodule Bridge (`lib/KonvertToPFS`)

The lib supports seven `LomajiFormat` values: `PFS_INPUT`, `PFS_UNICODE`, `KPPY_INPUT`, `KPPY_UNICODE`, `FHL_DICT_INPUT`, `FHL_UNICODE`, `IPA`. This extension currently uses only the KPPY→PFS subset. `KPPY_INPUT` expects PFS-style 1–6 tone digits (NOT Chao pitch values or official KPPY 調號) — see the lib's documentation for the numbering warning.

The Kotlin facade (`@JsExport convertHakfa(text, from, to)`) is the contract between the two repos. If it changes, `src/converter/konverttopfs.ts` and the format wrappers need to follow.

## Commands & Development

### Setup
```bash
git submodule update --init --recursive   # populates lib/KonvertToPFS and lib/HakkaDictMoeDataMirror
npm install                                # one-time
```

### Build Pipeline
```bash
npm run build:lib    # Gradle build inside lib/KonvertToPFS (requires JDK 17+)
npm run build:index  # filter HakkaDictMoeDataMirror → src/data/dict-index.json (auto-runs as prebuild)
npm run typecheck    # tsc --noEmit
npm run build        # vite build → dist/ (Manifest V3 unpacked extension)
npm run zip          # package dist/ → showpfs-v{version}.zip for Web Store upload
npm run icons        # regenerate icon PNGs from store/icons/icon.svg (requires rsvg-convert)
npm run dev          # vite + HMR for popup
```

### Version Bump & Release
Update `version` in both `manifest.json` and `package.json`; keep `description` in both files identical (this is the Chrome Web Store "Summary"). Rebuild with `npm run build`, then run `npm run zip` to produce a fresh zip.

### Bumping a Submodule
```bash
cd lib/<KonvertToPFS|HakkaDictMoeDataMirror> && git pull
# then from the parent repo: commit the updated submodule SHA
```

### Deployment
Load the **`dist/`** directory (not the root) in Chrome via `chrome://extensions` → **Load unpacked**.

## Manifest Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | `chrome.storage.sync` for `pfs.allowlist` and `pfs.enabled`. |
| `scripting` | `chrome.scripting.registerContentScripts` for user-added hosts; `executeScript` for the right-click menu fallback. |
| `contextMenus` | Adds "查客語辭典 (Hakfa Dictionary)" to the right-click menu in `selection` context only. |
| `activeTab` | Lets the right-click menu inject the content script into the focused tab on demand. |
| `host_permissions` | Four default Hakfa dictionary entries (see allowlist below). |
| `optional_host_permissions: *://*/*` | User-driven per-origin grants via `chrome.permissions.request()`. |

## Key Storage Keys

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `pfs.enabled` | `boolean` | `true` | Global on/off switch for annotation |
| `pfs.allowlist` | `string[]` | `DEFAULT_ALLOWLIST` | Address prefixes where annotation and selection lookup are active |

Default allowlist (`src/shared/allowlist.ts`):

- `hakkadict.moe.edu.tw`
- `elearning.hakka.gov.tw/hakka/dictionary`
- `elearning.hakka.gov.tw/hakka/cert/vocabulary`
- `www.moedict.tw/:`

## Terminology & Conventions

Follow the **Phakfasu organization** naming conventions:
- **Language**: Use **Hakfa** (or **Hak-fa**). Avoid "Hakka Chinese" or "Taiwanese Hakka".
- **Script**: Use **Roman Orthography** (or "Roman-script Orthography"). Avoid "Romanization".
- **Dialects**: **Si-yen** (四縣) and **Nam Si-yen** (南四縣).
- **Systems**: **KPPY** (MOE) and **PFS** (Pha̍k-fa-sṳ).
- **Tone Display**: Refer to **調型** (modifier-letter diacritics), **調號** (八聲 category: 1,2,3,4,5,8), and **調值** (Chao pitch, multi-digit).

## Testing
- **Converter Logic**: Owned by the `lib/KonvertToPFS` submodule. Run `cd lib/KonvertToPFS && ./gradlew :lib:jsBrowserTest`.
- **Integration**: Currently verified manually — load the extension, visit a Hakkadict entry page (annotation), then select Hanji on a non-dictionary page (selection lookup).
