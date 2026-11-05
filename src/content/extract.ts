import { POLICY_TITLE_RE, POLICY_URL_RE, splitSentences } from '../lib/text';

export const HOST_ID = 'fine-print-host';

/** Chrome we never read: navigation, footers, widgets, our own card. */
const SKIP = [
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'button', 'select', 'textarea', 'input',
  'nav', 'footer', 'aside',
  '[role="navigation"]', '[role="contentinfo"]', '[role="banner"]', '[role="dialog"]', '[aria-hidden="true"]',
  `#${HOST_ID}`,
].join(',');

const BLOCK_TAGS = new Set([
  'P', 'LI', 'TD', 'TH', 'DD', 'DT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'DIV', 'SECTION',
  'ARTICLE', 'MAIN', 'BODY', 'FIGCAPTION', 'TR', 'UL', 'OL', 'TABLE', 'HEADER', 'DETAILS', 'SUMMARY', 'FORM', 'ADDRESS',
]);

function textLength(el: Element): number {
  return (el.textContent ?? '').replace(/\s+/g, '').length;
}

/** The element holding the policy body: <main>/<article> if it holds most of the text, else <body>. */
export function pickRoot(doc: Document): Element {
  const body = doc.body ?? doc.documentElement;
  const total = textLength(body);
  let best: Element = body;
  let bestLen = 0;
  for (const el of doc.querySelectorAll('main, article, [role="main"], #content, #main, .content, .main-content')) {
    if (el.closest('nav, footer, aside')) continue;
    const len = textLength(el);
    if (len > bestLen) {
      best = el;
      bestLen = len;
    }
  }
  return bestLen >= total * 0.35 ? best : body;
}

/**
 * Pull readable sentences from the main content, in document order.
 * Text nodes inside one block element are joined as-is, so sentences match the page text.
 */
export function extractSentences(doc: Document): string[] {
  const root = pickRoot(doc);
  const blockCache = new WeakMap<Element, Element>();
  const blockOf = (el: Element): Element => {
    const cached = blockCache.get(el);
    if (cached) return cached;
    let cur: Element = el;
    while (cur !== root && !BLOCK_TAGS.has(cur.tagName) && cur.parentElement) cur = cur.parentElement;
    blockCache.set(el, cur);
    return cur;
  };

  const out: string[] = [];
  let buf = '';
  let curBlock: Element | null = null;
  const flush = () => {
    if (buf.trim()) out.push(...splitSentences(buf));
    buf = '';
  };

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return (node as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      if ((n as Element).tagName === 'BR') buf += ' ';
      continue;
    }
    const parent = n.parentElement;
    if (!parent) continue;
    const blk = blockOf(parent);
    if (blk !== curBlock) {
      flush();
      curBlock = blk;
    }
    buf += (n as Text).data;
  }
  flush();
  return out.filter((s) => s.length >= 2);
}

const LEGALESE = /\b(shall|hereby|herein|pursuant|liabilit|liable|indemnif|warrant|governing law|personal (data|information)|third[- ]part|you agree|we collect|we may)/gi;

export interface Detection {
  isPolicy: boolean;
  reason: string;
}

/** Is this page a ToS / privacy policy / EULA? Needs a URL or heading hint plus real legal text. */
export function detectPolicy(doc: Document, loc: Location, sentences: string[]): Detection {
  const where = `${loc.hostname} ${loc.pathname} ${loc.search}`;
  const urlHit = POLICY_URL_RE.test(where);
  const headings = [doc.title, ...[...doc.querySelectorAll('h1, h2')].slice(0, 6).map((h) => h.textContent ?? '')].join(' | ');
  const titleHit = POLICY_TITLE_RE.test(headings);
  if (!urlHit && !titleHit) return { isPolicy: false, reason: 'no url/title hint' };

  const text = sentences.join(' ');
  if (text.length < 2500) return { isPolicy: false, reason: 'too little text' };
  const legal = text.match(LEGALESE)?.length ?? 0;
  if (legal < 6) return { isPolicy: false, reason: 'not enough legalese' };
  return { isPolicy: true, reason: urlHit ? 'url' : 'title' };
}
