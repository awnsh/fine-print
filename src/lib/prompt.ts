import { CATEGORY_LABELS, RULES } from './rules';
import type { FlagCategory, RedFlag, Tone } from './types';

const TONES: Record<Tone, string> = {
  0: 'polite and plain: calm, friendly, no jokes, just the facts in everyday words',
  1: 'dry: matter-of-fact with a light touch of wit',
  2: 'snarky: blunt, sarcastic, funny, like a friend who actually read it',
  3: 'savage: cutting, very sarcastic, roasts the company hard',
  4: 'unhinged: chaotic, dramatic, over-the-top roast energy, ALL CAPS allowed for one word, but still accurate',
};

const CATEGORIES = [...RULES.map((r) => r.category), 'other'] as const;

export function systemPrompt(tone: Tone): string {
  return [
    'You are Fine Print, a browser extension that reads Terms of Service, privacy policies and EULAs so people do not have to.',
    'You receive numbered sentences taken verbatim from one policy page.',
    '',
    'Your job:',
    '1. Pick the 3 to 5 clauses that are worst for the person agreeing (data selling or sharing, forced arbitration, class-action or jury waivers, auto-renewal, no refunds, account termination at will, broad licenses to user content, cross-site tracking, sensitive data collection, AI training on user data, changing terms without notice). Fewer is fine if the policy is mild.',
    '2. Cite each one by the number of the sentence that actually says it. Never invent or paraphrase a clause that is not in a numbered sentence.',
    '3. A sentence saying they do NOT do something ("we do not sell your data") is not a red flag.',
    '4. Write a label for each flag: plain English, second person, at most 8 words, e.g. "They can sell your data".',
    '5. Write one headline sentence (at most 25 words) about the single worst part.',
    '',
    `Tone for the headline and labels: ${TONES[tone]}.`,
    'Accuracy beats jokes: never exaggerate beyond what the cited sentences say.',
    'Severity per flag: 1 = mildly annoying, 2 = bad, 3 = seriously bad for the user.',
    'Never use emoji or hashtags. Write like a sharp human, not a chatbot: no "buckle up", no "let\'s dive in".',
    'Respond with JSON only.',
  ].join('\n');
}

export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'flags'],
  properties: {
    headline: { type: 'string' },
    flags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sentence_id', 'label', 'category', 'severity'],
        properties: {
          sentence_id: { type: 'integer' },
          label: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          severity: { type: 'integer', enum: [1, 2, 3] },
        },
      },
    },
  },
} as const;

export const HEADLINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline'],
  properties: { headline: { type: 'string' } },
} as const;

export function formatCandidates(c: { id: number; text: string }[]): string {
  return c.map(({ id, text }) => `[${id}] ${text.length > 500 ? text.slice(0, 500) + '…' : text}`).join('\n');
}

export function headlinePrompt(flags: RedFlag[], tone: Tone): string {
  return [
    'These red flags were found in one policy:',
    ...flags.map((f) => `- ${f.label}: "${f.quote.slice(0, 300)}"`),
    '',
    `Write ONE headline sentence (at most 25 words) about the single worst part. Tone: ${TONES[tone]}. Do not claim anything the quotes do not say. JSON only.`,
  ].join('\n');
}

/**
 * Turn model output into flags. The model answers with sentence numbers and the
 * quote is copied from our own extraction, so it can't put words in the policy's mouth.
 */
export function parseModelResult(
  raw: string,
  sentences: string[],
  allowedIds: Set<number>,
): { headline: string; flags: RedFlag[] } {
  const json = extractJson(raw) as { headline?: unknown; flags?: unknown };
  const headline = typeof json.headline === 'string' ? json.headline.trim() : '';
  const flags: RedFlag[] = [];
  const seen = new Set<number>();
  if (Array.isArray(json.flags)) {
    for (const f of json.flags as Record<string, unknown>[]) {
      const id = Number(f?.sentence_id);
      if (!Number.isInteger(id) || !allowedIds.has(id) || seen.has(id) || !sentences[id]) continue;
      seen.add(id);
      const category = (CATEGORIES as readonly string[]).includes(String(f.category)) ? (f.category as FlagCategory) : 'other';
      const w = Number(f.severity);
      const label = typeof f.label === 'string' && f.label.trim() ? f.label.trim().slice(0, 80) : CATEGORY_LABELS[category];
      flags.push({ category, label, quote: sentences[id], weight: w === 3 ? 3 : w === 1 ? 1 : 2 });
    }
  }
  return { headline: headline.slice(0, 240), flags };
}

export function extractJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('on-device AI did not return JSON');
  return JSON.parse(raw.slice(start, end + 1));
}
