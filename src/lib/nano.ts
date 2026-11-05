/**
 * Thin wrapper over Chrome's built-in Prompt API (Gemini Nano). Free and on-device:
 * no account, no key, nothing leaves the computer.
 * Runs wherever `LanguageModel` is exposed: the service worker on recent Chrome,
 * otherwise the offscreen document.
 */

export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LMSession {
  prompt(input: string, opts?: { responseConstraint?: object; signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

interface LMStatic {
  availability(opts?: object): Promise<Availability>;
  create(opts?: {
    initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
    expectedInputs?: { type: 'text'; languages?: string[] }[];
    expectedOutputs?: { type: 'text'; languages?: string[] }[];
    monitor?: (m: EventTarget) => void;
    signal?: AbortSignal;
  }): Promise<LMSession>;
}

const LANG = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

function lm(): LMStatic | undefined {
  return (globalThis as unknown as { LanguageModel?: LMStatic }).LanguageModel;
}

export function hasPromptApi(): boolean {
  return !!lm();
}

export async function nanoAvailability(): Promise<Availability> {
  const api = lm();
  if (!api) return 'unavailable';
  try {
    return await api.availability(LANG);
  } catch {
    return 'unavailable';
  }
}

/** Run prompts one by one, each in a fresh session that shares the system prompt. */
export async function nanoPrompts(system: string, prompts: { text: string; schema: object }[]): Promise<string[]> {
  const api = lm();
  if (!api) throw new Error('This Chrome has no built-in AI');
  const state = await nanoAvailability();
  if (state !== 'available') throw new Error(`on-device AI is ${state}`);
  const out: string[] = [];
  for (const p of prompts) {
    // A fresh session per prompt keeps Nano's small context window from overflowing.
    const session = await api.create({ initialPrompts: [{ role: 'system', content: system }], ...LANG });
    try {
      out.push(await session.prompt(p.text, { responseConstraint: p.schema }));
    } finally {
      session.destroy();
    }
  }
  return out;
}

/** Starts the one-time model download. Needs a user click, so call it from the options page. */
export async function downloadNano(onProgress: (fraction: number) => void): Promise<void> {
  const api = lm();
  if (!api) throw new Error('This Chrome has no built-in AI. It needs Chrome 138 or newer on a supported computer.');
  const session = await api.create({
    ...LANG,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => onProgress((e as Event & { loaded: number }).loaded));
    },
  });
  session.destroy();
}
