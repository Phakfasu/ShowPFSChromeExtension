# Chrome Web Store Listing — ShowPFS v0.9.4 (客語 Pha̍k-fa-sṳ Annotator & Dictionary)

Copy these into the Developer Dashboard fields when submitting.

The **Title** and **Summary** fields are the canonical values in `manifest.json` and `package.json` — the Web Store form pre-fills them from the uploaded zip, so the strings below are reference copies, not a separate source of truth.

---

## Extension name (max 75 chars) — Title

Sourced from `manifest.json` → `name` (mirrors `package.json` → `name` semantically).

```
ShowPFS - 客語 Pha̍k-fa-sṳ Annotator & Dictionary
```

## Short description (max 132 chars) — Summary

Sourced from `manifest.json` → `description` and `package.json` → `description` (kept identical).

```
Annotates Hakfa MOE-pinyin with Pha̍k-fa-sṳ (白話字) readings, and shows a Hakfa dictionary popup on text selection.
```

## Category

**Productivity** (alternative: Accessibility, or Education)

## Language

English (primary). Mention Hakfa / Traditional Chinese support in the description.

---

## Detailed description (max 16,000 chars)

```
ShowPFS is a two-in-one reading aid for 客語 (Hakfa) on the web:

  1. ANNOTATOR — adds Pha̍k-fa-sṳ (白話字, PFS) readings next to Hakfa text written in the MOE Hakfa Phonetic System (教育部客家語拼音方案).
  2. DICTIONARY — pops up a built-in Hakkadict (教育部客家語辭典) entry whenever you select a Hakfa word, Hanji or Romanized.

Both features run entirely in your browser. No network requests, no telemetry.


1. ANNOTATOR

When you visit an allowed site, the extension scans the page, detects MOE-style Hakfa phrases, and appends a parenthetical with the corresponding PFS reading.

Examples:
  hiauˋ dedˋ    →  hiauˋ dedˋ (hiáu-tet)
  gaˊ           →  gaˊ (kâ)
  gonˊ ziinˊnaˇ →  gonˊ ziinˊnaˇ (kôn-chṳ̂n-nà)


2. DICTIONARY (selection-based lookup)

Select any Hakfa text on an allowed page — Hanji like 學得 or Romanized in any tone notation — and a small card appears next to the selection with the matching entry from the Ministry of Education Hakkadict (教育部客家語辭典) data: Si-yen / Nam Si-yen forms, PFS reading, KPPY pronunciation, gloss, and a sample sentence when available.

The dictionary index (~35,000 entries) is bundled into the extension and queried entirely locally. No lookup request ever leaves your browser.

You can also right-click a selection and choose "查客語辭典 (Hakfa Dictionary)" from the context menu to trigger the same card — handy on pages outside your annotation allowlist.


SUPPORTED TONE NOTATIONS

The MOE system appears in dictionaries in three different tone formats — all are detected automatically:
  • 調型: gaˊ, naˇ, hoˋ
  • 調號: ga1, na3, ho5
  • 調值: ga24, na31, ho55

Unmarked syllables (陰平 tone) are also detected and converted.


DIALECTS

Si-yen (四縣) and Nam Si-yen (南四縣) are both supported. When the two readings differ, both are shown separated by a slash.


DEFAULT ALLOWED ENTRIES

  • hakkadict.moe.edu.tw                          (教育部客家語辭典)
  • elearning.hakka.gov.tw/hakka/dictionary       (客家委員會 e-Learning 客語辭典)
  • elearning.hakka.gov.tw/hakka/cert/vocabulary  (客委會客語認證詞彙)
  • www.moedict.tw/:                              (萌典 — 臺灣客語 section only)

Entries are address prefixes — a URL is allowed when its host + path starts with the entry. The "/:" suffix on www.moedict.tw scopes annotation to the Hakka section.

You can add or remove entries from the popup. An on/off toggle lets you pause annotation site-wide without changing the allowlist.


PRIVACY

ShowPFS makes no network requests. Both the KPPY→PFS conversion and the dictionary lookup index run entirely in your browser from bundled data. Your allowlist is stored in chrome.storage.sync (Google account sync only — no third-party servers). No telemetry, no analytics, no tracking.


FONTS

NunitoPOJ (bundled for PFS display) is derived from the Nunito project and licensed under the SIL Open Font License, Version 1.1. The full license text is included with the extension (NunitoPOJ-OFL.txt). See https://scripts.sil.org/OFL for details.


OPEN SOURCE

  Extension:    https://github.com/Phakfasu/ShowPFSChromeExtension
  Conversion:   https://github.com/Phakfasu/KonvertToPFS
  Dictionary:   https://github.com/Phakfasu/HakkaDictMoeDataMirror

Bug reports and contributions welcome.


TERMINOLOGY

This extension follows the Phakfasu naming conventions: the language is "Hakfa" (Hak-fa), the writing system is called "Roman Orthography", and the two dialects covered are Si-yen and Nam Si-yen.
```

---

## Permission justifications

The Web Store form will ask why you need each permission. Paste these:

### `storage` permission

```
Used to persist the user's per-host allowlist (which sites the annotator runs on) and the on/off toggle state. Saved via chrome.storage.sync so settings sync across the user's own Chrome installs.
```

### `scripting` permission

```
Used to register a content script dynamically (chrome.scripting.registerContentScripts) when the user adds a custom host to the allowlist from the popup. Without this, user-added hosts couldn't be annotated without reinstalling the extension. Also used to inject the content script on-demand when the user triggers the "查客語辭典 (Hakfa Dictionary)" right-click menu on a page not otherwise covered by the allowlist.
```

### `contextMenus` permission

```
Used to add a "查客語辭典 (Hakfa Dictionary)" item to the right-click menu when text is selected. Clicking it opens the dictionary lookup card for the selected text against the bundled Hakkadict index. The menu item only appears in the "selection" context — never on plain page right-clicks.
```

### `activeTab` permission

```
Used by the right-click menu path to access the currently focused tab so the dictionary lookup card can be shown there. This grant is scoped to the tab the user just interacted with and is the standard MV3 mechanism for "do something with the page the user just right-clicked on".
```

### `host_permissions` (4 default entries only)

```
The extension ships with annotation enabled on the 4 default Hakfa dictionary entries:
  - hakkadict.moe.edu.tw                          (教育部客家語辭典)
  - elearning.hakka.gov.tw/hakka/dictionary       (客家委員會 e-Learning 客語辭典; path-restricted)
  - elearning.hakka.gov.tw/hakka/cert/vocabulary  (客委會客語認證詞彙; path-restricted)
  - www.moedict.tw/:                              (萌典 — 臺灣客語 section only; path-restricted)

These are the only origins the extension can access at install time.
```

### `optional_host_permissions: *://*/*`

```
Optional only. The popup lets the user extend annotation to additional dictionary sites at runtime. When the user adds a host, chrome.permissions.request() shows Chrome's native permission prompt for THAT specific origin — never for <all_urls>. If the user denies, the host isn't added.

The optional pattern `*://*/*` is the standard way to declare "the user may grant any origin" in MV3. Actual permissions are only ever granted per-origin via the native prompt; the extension cannot grant itself broader access.
```

### Remote code

```
None. All code and data are bundled. The KonvertToPFS Kotlin/JS conversion library and the Hakkadict dictionary index (src/data/dict-index.json, ~35,000 entries) ship with the extension and run locally. No code is fetched or evaluated at runtime; no lookup leaves the browser.
```

### Single purpose

```
Help users read Hakfa text on web pages by (a) annotating MOE-pinyin runs with Pha̍k-fa-sṳ readings and (b) showing the Hakkadict entry for any Hakfa word the user selects.
```

### Data usage disclosures

Tick: "Personally identifiable information" → **NO**
Tick: "Health information" → **NO**
Tick: "Financial and payment information" → **NO**
Tick: "Authentication information" → **NO**
Tick: "Personal communications" → **NO**
Tick: "Location" → **NO**
Tick: "Web history" → **NO**
Tick: "User activity" → **NO**
Tick: "Website content" → **NO** (the extension reads page text and the user's current selection in-place, but does not transmit them anywhere)

Certify:
  ☑ I do not sell or transfer user data to third parties, outside of approved use cases
  ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
  ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes


---

## Privacy policy URL

Hosted via GitHub Pages from `docs/` on `main`:

```
https://phakfasu.github.io/ShowPFSChromeExtension/PRIVACY.html
```

Source: [`docs/PRIVACY.md`](../docs/PRIVACY.md).

**One-time setup** — enable Pages on the repo:

  1. Go to `https://github.com/Phakfasu/ShowPFSChromeExtension/settings/pages`
  2. Source: **Deploy from a branch**
  3. Branch: **main**, Folder: **/docs**
  4. Save. First deploy takes ~1 minute. Confirm by visiting the URL above.


---

## Screenshots

The Web Store wants 1–5 screenshots, each 1280×800 or 640×400 PNG/JPG.

Suggested shots:

  1. A Hakkadict entry page with annotations visible — show "hiauˋ dedˋ" with "(hiáu-tet)" next to it
  2. The selection-lookup card popping up next to a Hanji selection (e.g. 學得) on a non-dictionary page
  3. The popup window in light mode, showing the allowlist + on/off toggle
  4. The popup window in dark mode (same content)
  5. An entry with the dialect-divergent display: "siyen / nam-siyen"


---

## Promo tile (optional but boosts visibility)

  • Small (required if you want featured placement): 440×280 PNG
  • Large: 920×680 PNG
  • Marquee: 1400×560 PNG

Theme suggestion: dark indigo background, large white "PFS" wordmark with a small "( hiáu-tet )" annotation underneath in the Iansui or NunitoPOJ font.


---

## Icons

Source SVG: `store/icons/icon.svg`. Rendered PNGs at `src/icons/icon-{16,32,48,128}.png` and `store/icons/store-icon-128.png` (referenced from the manifest).

To regenerate after editing the SVG:

```bash
npm run icons    # requires rsvg-convert (brew install librsvg)
```


---

## Submission checklist

Before clicking Submit:

  ☐ Version bumped in manifest.json + package.json
  ☐ `description` in manifest.json + package.json updated and kept in sync (this is the Summary)
  ☐ Privacy policy hosted at a stable URL
  ☐ 1–5 screenshots prepared at 1280×800 PNG
  ☐ npm run build:lib && npm run build && npm run zip
  ☐ Upload zip to https://chrome.google.com/webstore/devconsole
  ☐ Fill in description, category, language, permission justifications
  ☐ Submit for review (typical wait: 1–7 days)
