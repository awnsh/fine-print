export type Severity = 'fine' | 'eh' | 'yikes';

/** Who wrote the summary: Chrome's free on-device AI, or the built-in rules. */
export type Engine = 'on-device' | 'rules';

/** 0 = polite … 4 = unhinged */
export type Tone = 0 | 1 | 2 | 3 | 4;

export type FlagCategory =
  | 'sells-data'
  | 'shares-data'
  | 'arbitration'
  | 'class-waiver'
  | 'auto-renew'
  | 'no-refunds'
  | 'terminate-anytime'
  | 'content-license'
  | 'tracking'
  | 'sensitive-data'
  | 'ai-training'
  | 'change-terms'
  | 'retention'
  | 'liability'
  | 'other';

export interface RedFlag {
  category: FlagCategory;
  /** Plain-English, second person, short. */
  label: string;
  /** Verbatim sentence from the page. Always copied from our own extraction, never written by the AI. */
  quote: string;
  /** 1 (meh) … 3 (bad) */
  weight: 1 | 2 | 3;
}

export interface Analysis {
  headline: string;
  flags: RedFlag[];
  severity: Severity;
  score: number;
  engine: Engine;
  /** Why on-device AI wasn't used, when it wasn't (e.g. not downloaded yet). */
  aiUnavailable?: string;
  url: string;
  domain: string;
  title: string;
  hash: string;
  at: number;
}

export interface Settings {
  /** Use Chrome's free on-device AI when it's available (rules otherwise). */
  useAi: boolean;
  tone: Tone;
  /** Read policy pages quietly in the background and show the result on the toolbar icon. */
  autoAnalyze: boolean;
}

export interface HistoryEntry {
  domain: string;
  url: string;
  title: string;
  headline: string;
  severity: Severity;
  flagCount: number;
  engine: Engine;
  at: number;
}

export interface AnalyzeRequest {
  type: 'analyze';
  url: string;
  domain: string;
  title: string;
  hash: string;
  sentences: string[];
  force?: boolean;
}

export type BackgroundMessage =
  | AnalyzeRequest
  | { type: 'getSettings' }
  | { type: 'setBadge'; severity?: Severity; count?: number; hint?: boolean }
  | { type: 'fetchPage'; url: string }
  | { type: 'clearCache' };

export type ContentMessage =
  | { type: 'getState' }
  | { type: 'roastNow'; force?: boolean }
  | { type: 'roastLinked' }
  | { type: 'highlight'; quote: string };

export interface ContentState {
  status: 'idle' | 'loading' | 'done' | 'error';
  isPolicy: boolean;
  analysis?: Analysis;
  /** True when `analysis` is for linked terms on another page (sign-up forms). */
  remote?: boolean;
  /** A terms link next to an "I agree" / "Sign up" button on this page. */
  linkedTerms?: { url: string; linkText: string };
  error?: string;
}
