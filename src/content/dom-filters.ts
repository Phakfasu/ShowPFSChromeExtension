import { PFS_CLASS } from "../shared/constants";

// Tags whose subtrees are off-limits for annotation. `.pfs-pfs` is here so the
// parenthetical we inject never gets re-walked or counted as KPPY.
const SKIP_TAGS = [
  "script",
  "style",
  "noscript",
  "textarea",
  "input",
  "code",
  "pre",
  "kbd",
  "samp",
  "ruby",
  "rt",
  "rp",
];

// ---------------------------------------------------------------------------
// Site-specific dialect filtering: only Si-yen (四縣) and Nam Si-yen (南四縣)
// pronunciations are annotated. All other dialects are skipped.
// ---------------------------------------------------------------------------

const HOST = location.hostname;
const IS_HAKKADICT = HOST === "hakkadict.moe.edu.tw";
const IS_ELEARNING = HOST === "elearning.hakka.gov.tw";
const IS_MOEDICT = HOST === "www.moedict.tw";

// hakkadict.moe.edu.tw:
//   - Detail pages: tab panels #item2–#item5 (海陸/大埔/饒平/詔安).
//     #item1 (四縣) and #item6 (南四縣) pass through.
//   - Search-list pages: .accent-data[data-accent-id] with id not "1"/"6".
//   - Home 每日一詞: badge not 四 or 南
//   - Appendix tables: column header not 四縣腔 or 南四縣腔
const HAKKADICT_SKIP = IS_HAKKADICT
  ? [
      "#item2",
      "#item3",
      "#item4",
      "#item5",
      '.accent-data[data-accent-id="2"]',
      '.accent-data[data-accent-id="3"]',
      '.accent-data[data-accent-id="4"]',
      '.accent-data[data-accent-id="5"]',
    ]
  : [];

export const SKIP_SELECTOR = [...SKIP_TAGS, `.${PFS_CLASS}`, ...HAKKADICT_SKIP].join(",");

// Elements we treat as block boundaries when building the cross-text-node
// virtual string. KPPY runs that look adjacent across a block boundary are
// almost always unrelated phrases, so the detector should never join them.
const BLOCK_TAGS = [
  "p",
  "div",
  "li",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "dt",
  "dd",
  "blockquote",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "figcaption",
  "caption",
  "form",
  "fieldset",
  "address",
  "figure",
  "body",
];
export const BLOCK_SELECTOR = BLOCK_TAGS.join(",");

export function isBlock(el: Element): boolean {
  return el.matches(BLOCK_SELECTOR);
}

// Returns true if [el] or any of its ancestors is in a subtree we never
// annotate (script/style/code/pre/ruby/.pfs-pfs/etc.).
export function isSkipped(el: Element): boolean {
  if (el.closest(SKIP_SELECTOR) !== null) return true;
  if (IS_HAKKADICT) return isNonSiyenEveryday(el) || isNonSiyenColumn(el) || isHakkadictIndexRow(el);
  if (IS_ELEARNING) return isNonSiyenElearning(el);
  if (IS_MOEDICT) return isNonSiyenMoedict(el);
  return false;
}

// 每日一詞 on the Hakkadict home page: each dialect row is a <div> inside
// .everyday-audio containing a badge (<span class="border border-primary">四)
// and an .everyday-word span. Skip rows whose badge is not 四 (Si-yen) or
// 南 (Nam Si-yen).
const SIYEN_BADGES = new Set(["四", "南"]);
function isNonSiyenEveryday(el: Element): boolean {
  const container = el.closest(".everyday-audio > div");
  if (!container) return false;
  const badge = container.querySelector("span.border");
  if (!badge) return false;
  return !SIYEN_BADGES.has(badge.textContent?.trim() ?? "");
}

// Appendix tables: columns headed 海陸腔/大埔腔/饒平腔/詔安腔 are non-Si-yen.
// Column positions vary across pages (百家姓表 has an extra 注音一式 column),
// so we resolve by reading the <th> header text at the same column index.
const NON_SIYEN_HEADERS = new Set(["海陸腔", "大埔腔", "饒平腔", "詔安腔"]);
const skipColumnsCache = new WeakMap<HTMLTableElement, Set<number>>();

function getSkipColumns(table: HTMLTableElement): Set<number> {
  let cols = skipColumnsCache.get(table);
  if (cols) return cols;
  cols = new Set<number>();
  const headers = table.querySelectorAll("thead th");
  headers.forEach((th, i) => {
    if (NON_SIYEN_HEADERS.has(th.textContent?.trim() ?? "")) cols!.add(i);
  });
  skipColumnsCache.set(table, cols);
  return cols;
}

function isNonSiyenColumn(el: Element): boolean {
  const td = el.closest("td");
  if (!td) return false;
  const tr = td.parentElement as HTMLTableRowElement | null;
  if (!tr) return false;
  const table = td.closest("table") as HTMLTableElement | null;
  if (!table) return false;
  const cols = getSkipColumns(table);
  if (cols.size === 0) return false;
  const idx = Array.prototype.indexOf.call(tr.children, td);
  return cols.has(idx);
}

// hakkadict.moe.edu.tw detail pages: the 索引類別 row contains phonetic index
// fragments (e.g. "陰平(1/ˊ/24)") that trigger false KPPY detection.
function isHakkadictIndexRow(el: Element): boolean {
  const tr = el.closest("tr");
  if (!tr) return false;
  const th = tr.querySelector(":scope > th");
  return th?.textContent?.trim() === "索引類別";
}

// elearning.hakka.gov.tw: each dialect block is
//   <div class="d-flex align-items-center">
//     <div class="dialect fw-bold">四縣腔</div>
//     ...
//     <div>{hakka_pinyin}</div>
//   </div>
// Skip blocks whose .dialect label is not Si-yen or Nam Si-yen.
const SIYEN_DIALECT_NAMES = new Set(["四縣腔", "南四縣腔"]);
function isNonSiyenElearning(el: Element): boolean {
  const flex = el.closest(".d-flex");
  if (!flex) return false;
  const label = flex.querySelector(".dialect");
  if (!label) return false;
  return !SIYEN_DIALECT_NAMES.has(label.textContent?.trim() ?? "");
}

// www.moedict.tw Hakfa section (/:): each dialect pronunciation is
//   <span class="audioBlock"><div class="icon-play ...">四</div></span>
//   <span>{pinyin with <sup> digits}</span>
// The badge character (四/海/大/平/安/南) is inside .audioBlock. Skip
// pronunciation spans whose preceding .audioBlock has a non-Si-yen badge.
const SIYEN_MOEDICT_BADGES = new Set(["四", "南"]);
function isNonSiyenMoedict(el: Element): boolean {
  const prev = findPrecedingAudioBlock(el);
  if (!prev) return false;
  const badge = prev.textContent?.trim() ?? "";
  return !SIYEN_MOEDICT_BADGES.has(badge);
}

function findPrecedingAudioBlock(el: Element): Element | null {
  const node = el.closest("span");
  if (!node) return null;
  let sib = node.previousElementSibling;
  while (sib) {
    if (sib.classList.contains("audioBlock")) return sib;
    sib = sib.previousElementSibling;
  }
  return null;
}

// Cheap pre-filter: could [text] contain any KPPY syllable? Rejects blocks
// that are purely CJK, digits, or punctuation before running the full detector.
const HAS_LATIN_LETTER = /[A-Za-zÀ-ÿ]/;
export function mayContainKppy(text: string): boolean {
  return HAS_LATIN_LETTER.test(text);
}
