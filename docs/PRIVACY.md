---
title: Privacy Policy
---

# ShowPFS Privacy Policy

_Last updated: 2026-05-20_

## Summary

**ShowPFS does not collect, transmit, or sell any user data.** All conversion and all dictionary lookups run locally in your browser. The extension's only stored state is your allowlist of permitted hosts and the on/off toggle setting, which are saved via `chrome.storage.sync` so they sync across your own Chrome installations.

## What the extension reads

When you visit a page on a host you have added to the allowlist (defaults below), ShowPFS reads the visible text content of the page in order to detect KPPY (Hakfa Roman Orthography) phrases and append PFS readings next to them. Additionally, when you select any text on such a page (or right-click a selection and choose "查客語辭典 (Hakfa Dictionary)"), the extension reads that selection and looks it up against a dictionary index that ships bundled inside the extension.

Both the page-text reading and the selection lookup happen entirely in your browser's content script — the text is never sent over the network, never stored, never logged.

On hosts that are not on your allowlist, the content script exits immediately without reading or modifying anything (the right-click menu still works on a per-tab basis via `activeTab` when you explicitly trigger it).

Default allowlist:

| Entry | Site |
|-------|------|
| `hakkadict.moe.edu.tw` | 教育部客家語辭典 |
| `elearning.hakka.gov.tw/hakka/dictionary` | 客家委員會 e-Learning 客語辭典 |
| `elearning.hakka.gov.tw/hakka/cert/vocabulary` | 客委會客語認證詞彙 |
| `www.moedict.tw/:` | 萌典 — 臺灣客語 section only |

## What the extension stores

Two values are saved via `chrome.storage.sync`:

| Key | Type | Purpose |
|-----|------|---------|
| `pfs.allowlist` | `string[]` | List of hostnames where annotation is allowed |
| `pfs.enabled` | `boolean` | Global on/off switch |

These values are scoped to your Chrome / Google account and synchronized only between your own Chrome installs by Google's standard sync mechanism. They are not transmitted to the extension developer, Phakfasu, or any third party.

## What the extension does NOT do

- It makes **no network requests** of any kind. The conversion library (KonvertToPFS) and the dictionary index (derived from the Ministry of Education Hakkadict open data) are bundled into the extension package and run locally.
- It does **not collect** personally identifiable information, browsing history, page content, form data, authentication details, location, financial data, or any other category of user data.
- It does **not contain** analytics, telemetry, crash reporting, or advertising SDKs.
- It does **not sell or share** any data with third parties.
- It does **not use** any user data for advertising, profiling, or any purpose unrelated to its single advertised purpose (annotating Hakfa text and showing dictionary entries for selections).

## Permissions explained

- **`storage`** — Required to save your allowlist and on/off setting.
- **`scripting`** — Required to dynamically register a content script when you add a custom host to the allowlist from the popup, and to inject the content script on-demand for the right-click dictionary menu on pages not otherwise covered.
- **`contextMenus`** — Required to add the "查客語辭典 (Hakfa Dictionary)" item to the right-click menu when text is selected. The item only appears in the "selection" context.
- **`activeTab`** — Required so the right-click menu can act on the currently focused tab. Standard MV3 mechanism, scoped to the tab the user just interacted with.
- **`optional_host_permissions: *://*/*`** — Lets the popup ask Chrome for permission to add custom sites to your allowlist. Each origin requires its own native Chrome prompt; the extension cannot grant itself broader access. The runtime allowlist gate (checked in every content script invocation) ensures the extension only actually reads or modifies pages on hosts you have explicitly approved.

## Source code

The extension is open source. The full source code is available at:
https://github.com/Phakfasu/ShowPFSChromeExtension

The bundled dictionary data comes from the Ministry of Education Hakkadict mirror at:
https://github.com/Phakfasu/HakkaDictMoeDataMirror

You can verify all of the above by reading the source.

## Contact

Bug reports and privacy questions: please file an issue at the GitHub repository linked above.
