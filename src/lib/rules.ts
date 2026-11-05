import type { FlagCategory, RedFlag, Severity, Tone } from './types';

interface Rule {
  category: Exclude<FlagCategory, 'other'>;
  weight: 1 | 2 | 3;
  label: string;
  /** Second-person fragment used to build the headline: "they can sell your data". */
  roast: string;
  patterns: RegExp[];
  /** If any of these match the sentence, it's not a red flag (e.g. "we do not sell"). */
  unless?: RegExp[];
}

const NEGATED = /\b(do(es)?\s+not|don['’]t|doesn['’]t|will\s+not|won['’]t|never|neither|nor|not\s+(?:sell|rent|share))\b/i;

export const RULES: Rule[] = [
  {
    category: 'sells-data',
    weight: 3,
    label: 'They can sell your data',
    roast: 'they can sell your data',
    patterns: [
      /\b(sell|sells|sold|selling|rent|rents)\b[^.;]{0,80}\b(personal|your)\s+(data|information|info)\b/i,
      /\b(sale|selling)\s+of\s+(your\s+)?personal\s+(data|information)\b/i,
      /\b(personal\s+(data|information)|your\s+(data|information))\b[^.;]{0,60}\b(may\s+be\s+)?(sold|rented)\b/i,
    ],
    unless: [NEGATED, /\bdo not sell or share\b/i, /\bopt[- ]out of (the )?sale\b/i],
  },
  {
    category: 'shares-data',
    weight: 2,
    label: 'Your info goes to "partners"',
    roast: 'your info gets passed around to "partners"',
    patterns: [
      /\b(share|disclose|provide|transfer)\b[^.;]{0,100}\b(third[- ]part(y|ies)|advertisers|advertising partners|marketing partners|business partners|affiliates)\b/i,
      /\b(third[- ]part(y|ies)|advertisers|partners)\b[^.;]{0,60}\b(receive|access|collect)\b[^.;]{0,40}\b(your|personal)\b/i,
    ],
    unless: [NEGATED],
  },
  {
    category: 'arbitration',
    weight: 3,
    label: "You can't take them to court",
    roast: "you can't take them to court",
    patterns: [
      /\bbinding\s+(individual\s+)?arbitration\b/i,
      /\b(resolved|settled|decided)\b[^.;]{0,60}\barbitration\b/i,
      /\bagree\s+to\s+arbitrat/i,
      /\barbitration\s+agreement\b/i,
    ],
  },
  {
    category: 'class-waiver',
    weight: 3,
    label: 'No class actions, no jury',
    roast: "you can't join a class action",
    patterns: [
      // "waive"/"waives"/"waived" as a verb, so section headings like "Class Action Waiver" don't win.
      /\bclass[- ]action\b[^.;]{0,80}\bwaive[sd]?\b/i,
      /\bwaive[sd]?\b[^.;]{0,80}\b(class[- ]action|jury\s+trial|right\s+to\s+(a\s+)?jury)\b/i,
      /\b(only|solely)\s+(on\s+an?\s+|in\s+(your|their)\s+)?individual\s+(basis|capacity)\b/i,
      /\bnot\s+as\s+a\s+plaintiff\s+or\s+class\s+member\b/i,
    ],
  },
  {
    category: 'auto-renew',
    weight: 2,
    label: 'It auto-renews until you cancel',
    roast: 'it auto-renews forever',
    patterns: [
      /\bauto(matic(ally)?)?[- ]?renew/i,
      /\brenew(s)?\s+automatically\b/i,
      /\brecurring\s+(billing|charges?|payments?|subscription)\b/i,
      /\buntil\s+(you|it is)\s+cancel/i,
    ],
  },
  {
    category: 'no-refunds',
    weight: 2,
    label: 'No refunds',
    roast: 'no refunds, ever',
    patterns: [/\bnon[- ]?refundable\b/i, /\bno\s+refunds?\b/i, /\b(will|shall)\s+not\s+(be\s+)?(issue|provide|give)?\s*(a\s+)?refund/i],
  },
  {
    category: 'terminate-anytime',
    weight: 2,
    label: 'They can delete your stuff anytime',
    roast: 'they can delete your stuff (or you) whenever they like',
    patterns: [
      /\b(terminate|suspend|disable|delete|remove|deactivate)\b[^.;]{0,80}\b(account|access|service|content)\b[^.;]{0,100}\b(at\s+any\s+time|for\s+any\s+(or\s+no\s+)?reason|without\s+(prior\s+)?notice|(in|at)\s+(our|its)\s+(sole\s+)?discretion)/i,
      /\b(at\s+any\s+time|for\s+any\s+(or\s+no\s+)?reason|(in|at)\s+(our|its)\s+sole\s+discretion)\b[^.;]{0,80}\b(terminate|suspend|disable|delete|deactivate)\b/i,
    ],
  },
  {
    category: 'content-license',
    weight: 3,
    label: 'They basically own your uploads',
    roast: 'they get a forever-license to everything you upload',
    patterns: [
      /\b(perpetual|irrevocable|royalty[- ]free|sub[- ]?licensable|transferable)\b[^.;]{0,160}\blicen[cs]e\b/i,
      /\blicen[cs]e\b[^.;]{0,160}\b(perpetual|irrevocable|royalty[- ]free|sub[- ]?licensable)\b/i,
    ],
  },
  {
    category: 'tracking',
    weight: 2,
    label: 'They follow you around the internet',
    roast: 'they follow you around the internet',
    patterns: [
      /\b(track|collect|monitor)\b[^.;]{0,80}\b(across|on)\s+(other|third[- ]party|different)\s+(websites|sites|apps|services|devices)\b/i,
      /\b(third[- ]party|advertising)\s+(cookies|pixels|trackers|SDKs|tags)\b/i,
      /\b(cross[- ](device|site|context)|device\s+fingerprint|fingerprinting|web\s+beacons?)\b/i,
    ],
    unless: [NEGATED],
  },
  {
    category: 'sensitive-data',
    weight: 2,
    label: 'They collect sensitive stuff',
    roast: 'they collect your location and other sensitive stuff',
    patterns: [
      /\b(precise\s+(geo)?location|biometric|face\s*(geometry|print|recognition)|voice\s*print|health\s+(data|information)|contacts?\s+list|address\s+book)\b/i,
    ],
    unless: [NEGATED],
  },
  {
    category: 'ai-training',
    weight: 2,
    label: 'Your stuff trains their AI',
    roast: 'your stuff trains their AI',
    patterns: [
      /\b(train|training|develop|improve)\b[^.;]{0,80}\b(machine[- ]learning|artificial\s+intelligence|\bAI\b|models?|algorithms)\b/i,
    ],
    unless: [NEGATED],
  },
  {
    category: 'change-terms',
    weight: 1,
    label: 'They can change the rules on you',
    roast: 'they can rewrite the rules without asking',
    patterns: [
      /\b(modify|change|update|revise|amend)\b[^.;]{0,60}\b(terms|agreement|polic(y|ies))\b[^.;]{0,100}\b(at\s+any\s+time|without\s+(prior\s+)?notice|sole\s+discretion|from\s+time\s+to\s+time)\b/i,
      /\bcontinued\s+use\b[^.;]{0,100}\b(constitutes|means|deemed|signifies)\b/i,
    ],
  },
  {
    category: 'retention',
    weight: 1,
    label: 'They keep your data for ages',
    roast: 'they keep your data long after you leave',
    patterns: [
      /\b(retain|keep|store)\b[^.;]{0,100}\b(indefinitely|even\s+after|after\s+you\s+(delete|close|cancel)|as\s+long\s+as\s+(necessary|needed|we))\b/i,
    ],
  },
  {
    category: 'liability',
    weight: 1,
    label: "They're not responsible for anything",
    roast: "they're not responsible if it all goes wrong",
    patterns: [
      /\b(shall|will)\s+not\s+be\s+liable\b/i,
      /\b(provided|offered)\s+(on\s+an\s+)?["“]?as[- ]is["”]?/i,
      /\bin\s+no\s+event\b[^.;]{0,80}\bliable\b/i,
      /\bmaximum\s+(aggregate\s+)?liability\b/i,
    ],
  },
];

export const CATEGORY_LABELS: Record<FlagCategory, string> = Object.fromEntries([
  ...RULES.map((r) => [r.category, r.label]),
  ['other', 'Something sketchy'],
]) as Record<FlagCategory, string>;

const MAX_QUOTE = 900;

/** 0 = no match. Earlier patterns are the more specific ones, so they score higher. */
function matchRule(rule: Rule, sentence: string): number {
  if (rule.unless?.some((re) => re.test(sentence))) return 0;
  let score = 0;
  rule.patterns.forEach((re, i) => {
    if (re.test(sentence)) score += rule.patterns.length - i;
  });
  return score;
}

/** Keyword/regex analysis. Every flag quotes a real sentence from `sentences`. */
export function analyzeWithRules(sentences: string[], max = 5): RedFlag[] {
  const best = new Map<Rule, { sentence: string; score: number }>();
  for (const s of sentences) {
    if (s.length < 25 || s.length > MAX_QUOTE) continue;
    for (const rule of RULES) {
      const hits = matchRule(rule, s);
      if (!hits) continue;
      // Prefer stronger matches, then real sentences over headings, then shorter ones.
      const score = hits * 1000 - (s.length < 60 ? 500 : 0) - s.length;
      const prev = best.get(rule);
      if (!prev || score > prev.score) best.set(rule, { sentence: s, score });
    }
  }
  return [...best.entries()]
    .sort((a, b) => b[0].weight - a[0].weight || RULES.indexOf(a[0]) - RULES.indexOf(b[0]))
    .slice(0, max)
    .map(([rule, { sentence }]) => ({
      category: rule.category,
      label: rule.label,
      quote: sentence,
      weight: rule.weight,
    }));
}

export function scoreFlags(flags: RedFlag[]): { score: number; severity: Severity } {
  const score = flags.reduce((n, f) => n + f.weight, 0);
  const severity: Severity = score >= 7 ? 'yikes' : score >= 3 ? 'eh' : 'fine';
  return { score, severity };
}

const FINE_LINES: Record<Tone, string> = {
  0: 'Nothing alarming jumped out. Still worth a skim.',
  1: 'Surprisingly tame. Read it anyway, just in case.',
  2: 'Honestly? Pretty tame. Suspiciously tame.',
  3: 'Clean so far. Either they have good lawyers or bad ones.',
  4: 'Not a single red flag?? Who hurt these lawyers?? (Nobody. That\'s the point.)',
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One-sentence roast from the two worst flags, in the chosen tone (used when on-device AI is off). */
export function rulesHeadline(flags: RedFlag[], tone: Tone): string {
  if (!flags.length) return FINE_LINES[tone];
  const rule = (f: RedFlag) => RULES.find((r) => r.category === f.category);
  const parts = flags.slice(0, 2).map((f) => rule(f)?.roast ?? f.label.toLowerCase());
  const a = parts[0];
  const b = parts[1];
  switch (tone) {
    case 0:
      return b ? `Heads up: ${a}, and ${b}.` : `Heads up: ${a}.`;
    case 1:
      return b ? `${cap(a)}, and ${b}. Good to know.` : `${cap(a)}. Good to know.`;
    case 2:
      return b ? `${cap(a)}, and ${b}. Cool cool cool.` : `${cap(a)}. Cool cool cool.`;
    case 3:
      return b ? `${cap(a)}, and ${b}. But sure, click "I agree".` : `${cap(a)}. But sure, click "I agree".`;
    case 4:
      return b
        ? `${cap(a)} AND ${b}, and you agreed by existing near this page. Incredible.`
        : `${cap(a)}, and you agreed by existing near this page. Incredible.`;
  }
}

const RELEVANT =
  /(sell|sold|share|disclos|third[- ]part|partner|advertis|arbitrat|class action|jury|waive|renew|subscription|recurring|cancel|refund|terminat|suspend|licen[cs]|perpetual|irrevocable|royalty|track|cookie|pixel|beacon|fingerprint|location|biometric|retain|retention|liab|indemnif|discretion|modify|amend|train|machine learning|artificial intelligence|\bAI\b|personal data|personal information|consent|opt[- ]out)/gi;

/**
 * Pick the sentences worth showing the on-device AI (its context window is small),
 * keeping document order. Rule hits always make the cut, then keyword-dense sentences.
 */
export function selectCandidates(sentences: string[], maxChars: number): { id: number; text: string }[] {
  const scored = sentences.map((text, id) => {
    let score = 0;
    if (text.length >= 25 && text.length <= MAX_QUOTE) {
      score += (text.match(RELEVANT)?.length ?? 0) * 2;
      for (const rule of RULES) if (matchRule(rule, text)) score += 10;
    }
    return { id, text, score };
  });
  const picked: typeof scored = [];
  let used = 0;
  for (const s of scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)) {
    const cost = Math.min(s.text.length, 500) + 8;
    if (used + cost > maxChars) continue;
    picked.push(s);
    used += cost;
  }
  return picked.sort((a, b) => a.id - b.id).map(({ id, text }) => ({ id, text }));
}
