# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
git submodule update --init --recursive   # one-time, populates lib/KonvertToPFS and lib/HakkaDictMoeDataMirror
npm install                                # one-time
npm run build:lib                          # Gradle build inside lib/KonvertToPFS — produces lib/KonvertToPFS/lib/build/dist/js/productionLibrary/
npm run build:index                        # generate src/data/dict-index.json from lib/HakkaDictMoeDataMirror (auto-runs as `prebuild`)
npm run typecheck                          # tsc --noEmit
npm run build                              # vite build → dist/ (Manifest V3 unpacked extension); `prebuild` regenerates the index
npm run zip                                # package dist/ → showpfs-v{version}.zip for Web Store upload
npm run icons                              # regenerate src/icons/*.png + store/icons/store-icon-128.png from store/icons/icon.svg (requires rsvg-convert)
npm run dev                                # vite + HMR for popup
```

After `npm run build`, load `dist/` via `chrome://extensions` → Developer mode → **Load unpacked**.

When bumping the version: update `version` in both `manifest.json` and `package.json`, rebuild with `npm run build`, then run `npm run zip` to produce a fresh zip for Chrome Web Store submission.

The `lib/KonvertToPFS` git submodule pins the upstream KonvertToPFS Kotlin/JS library. The `lib/HakkaDictMoeDataMirror` submodule pins the upstream MOE Hakkadict data mirror (Si-yen + Nam Si-yen merged CSV/JSON at `public/<version>/bunji/HakkaDictMoeData.{csv,json}`, ~31MB JSON, ~35k entries with 詞目/KPPY/PFS/釋義/例句 columns). To bump either pin: `cd lib/<NAME> && git pull`, then commit the updated submodule SHA from the parent repo.

Converter correctness is owned by `lib/KonvertToPFS/lib/src/commonTest/` and exercised via `cd lib/KonvertToPFS && ./gradlew :lib:jsBrowserTest`. No JS-side unit-test runner is wired in this repo.

## Architecture

Two-feature MV3 Chrome extension. **(1) Annotation**: walks the DOM, finds Hakfa **KPPY** (教育部客家語拼音方案) phrases, and appends a sibling `<span class="pfs-pfs"> (PFS)</span>` after each run. The PFS reading is computed via the **KonvertToPFS Kotlin/JS library** imported directly from the `lib/KonvertToPFS` git submodule, not a TS port. **(2) Selection lookup**: when the user selects any text (Hanji or any Lomaji format), a closed-shadow-DOM popup near the selection shows the matching entry from the **MOE Hakkadict data mirror** (`lib/HakkaDictMoeDataMirror` submodule). Both features share the same per-origin opt-in via `optional_host_permissions` + the popup-driven allowlist — no upfront `<all_urls>` warning.

### Three layers, top-down

1. **Activation gate** (`src/content/content.ts` + `src/shared/allowlist.ts`)
   - The manifest declares `host_permissions` for the default allowlist entries and `optional_host_permissions: ["*://*/*"]` so users can grant additional sites on demand. Allowlist entries are **address prefixes** — a bare host (`hakkadict.moe.edu.tw`) or `host/path-prefix` (`www.moedict.tw/:` scopes Moedict to its Taiwan Hakka section). `entryMatchPattern` in `src/shared/allowlist.ts` converts entries to chrome match patterns: bare hosts → `*://host/*`, path entries → `*://host/path*`. Content scripts are statically registered only for the default entries; user-added entries get dynamic registration via `chrome.scripting.registerContentScripts()` in the service worker. The content script re-checks `isAllowed(location, allowlist)` (matches when `hostname + pathname` starts with an entry) on every SPA URL change — `content.ts` patches `history.pushState/replaceState` and listens for `popstate` because match patterns are evaluated only at injection time.
   - The background service worker (`src/background/service_worker.ts`) seeds `DEFAULT_ALLOWLIST` on first install, listens for `chrome.permissions.onAdded/onRemoved` to reconcile dynamic content script registrations, and re-registers on `onStartup`. The popup (`src/popup/*`) reads/writes the same allowlist key and calls `chrome.permissions.request()`/`chrome.permissions.remove()` to manage per-site grants.

2. **Detection + annotation** (`src/content/walker.ts` → `annotator.ts` → `detector.ts`, with shared helpers in `dom-filters.ts`)
   - `walker.ts` enumerates block-level elements (`p, div, li, td, …`) under the scan root and hands each to `annotateBlock`. A `MutationObserver(childList + subtree + characterData)` re-queues the nearest block ancestor of any non-self-induced mutation; `characterData` records are cheap-rejected when the changed text contains no tone-marker character.
   - `annotator.ts:annotateBlock` collects inline text-node descendants of the block (stopping at nested blocks and at the skip selector — `script/style/noscript/textarea/input/code/pre/kbd/samp/ruby/rt/rp` plus our own `.pfs-pfs`), concatenates them into a virtual string with an offset map, runs the detector on the virtual string, and for each detected run inserts a `<span class="pfs-pfs"> (PFS)</span>` immediately after the text node containing the run's last character (splitting that text node if the run ends mid-node). This handles MOE Hakkadict-style HTML where tone marks live in their own `<sup>` elements, separate from the syllable letters.
   - `detector.ts` finds KPPY-shaped *runs* in a virtual string. A run is seeded by a token carrying a KPPY tone marker — modifier letter `ˊ ˇ ˋ`, the `+` modifier used by some non-Si-yen dialects, or a trailing digit (調號 single-digit or 調值 multi-digit). Once seeded, the run extends over adjacent tokens separated by space / NBSP / hyphen that the bundled converter recognizes as Hakfa syllables. Each run is tagged with a `KppyFormat` (`'unicode' | 'category' | 'pitch'`) inferred from the seed shape, so the converter knows whether to decode it as 調型 / 調號 / 調值.
   - Idempotency: text inside `.pfs-pfs` is in the skip selector, so a re-walk after annotation finds nothing to re-do; `insertAnnotation` also checks the next sibling for an existing `.pfs-pfs` span before appending. The `MutationObserver` recognizes self-induced writes by `addedNodes` carrying the `pfs-pfs` class.

3. **Selection lookup** (`src/content/selection-popup.ts` + `src/content/popup-view.ts` + `src/lookup/dict-index.ts`)
   - `selection-popup.ts:installSelectionPopup` is installed alongside `startObserving` in `content.ts:syncToCurrentUrl` (so it activates on the same per-origin gate as annotation). It listens for `mouseup`/`keyup`/`pointerdown`/`keydown` with a 150ms debounce, takes the trimmed `window.getSelection().toString()`, and calls `lookup()` from `dict-index.ts`. On a hit it mounts a single `<div id="pfs-lookup-host">` with a **closed Shadow DOM**, links `popup.css` via `chrome.runtime.getURL`, and renders the entry via `popup-view.ts:renderPopup` (pure `createElement`/`createTextNode` — same safe-DOM discipline as `annotator.ts`). Dismissal: Esc keydown, outside `pointerdown`, scroll, resize, or new/cleared selection.
   - `lookup/dict-index.ts` single-flight-loads `src/data/dict-index.json` (a `web_accessible_resource`) on first lookup, caches it for the page lifetime. `loadDictIndex()` is also warmed eagerly by `installSelectionPopup` (fire-and-forget) so the first selection doesn't stall on the 18MB JSON parse. `lookup()` probes both the precise `keys` map (NFC + lowercase + collapsed whitespace/hyphens) and the `keysFolded` fallback (diacritics + KPPY modifier letters stripped) so users selecting `pâu-sân` or `pau-san` both hit the same entry.
   - The index is regenerated at build time (`prebuild` → `scripts/build-index.mjs`) from `lib/HakkaDictMoeDataMirror/public/<latest_version>/bunji/HakkaDictMoeData.json`. The script reads `latest_version` from the submodule's `public/manifest.json`, filters to Dialect ∈ {四縣腔, 南四縣腔}, strips heavy fields (詞目索引, 對應音檔名稱, 方言點, 詞性, 相似詞, 相反詞), and emits `src/data/dict-index.json` (~18MB raw, ~5.7MB gzipped, 35,901 entries, ~91k precise keys, ~86k folded keys) and `src/data/dict-version.json`. Both files are **gitignored** — they are derived artifacts, regenerated from the pinned submodule on every `npm run build`.
   - Normalization rules are defined once in `src/shared/normalize.mjs` (plain ESM so Node can import it directly; companion `normalize.d.mts` provides TS types for the content script). Both the build script and the runtime import the same module, so keys generated at build time and queried at runtime stay in lockstep.

4. **Conversion pipeline** (`src/converter/` + the `lib/KonvertToPFS` submodule)
   - `src/converter/konverttopfs.ts` is the bridge: side-effect imports of `lib/KonvertToPFS/lib/build/dist/js/productionLibrary/{kotlin-kotlin-stdlib,KonvertToPFS-lib}.js`, then reads `globalThis["org.phakfasu:lib"].org.phakfasu.konverttopfs.convertHakfa` and runs a self-test (`aˊ → â`, `gaˊ → kâ`) before re-exporting. On failure it rebinds `convertHakfa` to a passthrough that logs once and sets `isHakfaConverterLoaded` to `false`; `content.ts:main()` aborts annotation when that flag is false so a broken submodule build never produces `(kppy)`-shaped annotations.
   - `siyen.ts` / `namSiyen.ts` are thin format-aware wrappers around `convertHakfa(text, fromFmt, toFmt)`. The `KppyFormat` arg controls which converter format to use: `'unicode'` → `KPPY_UNICODE`; `'pitch'` → remap Chao pitch values (`24→1, 11→2, 31→3, 55→4, 5→5, 2→6`) to the lib's PFS-style 1–6 digits, then `KPPY_INPUT`; `'category'` → remap official KPPY 調號 (八聲 slots `1→1, 2→3, 3→4, 4→6, 5→2, 8→5`) to the lib's digits, then `KPPY_INPUT`. The lib's `KPPY_INPUT` parser accepts only single digits 1–6 — never Chao pitch values directly.
   - `index.ts:convertToPfsBothDialects` runs both dialects and returns `{ siyen, namSiyen }`. `formatPfsText` collapses to a single string when they agree, else `"${siyen} / ${namSiyen}"`. v1 has `namSiyen` delegating to `siyen`; the dialect-divergent display path already exists for the day the lib gains Nam Si-yen rules.

### The submodule bridge (`lib/KonvertToPFS`)

`lib/KonvertToPFS/lib/build.gradle.kts` is configured with `binaries.library()` + `generateTypeScriptDefinitions()`, and `lib/KonvertToPFS/lib/src/jsMain/kotlin/.../JsApi.kt` exposes a `@JsExport` facade `convertHakfa(text, from, to)` that takes string format names. The output is a **UMD bundle**, which Rollup can't tree-shake for named exports — that's why `konverttopfs.ts` uses side-effect imports and reads the converter off `globalThis`.

The lib supports seven `LomajiFormat` values: `PFS_INPUT`, `PFS_UNICODE`, `KPPY_INPUT`, `KPPY_UNICODE`, `FHL_DICT_INPUT`, `FHL_UNICODE`, `IPA`. This extension currently uses only the KPPY→PFS subset. `KPPY_INPUT` expects PFS-style 1–6 tone digits (NOT Chao pitch values or official KPPY 調號) — see the lib's `CLAUDE.md` §Tone systems for the numbering warning.

The Kotlin facade is the contract between the two repos. If it changes, `src/converter/konverttopfs.ts` and the format wrappers in `src/converter/{siyen,namSiyen}.ts` need to follow.

### Terminology (Phakfasu org convention)

- The language is **Hakfa** (or **Hak-fa**), not "Hakka Chinese" / "Taiwanese Hakka".
- Romanization is called **Roman Orthography**, not "Romanization".
- Dialect names: **Si-yen** (四縣) and **Nam Si-yen** (南四縣) — not "Sixian" / "Nan-Sixian".
- Orthography systems: **KPPY** (MOE) and **PFS** (Pha̍k-fa-sṳ / 白話字).
- MOE Hakkadict displays tones three ways: **調型** (modifier-letter diacritics), **調號** (八聲 category, 1–8), **調值** (Chao pitch, multi-digit).

### File-layout pointers (not exhaustive — discoverable)

- `manifest.json` — MV3, four default `host_permissions` + `optional_host_permissions: ["*://*/*"]`, content script at `document_idle`. `web_accessible_resources` uses `<all_urls>` matches (required because user-added origins also need CSS/font/data access) with `use_dynamic_url: true` to mitigate fingerprinting.
- `vite.config.ts` — `@crxjs/vite-plugin` wired off the manifest JSON.
- `src/shared/constants.ts` — single source for the `pfs-pfs` CSS class and the `chrome.storage.sync` key.
- `src/content/styles.css` — pulls Iansui from Google Fonts and styles `.pfs-pfs` (font-size/weight inherit from the surrounding KPPY text); injected by `content.ts` via `chrome.runtime.getURL`.
- `src/content/dom-filters.ts` — shared `SKIP_SELECTOR`, `BLOCK_SELECTOR`, `isBlock`, `isSkipped`, `mayContainKppy` helpers. Site-specific dialect filtering restricts annotation to Si-yen (四縣) and Nam Si-yen (南四縣) on all three default allowlist sites:
     - **hakkadict.moe.edu.tw**: detail-page tab panels `#item2`–`#item5`, search-list `.accent-data[data-accent-id]` not `"1"`/`"6"`, 每日一詞 badge not `四`/`南`, appendix table columns whose `<th>` is 海陸腔/大埔腔/饒平腔/詔安腔 (cached per table via `WeakMap`).
     - **elearning.hakka.gov.tw**: pronunciation blocks inside `.d-flex` containers whose `.dialect` label is not 四縣腔/南四縣腔.
     - **www.moedict.tw**: pronunciation `<span>`s preceded by `.audioBlock` elements whose badge character is not `四`/`南` (Moedict replaces Unicode superscript digits with `<sup>` HTML, so the detector fires on all dialects).
