import type { BackgroundMessage } from './types';

/** Send to the service worker and unwrap `{ ok, data | error }`. */
export async function bg<T>(msg: BackgroundMessage): Promise<T> {
  const res = (await chrome.runtime.sendMessage(msg)) as { ok: boolean; data?: T; error?: string } | undefined;
  if (!res) throw new Error('Fine Print background did not respond');
  if (!res.ok) throw new Error(res.error ?? 'Unknown error');
  return res.data as T;
}
