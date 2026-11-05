/** Collapse every whitespace run (incl. nbsp) into one space and trim. */
export function normalizeSpace(s: string): string {
  return s.replace(/[\s ​]+/g, ' ').trim();
}

/** FNV-1a 32-bit, hex. Works on http pages too (crypto.subtle needs a secure context). */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + s.length.toString(36);
}

const ABBREVIATIONS = /\b(?:e\.g|i\.e|etc|inc|ltd|llc|co|corp|no|vs|u\.s|st|mr|ms|dr|sec|art)\.$/i;

/** Split a block of text into sentences. Keeps the original characters (only whitespace normalized). */
export function splitSentences(block: string): string[] {
  const text = normalizeSpace(block);
  if (!text) return [];
  const out: string[] = [];
  const re = /[.!?;](?=["'”’)\]]*\s+["'“‘(\[]?[A-Z0-9])/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + 1;
    const candidate = text.slice(start, end);
    if (ABBREVIATIONS.test(candidate)) continue;
    // swallow closing quotes/brackets
    let stop = end;
    while (stop < text.length && /["'”’)\]]/.test(text[stop])) stop++;
    out.push(text.slice(start, stop).trim());
    start = stop;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

export const POLICY_URL_RE =
  /(terms|tos\b|privacy|legal|eula|conditions|user[-_]?agreement|policies|policy|cookie)/i;

export const POLICY_TITLE_RE =
  /(terms\s+(of\s+(service|use|sale)|and\s+conditions|&\s+conditions)|privacy\s+(policy|notice|statement|center)|end[\s-]user\s+licen[cs]e|\beula\b|user\s+agreement|conditions\s+of\s+use|cookie\s+(policy|notice)|data\s+policy|legal\s+terms|terms\b)/i;

export const TERMS_LINK_RE =
  /(terms|conditions|privacy|eula|user agreement|licen[cs]e agreement|legal|policy)/i;

/** Rank a link: terms beats privacy beats generic legal. */
export function termsLinkRank(text: string, href: string): number {
  const s = `${text} ${href}`.toLowerCase();
  if (/terms|conditions|eula|user agreement|tos\b/.test(s)) return 3;
  if (/privacy/.test(s)) return 2;
  if (/legal|policy|licen/.test(s)) return 1;
  return 0;
}

/** A URL that makes Chrome scroll to and highlight `quote` on another page (Text Fragments). */
export function textFragmentUrl(url: string, quote: string): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, '%2D');
  const words = quote.replace(/\s+/g, ' ').trim().split(' ');
  const frag = words.length <= 10 ? enc(words.join(' ')) : `${enc(words.slice(0, 5).join(' '))},${enc(words.slice(-5).join(' '))}`;
  return `${url.split('#')[0]}#:~:text=${frag}`;
}
