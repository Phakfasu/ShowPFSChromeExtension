import { convertToPfsBothDialects, formatPfsText, type KppyFormat } from "../converter";
import { PFS_CLASS } from "../shared/constants";

/**
 * On hakkadict.moe.edu.tw detail pages, annotate 詞目 (headword) cells with
 * the PFS reading derived from the 音讀 (pronunciation) row in the same tab.
 * Must run BEFORE scanSubtree so the contour div's textContent is still clean.
 */
export function annotateHakkadictHeadwords(): void {
  if (location.hostname !== "hakkadict.moe.edu.tw") return;

  for (const tabId of ["item1", "item6"]) {
    const tab = document.getElementById(tabId);
    if (tab) annotateHeadwordInTab(tab);
  }
}

function annotateHeadwordInTab(tab: Element): void {
  let headwordTd: Element | null = null;
  let kppy: string | null = null;

  for (const row of tab.querySelectorAll("tr")) {
    const th = row.querySelector(":scope > th");
    if (!th) continue;
    const label = th.textContent?.trim();

    if (label === "詞目") {
      headwordTd = row.querySelector(":scope > td");
    } else if (label === "音讀") {
      const contour = row.querySelector('.accent-data[data-type="contour"]');
      if (contour) kppy = contour.textContent?.trim() ?? null;
    }
  }

  if (!headwordTd || !kppy) return;
  if (headwordTd.querySelector(`.${PFS_CLASS}`)) return;

  const format: KppyFormat = "unicode";
  const pair = convertToPfsBothDialects(kppy, format);
  const pfsText = formatPfsText(pair);

  const doc = headwordTd.ownerDocument ?? document;
  const wrapper = doc.createElement("span");
  wrapper.className = PFS_CLASS;
  wrapper.appendChild(doc.createTextNode("  "));
  const highlight = doc.createElement("span");
  highlight.className = `${PFS_CLASS}-bg`;
  highlight.textContent = `(${pfsText})`;
  wrapper.appendChild(highlight);
  headwordTd.appendChild(wrapper);
}
