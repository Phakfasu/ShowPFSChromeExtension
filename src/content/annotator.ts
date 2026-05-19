import { convertToPfsBothDialects, formatPfsText } from "../converter";
import { detectKppyRuns, type DetectedRun } from "./detector";
import { PFS_CLASS } from "../shared/constants";
import { SKIP_SELECTOR, isBlock, isSkipped, mayContainKppy } from "./dom-filters";

interface Range {
  node: Text;
  start: number;
  end: number;
}

/**
 * Annotate all KPPY runs inside [block] — a block-level element treated as the
 * detection boundary. KPPY tone marks on hakkadict.moe.edu.tw and similar
 * dictionary pages are wrapped in inline tags like <sup>, which puts the mark
 * and its syllable letters in separate text nodes; the per-text-node approach
 * we used earlier seeded a run on the bare tone mark alone. To handle that,
 * we concatenate all inline text-node values inside [block] into a virtual
 * string, run the detector against it, and for each detected run insert a
 * `<span class="pfs-pfs"> (PFS)</span>` immediately after the run's last text
 * node. The original HTML (including the <sup>s) is preserved.
 */
export function annotateBlock(block: Element): number {
  if (isSkipped(block)) return 0;

  // Cheap bail before we walk children: pages that never contain any KPPY
  // tone marker (the common case on most blocks) skip the O(n) virtual-string
  // build and the detector altogether.
  if (!mayContainKppy(block.textContent ?? "")) return 0;

  const textNodes = collectInlineTextNodes(block);
  if (textNodes.length === 0) return 0;

  const parts: string[] = [];
  const ranges: Range[] = [];
  let cursor = 0;
  let prevValue = "";
  let prevParent: Node | null = null;
  for (const t of textNodes) {
    const v = t.nodeValue ?? "";
    if (prevParent && t.parentNode !== prevParent && needsSyntheticSep(prevValue, v)) {
      parts.push(" ");
      cursor += 1;
    }
    parts.push(v);
    ranges.push({ node: t, start: cursor, end: cursor + v.length });
    cursor += v.length;
    prevValue = v;
    prevParent = t.parentNode;
  }
  const text = parts.join("");

  const runs = detectKppyRuns(text);
  if (runs.length === 0) return 0;

  let annotated = 0;
  // Walk runs right-to-left so a splitText on one run doesn't shift the text
  // node a later (rightward) run still depends on. The Range objects for nodes
  // strictly to the left of the current run remain valid.
  for (let i = runs.length - 1; i >= 0; i--) {
    if (insertAnnotation(runs[i], ranges, text)) annotated++;
  }
  return annotated;
}

function insertAnnotation(run: DetectedRun, ranges: Range[], fullText: string): boolean {
  const last = findRangeForOffset(ranges, run.end);
  if (!last) return false;

  const node = last.node;
  const offsetInNode = run.end - last.start;
  const nodeLen = node.nodeValue?.length ?? 0;

  if (offsetInNode < nodeLen) {
    node.splitText(offsetInNode);
  }

  // Walk up past inline wrappers like <sup>/<sub> so the annotation span is
  // never rendered as superscript/subscript. Hakkadict wraps every tone marker
  // (調型 and 調值) in <sup>, so without this the PFS parenthetical inherits
  // the superscript styling.
  let insertAfter: Node = node;
  let insertParent: Node | null = node.parentNode;
  while (
    insertParent &&
    insertParent.nodeType === Node.ELEMENT_NODE &&
    (insertParent as Element).matches("sup,sub") &&
    !isBlock(insertParent as Element)
  ) {
    insertAfter = insertParent;
    insertParent = insertParent.parentNode;
  }
  if (!insertParent) return false;

  // Idempotency: don't re-append if the next sibling is already our marker.
  const next = insertAfter.nextSibling;
  if (
    next &&
    next.nodeType === Node.ELEMENT_NODE &&
    (next as Element).classList.contains(PFS_CLASS)
  ) {
    return false;
  }

  const kppy = fullText.slice(run.start, run.end);
  const pair = convertToPfsBothDialects(kppy, run.format);
  const pfsText = formatPfsText(pair);

  const doc = node.ownerDocument ?? document;
  const wrapper = doc.createElement("span");
  wrapper.className = PFS_CLASS;
  wrapper.appendChild(doc.createTextNode("  "));
  const highlight = doc.createElement("span");
  highlight.className = `${PFS_CLASS}-bg`;
  highlight.textContent = `(${pfsText})`;
  wrapper.appendChild(highlight);
  insertParent.insertBefore(wrapper, insertAfter.nextSibling);
  return true;
}

function findRangeForOffset(ranges: Range[], offset: number): Range | null {
  for (const r of ranges) {
    if (r.start < offset && offset <= r.end) return r;
  }
  return null;
}

function collectInlineTextNodes(block: Element): Text[] {
  const out: Text[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      // Stop at nested blocks — they get their own annotateBlock pass, and
      // joining their text across the boundary would produce spurious runs.
      if (el !== block && isBlock(el)) return;
      if (el.matches(SKIP_SELECTOR)) return;
      if ((el as HTMLElement).isContentEditable) return;
      for (const c of Array.from(node.childNodes)) walk(c);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const v = node.nodeValue ?? "";
      if (v.length > 0) out.push(node as Text);
    }
  };
  for (const c of Array.from(block.childNodes)) walk(c);
  return out;
}

// When two text nodes from different parent elements are adjacent and the
// previous one ends with a KPPY tone modifier while the next starts with a
// letter, they belong to separate syllables that the source HTML placed in
// different inline wrappers (e.g. </sup>na<sup>). Without a synthetic space
// the virtual string glues them into one unparsable chunk.
const ENDS_WITH_MODIFIER = /[ˊˇˋ+]$/;
const STARTS_WITH_LETTER = /^[A-Za-zÀ-ÿ]/;

function needsSyntheticSep(prev: string, next: string): boolean {
  return ENDS_WITH_MODIFIER.test(prev) && STARTS_WITH_LETTER.test(next);
}
