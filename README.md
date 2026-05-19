# ShowPFS

**A Chrome extension that annotates Hakfa KPPY text on web pages with the PFS reading, and shows a Hakkadict entry popup whenever you select a Hakfa word.**

Hakfa (客家話) is written in two competing Roman orthographies: **KPPY** (教育部客家語拼音方案, the MOE system) and **PFS** (Pha̍k-fa-sṳ / 白話字, the Presbyterian system). MOE dictionaries publish only KPPY; readers familiar with PFS have to translate every entry in their head. ShowPFS does the translation for you, in place — and now also surfaces the full MOE Hakkadict entry for any Hakfa text you select.

```
hiauˋ dedˋ          →  hiauˋ dedˋ (hiáu-tet)
gonˊ ziinˊnaˇ       →  gonˊ ziinˊnaˇ (kôn-chṳ̂n-nà)
tai kin             →  tai kin (thai-khin)        ← unmarked tones recognized
ga24 na31 ho55      →  ga24 na31 ho55 (kâ-nà-hò)  ← 調值 Chao pitch
```

```
[ 學得 ]   ← user selects Hanji
  └─► popup: 四縣  學得  hók-tet   to learn, to be able to ...
```

The PFS parenthetical renders in the bundled **NunitoPOJ** font (licensed under the [SIL Open Font License 1.1](https://scripts.sil.org/OFL)). All assets ship inside the extension — no Google Fonts, no CDN, no network requests of any kind. The dictionary index (~35,000 entries, derived from the Ministry of Education open Hakkadict data) is bundled too — lookups never leave your browser.

---

## Install

**From the Chrome Web Store** — *coming soon* (submission in progress; see [`store/store-listing.md`](store/store-listing.md)).

**From source** — see [Build from source](#build-from-source) below, then in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the **`dist/`** directory (not the project root)

---

## Features

### 1. In-place KPPY → PFS annotation
The content script walks the DOM, detects Hakfa MOE-pinyin runs (modifier-letter tones `ˊ ˇ ˋ`, 調號 1–8, or 調值 Chao pitch), and appends a sibling `<span> (PFS)</span>` after each run. Re-walks on DOM mutations and SPA URL changes.

### 2. Selection-based dictionary lookup
Select any Hakfa text — Hanji like `學得` or any Romanized form (`hók-tet`, `hok-tet`, `hók tet`, `hok8 tet4` …) — and a closed-Shadow-DOM card pops up next to the selection with the matching Hakkadict entries. Shows Si-yen and Nam Si-yen variants, PFS reading, KPPY pronunciation, gloss, and a sample sentence when available, plus a link out to the source entry. Dismisses on Esc, outside click, scroll, resize, or new selection.

You can also right-click a selection and pick **查客語辭典 (Hakfa Dictionary)** from the context menu — useful on pages outside the annotation allowlist.

---

## Usage

Click the toolbar icon to open the popup:

- **On/off toggle** — pauses annotation globally without changing your allowlist
- **Entry list** — address prefixes where the annotator (and the selection-lookup popup) are active
- **Add field** — paste a hostname or `host/path` prefix (with or without `https://`). A URL is allowed when `hostname + pathname` starts with the entry, so `www.moedict.tw/:` only annotates the Hakka section of Moedict.
- **Reset to defaults** — restores the default dictionary entries

The extension does nothing on URLs not matched by the allowlist — it never reads or modifies pages you haven't approved. The right-click "查客語辭典" menu is the one exception: it runs on the active tab via the `activeTab` grant when you explicitly invoke it.

Default allowlist:

| Entry | Site |
|---|---|
| `hakkadict.moe.edu.tw` | 教育部客家語辭典 |
| `elearning.hakka.gov.tw/hakka/dictionary` | 客家委員會 e-Learning 客語辭典 (path-restricted) |
| `elearning.hakka.gov.tw/hakka/cert/vocabulary` | 客委會客語認證詞彙 (path-restricted) |
| `www.moedict.tw/:` | 萌典 — 臺灣客語 (path-restricted) |

Settings sync across your Chrome installs via `chrome.storage.sync` (no third-party servers — this is Google's standard sync mechanism, scoped to your own account).

---

## What it detects

KPPY appears in dictionaries in three different tone notations — all three are detected automatically:

| Notation | Form | Example | Internal format |
|---|---|---|---|
| 調型 | modifier letters | `gaˊ naˇ hoˋ` | `KPPY_UNICODE` |
| 調號 | 八聲 single digits (1–8) | `ga1 na3 ho5` | remapped → `KPPY_INPUT` |
| 調值 | Chao pitch (multi-digit) | `ga24 na31 ho55` | remapped → `KPPY_INPUT` |

**Unmarked syllables** (陰平 in Si-yen — no modifier letter, no digit) are also recognized when the bundled converter confirms they form valid Hakfa syllables. Bare tone symbols on their own (e.g. a lone `ˇ` in a `<sup>`) are excluded so they don't seed false runs.

### Dialects

Every annotation is computed for both **Si-yen (四縣)** and **Nam Si-yen (南四縣)**. When the two outputs agree (the common case — KPPY/PFS encode tone *categories*, not surface pitch) the span shows a single reading. When they diverge, it shows `si-yen / nam-form`.

v1 wires the pipeline but uses the Si-yen converter for both paths; the Nam Si-yen-specific rhyme and lexical splits are tracked in `src/converter/namSiyen.ts` and need upstream lib work in the [KonvertToPFS](https://github.com/Phakfasu/KonvertToPFS) submodule.

---

## How it works

Four thin layers, top-down:

1. **Activation gate** — content script bails immediately unless `pfs.enabled` is true and the current URL is on the user's allowlist. The manifest declares `host_permissions` for the four default dictionary entries and `optional_host_permissions: *://*/*` so users can grant additional sites on demand via the popup. The service worker mirrors user-granted origins into dynamic content-script registrations via `chrome.scripting.registerContentScripts()`.

2. **Detection + annotation** — a per-block `MutationObserver` re-walks each block when it changes. The annotator collects inline text-node descendants of the block into a virtual string (inserting a synthetic space when a tone mark sits in a different inline wrapper than the next syllable's letters, e.g. `</sup>na`), runs the detector against that virtual string, and inserts a sibling `<span class="pfs-pfs">` after each detected run.

3. **Conversion** — runs go through the **KonvertToPFS** Kotlin/JS library (a git submodule, bundled into the extension) which handles syllable parsing, tone mapping, and PFS rendering. The bridge runs a self-test (`aˊ → â`, `gaˊ → kâ`) at load time and disables annotation entirely if the library fails to load. (The selection-lookup popup does not depend on the converter — it reads pre-computed PFS from the bundled index — so it still works even if conversion is disabled.)

4. **Selection lookup** — a debounced `mouseup`/`keyup` listener takes the current selection, normalizes it (NFC + lowercase + collapsed whitespace/hyphens, with a folded fallback that strips diacritics and KPPY modifier letters), and probes a bundled dictionary index. Results render into a closed Shadow DOM anchored at the selection rect. The index lives at `src/data/dict-index.json` (~18 MB, derived at build time from the `lib/HakkaDictMoeDataMirror` submodule).

---

## Build from source

Requires Node 18+, npm, and JDK 17+ (for the Kotlin/JS converter library).

```bash
git submodule update --init --recursive
npm install
npm run build:lib    # Gradle → lib/KonvertToPFS/lib/build/dist/js/productionLibrary/
npm run build:index  # (runs automatically as `prebuild`) → src/data/dict-index.json
npm run typecheck    # tsc --noEmit
npm run build        # Vite → dist/ (unpacked MV3 extension)
npm run zip          # package dist/ → showpfs-v{version}.zip for Web Store upload
npm run icons        # regenerate icon PNGs from store/icons/icon.svg (requires rsvg-convert)
```

Dev loop:

```bash
npm run dev          # Vite HMR for the popup; manifest changes trigger a full reload
```

Bumping the converter library or the dictionary mirror:

```bash
cd lib/KonvertToPFS && git pull            # or lib/HakkaDictMoeDataMirror
cd ../.. && git add lib/<NAME> && git commit -m "Bump <NAME>"
npm run build:lib && npm run build          # build:index reruns automatically
```

Converter correctness is owned by the submodule's commonTest suite:

```bash
cd lib/KonvertToPFS && ./gradlew :lib:jsBrowserTest
```

---

## Code layout

| Path | Role |
|---|---|
| `manifest.json` | MV3 manifest. Four default `host_permissions` + `optional_host_permissions`. Permissions: `storage`, `scripting`, `contextMenus`, `activeTab`. Content script at `document_idle`. |
| `src/content/content.ts` | Entry: checks `pfs.enabled` and the allowlist, injects styles, starts the walker, and installs the selection-lookup popup. Bails out of annotation if the converter failed its self-test, but the lookup popup still activates. |
| `src/content/walker.ts` | Block-level enumeration + `MutationObserver` (childList + subtree + characterData). Cheap-rejects characterData mutations with no Latin letters. |
| `src/content/annotator.ts` | Virtual-string builder with cross-element synthetic separator, run-to-DOM mapper, idempotent annotation insertion. Walks past `<sup>/<sub>` wrappers so the parenthetical isn't superscripted. |
| `src/content/detector.ts` | Run detection. Tags each run with a `KppyFormat` (`unicode` / `category` / `pitch`). Token-level cache to avoid re-crossing the JS/Kotlin boundary. |
| `src/content/dom-filters.ts` | Shared selectors and the `mayContainKppy` pre-filter. |
| `src/content/selection-popup.ts` | Selection / right-click → debounced lookup → closed-Shadow-DOM card. Esc / outside-click / scroll / resize dismiss. |
| `src/content/popup-view.ts` | Pure-DOM renderer for the lookup card. Anchors the card next to the selection rect via `positionCard`. |
| `src/content/popup.css` | Stylesheet for the lookup card (loaded into the shadow root). |
| `src/lookup/dict-index.ts` | Single-flight fetch + cache for `src/data/dict-index.json`. `lookup()` probes the precise and folded key maps. |
| `src/lookup/types.ts` | Index schema. |
| `src/shared/normalize.mjs` | NFC + lowercase + whitespace/hyphen collapse, plus a folded form that strips diacritics. Shared between build-time index generation and runtime lookup. |
| `src/converter/konverttopfs.ts` | Bridge to the Kotlin/JS UMD bundle. Side-effect imports + `globalThis` lookup. Self-tests; falls back to a passthrough and disables annotation if the lib fails. |
| `src/converter/siyen.ts` | Si-yen wrapper. Maps KPPY 調號 / 調值 → the lib's PFS-style 1–6 digits before calling `convertHakfa`. |
| `src/converter/namSiyen.ts` | Nam Si-yen wrapper. v1 stub — delegates to Si-yen until the lib gains Nam Si-yen rules. |
| `src/converter/index.ts` | Runs both dialects; collapses output when equal. |
| `src/background/service_worker.ts` | Seeds the default allowlist on install; creates the "查客語辭典 (Hakfa Dictionary)" context menu; reconciles dynamic content script registrations via `chrome.permissions` listeners. |
| `src/popup/*` | Allowlist editor + on/off toggle. Full dark-mode support via CSS custom properties + `prefers-color-scheme`. |
| `src/shared/allowlist.ts` | `chrome.storage.sync` helpers and `isAllowed`. |
| `src/shared/constants.ts` | Storage keys and the `pfs-pfs` CSS class. |
| `src/fonts/` | Bundled NunitoPOJ font files (SIL Open Font License 1.1). |
| `src/data/dict-index.json` | Generated. Bundled Hakkadict index — gitignored. |
| `lib/KonvertToPFS/` | KonvertToPFS Kotlin/JS library (git submodule). Build with `npm run build:lib`. |
| `lib/HakkaDictMoeDataMirror/` | MOE Hakkadict open-data mirror (git submodule). Source for `dict-index.json`. |
| `store/` | Chrome Web Store submission assets (listing copy, privacy policy, source SVG for icons). |

---

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist the allowlist and on/off toggle (`chrome.storage.sync`). |
| `scripting` | Register dynamic content scripts for user-added hosts; inject on-demand for the right-click menu. |
| `contextMenus` | Add the "查客語辭典 (Hakfa Dictionary)" item to the selection-context menu. |
| `activeTab` | Let the right-click menu act on the focused tab. |
| `optional_host_permissions: *://*/*` | Lets the popup ask Chrome for permission to add custom sites at runtime. Each origin requires its own native Chrome prompt. |

---

## Privacy

ShowPFS makes **no network requests**. Conversion and dictionary lookups run entirely in your browser from bundled assets. The only stored state is your allowlist and on/off toggle, kept in `chrome.storage.sync` (your Google account, not ours).

Full policy: <https://phakfasu.github.io/ShowPFSChromeExtension/PRIVACY.html> (source: [`docs/PRIVACY.md`](docs/PRIVACY.md)).

---

## Terminology

This project follows the [Phakfasu](https://github.com/Phakfasu) naming conventions:

- The language is **Hakfa** (or **Hak-fa**) — not "Hakka Chinese" or "Taiwanese Hakka"
- The writing system is **Roman Orthography** — not "Romanization"
- Dialect names are **Si-yen** (四縣) and **Nam Si-yen** (南四縣) — not "Sixian" / "Nan-Sixian"
- Orthography systems: **KPPY** (MOE) and **PFS** (Pha̍k-fa-sṳ / 白話字)

---

## Contributing

Issues and pull requests welcome at the project repo. For converter changes, file the issue against the upstream library at [Phakfasu/KonvertToPFS](https://github.com/Phakfasu/KonvertToPFS) — this repo only handles the DOM walker, detector, popup, and selection lookup. For dictionary data issues, file against [Phakfasu/HakkaDictMoeDataMirror](https://github.com/Phakfasu/HakkaDictMoeDataMirror).

When bumping a submodule, run the full build chain (`npm run build:lib && npm run typecheck && npm run build`) and verify on a Hakkadict entry page (annotation) plus a selection on a non-dictionary page (lookup) before committing the new SHA.
