import type { DictEntry } from "../lookup/types";

const MAX_VISIBLE = 5;

export function renderPopup(root: ShadowRoot, entries: DictEntry[]): HTMLElement {
  return renderCard(root, (card) => {
    const visible = entries.slice(0, MAX_VISIBLE);
    for (const e of visible) card.appendChild(buildEntry(e));

    if (entries.length > MAX_VISIBLE) {
      const more = document.createElement("div");
      more.className = "more";
      more.textContent = `+${entries.length - MAX_VISIBLE} more`;
      card.appendChild(more);
    }
  });
}

export function renderNoResult(root: ShadowRoot, query: string): HTMLElement {
  return renderCard(root, (card) => {
    card.appendChild(buildNoResult(query));
  });
}

function renderCard(root: ShadowRoot, fill: (card: HTMLElement) => void): HTMLElement {
  root.replaceChildren();

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("src/content/popup.css");
  root.appendChild(link);

  const card = document.createElement("div");
  card.className = "card";
  // Critical positioning is applied inline so it takes effect before the
  // linked stylesheet finishes loading inside the shadow root.
  card.style.position = "fixed";
  card.style.zIndex = "2147483647";
  card.style.pointerEvents = "auto";
  card.style.maxWidth = "420px";
  card.style.minWidth = "240px";

  fill(card);

  root.appendChild(card);
  return card;
}

function buildNoResult(query: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "entry no-result";

  const header = document.createElement("div");
  header.className = "header";
  const term = document.createElement("span");
  term.className = "term";
  term.textContent = query;
  header.appendChild(term);
  wrap.appendChild(header);

  const msg = document.createElement("div");
  msg.className = "gloss";
  msg.textContent = "客語辭典未收錄";
  wrap.appendChild(msg);

  const footer = document.createElement("div");
  footer.className = "footer";
  const spacer = document.createElement("span");
  footer.appendChild(spacer);
  const link = document.createElement("a");
  link.href = `https://hakkadict.moe.edu.tw/search_list/?keyword=${encodeURIComponent(query)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "在客語辭典搜尋";
  footer.appendChild(link);
  wrap.appendChild(footer);

  return wrap;
}

function buildEntry(e: DictEntry): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "entry";

  const header = document.createElement("div");
  header.className = "header";

  const dialect = document.createElement("span");
  dialect.className = e.dialect === "namSiyen" ? "dialect nam" : "dialect";
  dialect.textContent = e.dialect === "namSiyen" ? "南四縣" : "四縣";
  header.appendChild(dialect);

  const term = document.createElement("span");
  term.className = "term";
  term.textContent = e.term;
  header.appendChild(term);
  wrap.appendChild(header);

  if (e.pfs) {
    const pfs = document.createElement("div");
    pfs.className = "pfs";
    pfs.textContent = e.pfs;
    wrap.appendChild(pfs);
  }

  if (e.gloss) {
    const gloss = document.createElement("div");
    gloss.className = "gloss";
    gloss.textContent = e.gloss;
    wrap.appendChild(gloss);
  }

  if (e.example) {
    const example = document.createElement("div");
    example.className = "example";
    example.textContent = e.example;
    wrap.appendChild(example);
  }

  const footer = document.createElement("div");
  footer.className = "footer";
  const seq = document.createElement("span");
  seq.textContent = `序號 ${e.seq}`;
  footer.appendChild(seq);
  const link = document.createElement("a");
  link.href = `https://hakkadict.moe.edu.tw/search_list/?keyword=${encodeURIComponent(e.term)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "在客語辭典查看";
  footer.appendChild(link);
  wrap.appendChild(footer);

  return wrap;
}

export function positionCard(card: HTMLElement, rect: DOMRect): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 6;
  const cardRect = card.getBoundingClientRect();
  const cw = cardRect.width || 320;
  const ch = cardRect.height || 200;

  let left = rect.left;
  if (left + cw + margin > vw) left = Math.max(margin, vw - cw - margin);
  if (left < margin) left = margin;

  let top = rect.bottom + margin;
  if (top + ch + margin > vh) {
    const above = rect.top - ch - margin;
    if (above >= margin) top = above;
    else top = Math.max(margin, vh - ch - margin);
  }

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}
