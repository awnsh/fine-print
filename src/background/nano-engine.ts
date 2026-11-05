import { hasPromptApi, nanoPrompts } from '../lib/nano';
import { HEADLINE_SCHEMA, RESULT_SCHEMA, extractJson, formatCandidates, headlinePrompt, parseModelResult, systemPrompt } from '../lib/prompt';
import { selectCandidates } from '../lib/rules';
import type { RedFlag, Tone } from '../lib/types';

/** Gemini Nano has a small context window, so keep chunks short. */
const CHUNK_CHARS = 3_500;
const MAX_CHUNKS = 4;

export interface NanoJob {
  system: string;
  prompts: { text: string; schema: object }[];
}

/** Runs prompts in the service worker if it has the Prompt API, else in the offscreen document. */
async function runJob(job: NanoJob): Promise<string[]> {
  if (hasPromptApi()) return nanoPrompts(job.system, job.prompts);
  await ensureOffscreen();
  const res = (await chrome.runtime.sendMessage({ target: 'offscreen', type: 'nano', job })) as
    | { ok: true; outputs: string[] }
    | { ok: false; error: string }
    | undefined;
  if (!res) throw new Error('offscreen document did not answer');
  if (!res.ok) throw new Error(res.error);
  return res.outputs;
}

let creating: Promise<void> | undefined;
async function ensureOffscreen(): Promise<void> {
  const url = chrome.runtime.getURL('offscreen/index.html');
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [url],
  });
  if (existing.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run the free on-device Gemini Nano model to summarize policy pages locally.',
    })
    .finally(() => (creating = undefined));
  await creating;
}

export async function analyzeOnDevice(sentences: string[], tone: Tone): Promise<{ headline: string; flags: RedFlag[] }> {
  const candidates = selectCandidates(sentences, CHUNK_CHARS * MAX_CHUNKS);
  if (!candidates.length) return { headline: '', flags: [] };

  const chunks: (typeof candidates)[] = [];
  let cur: typeof candidates = [];
  let n = 0;
  for (const c of candidates) {
    const len = Math.min(c.text.length, 500) + 8;
    if (n + len > CHUNK_CHARS && cur.length) {
      chunks.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(c);
    n += len;
  }
  if (cur.length) chunks.push(cur);

  const system = systemPrompt(tone);
  const outputs = await runJob({
    system,
    prompts: chunks.map((part) => ({ text: `Policy sentences:\n${formatCandidates(part)}`, schema: RESULT_SCHEMA })),
  });
  const results = outputs.map((raw, i) => parseModelResult(raw, sentences, new Set(chunks[i].map((c) => c.id))));
  // Each chunk reports its own worst clauses, so the same kind can come back several
  // times: keep the heaviest one per category ("other" can repeat), then the top 5.
  const seen = new Set<string>();
  const flags = results
    .flatMap((r) => r.flags)
    .sort((a, b) => b.weight - a.weight)
    .filter((f) => f.category === 'other' || (!seen.has(f.category) && !!seen.add(f.category)))
    .slice(0, 5);
  if (results.length === 1 || !flags.length) return { headline: results[0]?.headline ?? '', flags };

  // Several chunks: write one headline over the merged flags.
  const [raw] = await runJob({ system, prompts: [{ text: headlinePrompt(flags, tone), schema: HEADLINE_SCHEMA }] });
  const headline = String((extractJson(raw) as { headline?: string }).headline ?? '');
  return { headline, flags };
}
