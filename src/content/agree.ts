import { termsLinkRank } from '../lib/text';

const AGREE_RE =
  /\b(i\s+agree|agree(\s+(and|&)\s+(continue|join))?|i\s+accept|accept(\s+(and|&)\s+continue)?|sign\s*up|create\s+(an?\s+|my\s+)?account|register|join(\s+(now|free))?|get\s+started|start\s+(free\s+)?trial|subscribe)\b/i;
/** Cookie banners are their own beast; ignore "Accept all" and friends. */
const IGNORE_RE = /\b(all|cookies?|reject|decline|necessary|essential)\b/i;

export interface AgreeHit {
  url: string;
  linkText: string;
}

function buttonText(el: Element): string {
  if (el instanceof HTMLInputElement) return el.value || el.getAttribute('aria-label') || '';
  return (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || '').trim();
}

function nearbyTermsLink(el: Element): HTMLAnchorElement | null {
  let anc: Element | null = el.parentElement;
  for (let depth = 0; anc && depth < 6; depth++, anc = anc.parentElement) {
    let best: HTMLAnchorElement | null = null;
    let bestRank = 0;
    for (const a of anc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      if (a === el || !/^https?:/.test(a.href)) continue;
      const rank = termsLinkRank(a.textContent ?? '', a.getAttribute('href') ?? '');
      if (rank > bestRank) {
        best = a;
        bestRank = rank;
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Look for an "I agree" / "Sign up"-style button with a terms link next to it.
 * Read-only: nothing is shown on the page; the popup offers to summarize it.
 */
export function findAgreeTerms(doc: Document): AgreeHit | null {
  const buttons = doc.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
  for (const el of buttons) {
    const text = buttonText(el);
    if (!text || text.length > 40 || !AGREE_RE.test(text) || IGNORE_RE.test(text)) continue;
    const link = nearbyTermsLink(el);
    if (!link) continue;
    const url = link.href.split('#')[0];
    if (url === location.href.split('#')[0]) continue;
    return { url, linkText: (link.textContent ?? '').trim() };
  }
  return null;
}
