import type { NanoJob } from '../background/nano-engine';
import { nanoPrompts } from '../lib/nano';

// Hosts Gemini Nano when the service worker itself has no Prompt API.
chrome.runtime.onMessage.addListener((msg: { target?: string; type?: string; job?: NanoJob }, _sender, reply) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'nano' || !msg.job) return false;
  nanoPrompts(msg.job.system, msg.job.prompts)
    .then((outputs) => reply({ ok: true, outputs }))
    .catch((e: unknown) => reply({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true;
});
