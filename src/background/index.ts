import type { BackgroundMessage } from '../lib/types';
import { handleMessage } from './router';

chrome.runtime.onMessage.addListener((msg: BackgroundMessage & { target?: string }, sender, reply) => {
  if (msg?.target === 'offscreen') return false; // meant for the offscreen document
  // Only our own extension's contexts may talk to the service worker.
  if (sender.id !== chrome.runtime.id) return false;
  handleMessage(msg, sender)
    .then((data) => reply({ ok: true, data }))
    .catch((e: unknown) => reply({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
