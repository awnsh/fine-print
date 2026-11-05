/**
 * Test harness: fakes the bits of the `chrome` API the content script and
 * background router use, so the real content.js can run on a saved page in any
 * browser tab. Routes runtime messages straight into the background router.
 */
import { handleMessage } from '../src/background/router';
import type { BackgroundMessage, ContentMessage } from '../src/lib/types';

type Listener = (msg: unknown, sender: object, reply: (r: unknown) => void) => boolean | void;

// Persisted in sessionStorage so history survives navigating between test pages.
const saved = sessionStorage.getItem('fp-test-store');
const store: Record<string, unknown> = saved
  ? JSON.parse(saved)
  : { 'fp:settings': { useAi: true, tone: 2, autoAnalyze: true } };
const persist = () => sessionStorage.setItem('fp-test-store', JSON.stringify(store));
const contentListeners: Listener[] = [];

const pick = (keys: string | string[] | null) => {
  if (keys === null) return { ...store };
  const list = Array.isArray(keys) ? keys : [keys];
  return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
};

(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: 'fine-print-test',
    getURL: (p: string) => `/ext/${p}`,
    async sendMessage(msg: BackgroundMessage) {
      try {
        return { ok: true, data: structuredClone(await handleMessage(msg, { tab: { id: 1 } } as chrome.runtime.MessageSender)) };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    onMessage: { addListener: (l: Listener) => contentListeners.push(l) },
    openOptionsPage: () => location.assign('/ext/options/index.html'),
  },
  // Records the toolbar badge so tests can read it from window.__fp.badge.
  action: {
    setBadgeText: async ({ text }: { text: string }) => ((window as unknown as { __fpBadge: unknown }).__fpBadge = { ...(window as unknown as { __fpBadge?: object }).__fpBadge, text }),
    setBadgeBackgroundColor: async ({ color }: { color: string }) => ((window as unknown as { __fpBadge: unknown }).__fpBadge = { ...(window as unknown as { __fpBadge?: object }).__fpBadge, color }),
    setBadgeTextColor: async () => {},
    setTitle: async () => {},
  },
  // Enough for the popup to render. There is no real tab behind it, so the popup
  // is shown the most recent saved summary (or the empty state with ?empty).
  tabs: {
    query: async () => [{ id: 1, url: 'https://example.com/terms' }],
    sendMessage: async (_id: number, msg: ContentMessage) => {
      if (msg.type === 'highlight') return true;
      const index = (store['fp:cacheIndex'] as string[] | undefined) ?? [];
      const last = index.length && !location.search.includes('empty') ? store[index[index.length - 1]] : undefined;
      return last ? { status: 'done', isPolicy: true, analysis: last } : { status: 'idle', isPolicy: false };
    },
    create: async ({ url }: { url: string }) => window.open(url),
  },
  scripting: {
    executeScript: async () => {
      throw new Error('Not available in the test harness');
    },
  },
  storage: {
    local: {
      get: async (k: string | string[] | null) => pick(k),
      set: async (o: Record<string, unknown>) => {
        Object.assign(store, structuredClone(o));
        persist();
      },
      remove: async (k: string | string[]) => {
        (Array.isArray(k) ? k : [k]).forEach((x) => delete store[x]);
        persist();
      },
    },
    onChanged: { addListener() {} },
  },
};

/** Pretend to be the popup: send a message to the content script. */
function send(msg: ContentMessage): Promise<unknown> {
  return new Promise((resolve) => {
    for (const l of contentListeners) if (l(msg, {}, resolve) === true) return;
  });
}

(window as unknown as { __fp: unknown }).__fp = { send, store };
