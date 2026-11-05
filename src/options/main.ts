import { h } from '../lib/dom';
import { icon } from '../lib/icons';
import { bg } from '../lib/messaging';
import { downloadNano, nanoAvailability } from '../lib/nano';
import { rulesHeadline } from '../lib/rules';
import { getSettings, saveSettings } from '../lib/storage';
import type { RedFlag, Settings, Tone } from '../lib/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

document.querySelectorAll<HTMLImageElement>('.brand-logo').forEach((img) => (img.src = chrome.runtime.getURL('icons/icon-128.png')));

const toastEl = $<HTMLDivElement>('toast');
let toastTimer: number | undefined;
function toast(msg: string): void {
  toastEl.replaceChildren(icon('check'), msg);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1400);
}

async function save(patch: Partial<Settings>): Promise<Settings> {
  const s = await saveSettings(patch);
  toast('Saved');
  return s;
}

// ---- Background reading ----------------------------------------------------
const autoAnalyze = $<HTMLInputElement>('auto-analyze');
autoAnalyze.addEventListener('change', () => void save({ autoAnalyze: autoAnalyze.checked }));

// ---- On-device AI ----------------------------------------------------------
const useAi = $<HTMLInputElement>('use-ai');
const nanoStatus = $<HTMLParagraphElement>('nano-status');
const nanoBtn = $<HTMLButtonElement>('nano-download');
nanoBtn.replaceChildren(icon('sparkle'), 'Download model (about 2 GB)');

async function refreshNano(): Promise<void> {
  const state = await nanoAvailability();
  nanoBtn.hidden = state !== 'downloadable';
  nanoStatus.classList.toggle('ok', state === 'available');
  const text = {
    available: 'Ready on this computer.',
    downloadable: 'Needs a one-time download. Until then, the built-in rules are used.',
    downloading: 'Downloading. The built-in rules are used until it finishes.',
    unavailable: 'Not supported by this Chrome or computer, so the built-in rules are used.',
  }[state];
  nanoStatus.replaceChildren(...(state === 'available' ? [icon('check'), text] : [text]));
}

useAi.addEventListener('change', async () => {
  await save({ useAi: useAi.checked });
  await bg({ type: 'clearCache' });
});

nanoBtn.addEventListener('click', async () => {
  nanoBtn.setAttribute('disabled', '');
  try {
    await downloadNano((f) => (nanoStatus.textContent = `Downloading ${Math.round(f * 100)}%`));
    toast('Model ready');
    await bg({ type: 'clearCache' }); // re-read pages with the AI next time
  } catch (e) {
    nanoStatus.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    nanoBtn.removeAttribute('disabled');
    void refreshNano();
  }
});

// ---- Tone ------------------------------------------------------------------
const TONE_NAMES = ['Polite', 'Dry', 'Snarky', 'Savage', 'Unhinged'];
const SAMPLE_FLAGS: RedFlag[] = [
  { category: 'sells-data', label: '', quote: '', weight: 3 },
  { category: 'arbitration', label: '', quote: '', weight: 3 },
];
const toneGroup = $<HTMLDivElement>('tone');
const sample = $<HTMLParagraphElement>('tone-sample');

function buildTone(current: Tone): void {
  toneGroup.replaceChildren(
    ...TONE_NAMES.map((name, i) => {
      const input = h('input', { type: 'radio', name: 'tone', value: String(i), 'aria-label': name });
      input.checked = i === current;
      input.addEventListener('change', async () => {
        const t = i as Tone;
        sample.textContent = rulesHeadline(SAMPLE_FLAGS, t);
        await save({ tone: t });
        // Saved summaries carry the old tone's headline, so drop them.
        await bg({ type: 'clearCache' });
      });
      return h('label', {}, input, h('span', {}, name));
    }),
  );
  sample.textContent = rulesHeadline(SAMPLE_FLAGS, current);
}

// ---- Cache -----------------------------------------------------------------
$('clear-cache').addEventListener('click', async () => {
  await bg({ type: 'clearCache' });
  $('cache-status').textContent = 'Cleared. Pages will be read fresh next time.';
});

// ---- Init ------------------------------------------------------------------
async function init(): Promise<void> {
  const s = await getSettings();
  autoAnalyze.checked = s.autoAnalyze;
  useAi.checked = s.useAi;
  void refreshNano();
  buildTone(s.tone);
}

void init();
