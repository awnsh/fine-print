import { HOST_ID } from './extract';

const HIGHLIGHT_NAME = 'fine-print';
let sheetInstalled = false;

function installSheet(): void {
  if (sheetInstalled) return;
  sheetInstalled = true;
  // A constructed sheet isn't blocked by the page's style-src CSP the way an injected <style> can be.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    `::highlight(${HIGHLIGHT_NAME}) { background-color: #FFB21E; color: #1D1B24; text-decoration: underline 2px #FF4A3D; }`,
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

interface TextIndex {
  /** Page text with every whitespace character removed. */
  chars: string;
  nodes: Text[];
  /** For each char in `chars`: index into `nodes` and offset inside that node. */
  nodeOf: Int32Array;
  offsetOf: Int32Array;
}

function buildIndex(): TextIndex {
  const nodes: Text[] = [];
  const nodeOf: number[] = [];
  const offsetOf: number[] = [];
  let chars = '';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || p.closest(`script, style, noscript, template, #${HOST_ID}`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const data = n.data;
    const idx = nodes.push(n) - 1;
    let piece = '';
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      if (/\s| |​/.test(c)) continue;
      piece += c;
      nodeOf.push(idx);
      offsetOf.push(i);
    }
    chars += piece;
  }
  return { chars, nodes, nodeOf: Int32Array.from(nodeOf), offsetOf: Int32Array.from(offsetOf) };
}

function rangeFor(ix: TextIndex, start: number, len: number): Range {
  const end = Math.min(start + len, ix.chars.length) - 1;
  const r = document.createRange();
  r.setStart(ix.nodes[ix.nodeOf[start]], ix.offsetOf[start]);
  r.setEnd(ix.nodes[ix.nodeOf[end]], ix.offsetOf[end] + 1);
  return r;
}

function isVisible(r: Range): boolean {
  const el = r.startContainer.parentElement;
  if (!el) return false;
  return typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true }) : true;
}

function findRange(quote: string): Range | null {
  const ix = buildIndex();
  const needle = quote.replace(/[\s ​]+/g, '');
  // Whole sentence first; then a long prefix (the page may have changed a little since extraction).
  for (const probe of [needle, needle.slice(0, 80), needle.slice(0, 40)]) {
    if (probe.length < 12) continue;
    let fallback: Range | null = null;
    for (let at = ix.chars.indexOf(probe); at >= 0; at = ix.chars.indexOf(probe, at + 1)) {
      const r = rangeFor(ix, at, probe === needle ? needle.length : Math.min(needle.length, ix.chars.length - at));
      if (isVisible(r)) return r;
      fallback ??= r;
    }
    if (fallback) return fallback;
  }
  return null;
}

/** Scroll to the sentence and highlight it. Returns false if it's not on the page. */
export function highlightQuote(quote: string): boolean {
  const range = findRange(quote);
  if (!range) return false;
  // Open collapsed <details> sections so the sentence can be seen.
  for (let el = range.startContainer.parentElement; el; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement && !el.open) el.open = true;
  }
  if ('highlights' in CSS) {
    installSheet();
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
  } else {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  const target = range.startContainer.parentElement;
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

export function clearHighlight(): void {
  if ('highlights' in CSS) CSS.highlights.delete(HIGHLIGHT_NAME);
}
