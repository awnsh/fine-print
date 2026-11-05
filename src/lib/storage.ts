import type { Analysis, HistoryEntry, Settings } from './types';

const SETTINGS_KEY = 'fp:settings';
const HISTORY_KEY = 'fp:history';
const CACHE_INDEX_KEY = 'fp:cacheIndex';
const CACHE_PREFIX = 'fp:cache:';
const MAX_HISTORY = 20;
const MAX_CACHE = 100;

export const DEFAULT_SETTINGS: Settings = {
  useAi: true,
  tone: 2,
  autoAnalyze: true,
};

const local = () => chrome.storage.local;

export async function getSettings(): Promise<Settings> {
  const { [SETTINGS_KEY]: s } = await local().get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(s as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await local().set({ [SETTINGS_KEY]: next });
  return next;
}

export function cacheKey(domain: string, hash: string): string {
  return `${CACHE_PREFIX}${domain}:${hash}`;
}

export async function getCached(domain: string, hash: string): Promise<Analysis | undefined> {
  const key = cacheKey(domain, hash);
  const { [key]: v } = await local().get(key);
  return v as Analysis | undefined;
}

export async function putCached(a: Analysis): Promise<void> {
  const key = cacheKey(a.domain, a.hash);
  const { [CACHE_INDEX_KEY]: idx } = await local().get(CACHE_INDEX_KEY);
  const index = ((idx as string[] | undefined) ?? []).filter((k) => k !== key);
  index.push(key);
  const evicted = index.splice(0, Math.max(0, index.length - MAX_CACHE));
  if (evicted.length) await local().remove(evicted);
  await local().set({ [key]: a, [CACHE_INDEX_KEY]: index });
}

export async function clearCache(): Promise<void> {
  const all = await local().get(null);
  await local().remove(Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX) || k === CACHE_INDEX_KEY));
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const { [HISTORY_KEY]: h } = await local().get(HISTORY_KEY);
  return (h as HistoryEntry[] | undefined) ?? [];
}

export async function pushHistory(a: Analysis): Promise<void> {
  const entry: HistoryEntry = {
    domain: a.domain,
    url: a.url,
    title: a.title,
    headline: a.headline,
    severity: a.severity,
    flagCount: a.flags.length,
    engine: a.engine,
    at: Date.now(),
  };
  const rest = (await getHistory()).filter((h) => h.url !== a.url);
  await local().set({ [HISTORY_KEY]: [entry, ...rest].slice(0, MAX_HISTORY) });
}

export async function clearHistory(): Promise<void> {
  await local().remove(HISTORY_KEY);
}
