import { PFS_CLASS } from "../shared/constants";
import { annotateBlock } from "./annotator";
import {
  BLOCK_SELECTOR,
  isBlock,
  isSkipped,
  mayContainKppy,
} from "./dom-filters";

/**
 * Annotate every block-level element under [root]. Block-level processing is
 * required so KPPY runs split across inline elements (e.g. tone marks wrapped
 * in <sup>) are joined before detection.
 */
export function scanSubtree(root: Node): number {
  let total = 0;
  for (const block of collectBlocks(root)) {
    total += annotateBlock(block);
  }
  return total;
}

function collectBlocks(root: Node): Element[] {
  const out: Element[] = [];
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    if (isSkipped(el)) return out;
    if (isBlock(el)) out.push(el);
    for (const b of el.querySelectorAll(BLOCK_SELECTOR)) {
      if (!isSkipped(b)) out.push(b);
    }
  } else if (root.nodeType === Node.DOCUMENT_NODE) {
    for (const b of (root as Document).querySelectorAll(BLOCK_SELECTOR)) {
      if (!isSkipped(b)) out.push(b);
    }
  }
  return out;
}

let observer: MutationObserver | null = null;

const OBSERVE_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
};

export function stopObserving(): void {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

export function startObserving(): void {
  if (observer) return;
  observer = new MutationObserver((records) => {
    const blocksToReprocess = new Set<Element>();

    for (const r of records) {
      // Skip our own insertions: a single annotateBlock call adds one or more
      // .pfs-pfs spans. The disconnect/observe wrap below already prevents our
      // OWN annotation cycle from queueing records, but this check still
      // matters for the SPA case where third-party code re-renders a block
      // containing our spans — we don't want those re-additions to trigger
      // another annotation pass.
      let selfInduced = false;
      for (const n of r.addedNodes) {
        if (
          n.nodeType === Node.ELEMENT_NODE &&
          (n as Element).classList.contains(PFS_CLASS)
        ) {
          selfInduced = true;
          break;
        }
      }
      if (selfInduced) continue;

      // characterData fires on every keystroke in inputs / contenteditable and
      // on every tick of live widgets (clocks, tickers, search-as-you-type).
      // Cheap-reject these by checking whether the changed text node could
      // even contain a KPPY tone marker before queueing its block.
      if (r.type === "characterData" && !mayContainKppy(r.target.nodeValue ?? "")) {
        continue;
      }

      for (const n of r.addedNodes) {
        for (const block of collectBlocks(n)) {
          blocksToReprocess.add(block);
        }
      }

      const targetEl =
        r.target.nodeType === Node.ELEMENT_NODE
          ? (r.target as Element)
          : r.target.parentElement;
      if (targetEl) {
        const block = targetEl.closest(BLOCK_SELECTOR);
        if (block && !isSkipped(block)) blocksToReprocess.add(block);
      }
    }

    if (blocksToReprocess.size === 0) return;

    // Disconnect the observer during annotation so our own DOM edits don't
    // re-queue mutations. annotateBlock calls Text.splitText, which generates
    // a characterData mutation on the original text node and a childList
    // mutation adding the new text-node sibling. Neither carries our .pfs-pfs
    // class, so the self-induced check above doesn't catch them — without the
    // disconnect, every annotation triggers a redundant re-walk of its block,
    // which on text-heavy pages (e.g. MOE Hakkadict) burns through CPU.
    observer!.disconnect();
    try {
      for (const b of blocksToReprocess) annotateBlock(b);
    } finally {
      observer!.observe(document.body, OBSERVE_OPTIONS);
    }
  });
  observer.observe(document.body, OBSERVE_OPTIONS);
}
