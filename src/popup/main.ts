import { ENGINE_LABEL, SEVERITY_LABEL, h, timeAgo, truncate } from '../lib/dom';
import { icon, type IconName } from '../lib/icons';
import { clearHistory, getHistory } from '../lib/storage';
import { textFragmentUrl } from '../lib/text';
import type { Analysis, ContentMessage, ContentState } from '../lib/types';

const pagePanel = document.getElementById('panel-page')!;
const historyPanel = document.getElementById('panel-history')!;
const historyEl = document.getElementById('history')!;
const clearBtn = document.getElementById('clear-history') as HTMLButtonElement;
const tabPage = document.getElementById('tab-page') as HTMLButtonElement;
const tabHistory = document.getElementById('tab-history') as HTMLButtonElement;

document.querySelectorAll<HTMLImageElement>('.brand-logo').forEach((img) => (img.src = chrome.runtime.getURL('icons/icon-32.png')));
const settingsBtn = document.getElementById('settings')!;
settingsBtn.append(icon('settings'));
settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

function selectTab(which: 'page' | 'history'): void {
  tabPage.setAttribute('aria-selected', String(which === 'page'));
  tabHistory.setAttribute('aria-selected', String(which === 'history'));
  pagePanel.hidden = which !== 'page';
  historyPanel.hidden = which !== 'history';
  if (which === 'history') void renderHistory();
}
tabPage.addEventListener('click', () => selectTab('page'));
tabHistory.addEventListener('click', () => selectTab('history'));

let tabId: number | undefined;

async function sendToTab<T>(msg: ContentMessage): Promise<T> {
  if (tabId === undefined) throw new Error('No active tab');
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) as T;
  } catch {
    // Tab was open before the extension was installed: inject the content script, then retry.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return (await chrome.tabs.sendMessage(tabId, msg)) as T;
  }
}

function empty(glyph: IconName, title: string, body: string, action?: { label: string; icon?: IconName; run: () => void }): void {
  pagePanel.replaceChildren(
    h(
      'div',
      { class: 'empty' },
      h('div', { class: 'glyph' }, icon(glyph)),
      h('h2', {}, title),
      h('p', {}, body),
      action ? h('button', { class: 'btn', onclick: action.run }, action.icon ? icon(action.icon) : null, action.label) : null,
    ),
  );
}

function loading(text: string): void {
  pagePanel.replaceChildren(h('div', { class: 'loading', role: 'status' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), text));
}

function renderResult(a: Analysis, remote: boolean): void {
  const n = a.flags.length;
  const list = h('ol', { class: 'flags' });
  a.flags.forEach((f, i) => {
    const note = h('span', { class: 'note', 'aria-live': 'polite' });
    const btn = h(
      'button',
      {
        class: 'chip-btn',
        onclick: async () => {
          if (remote) {
            void chrome.tabs.create({ url: textFragmentUrl(a.url, f.quote) });
            return;
          }
          const ok = await sendToTab<boolean>({ type: 'highlight', quote: f.quote });
          note.textContent = ok ? 'Highlighted on the page' : 'Not visible on the page';
        },
      },
      icon(remote ? 'external' : 'locate'),
      remote ? 'Open in terms' : 'Show in page',
    );
    list.append(
      h(
        'li',
        { class: `flag w${f.weight}` },
        h('div', { class: 'flag-head' }, h('span', { class: 'num' }, String(i + 1)), h('span', { class: 'label' }, f.label)),
        h('p', { class: 'quote' }, truncate(f.quote, 160)),
        h('div', { class: 'actions' }, btn, note),
      ),
    );
  });

  const showTip = a.aiUnavailable && /downloadable|downloading/.test(a.aiUnavailable);
  const wrap = h(
    'div',
    { 'data-sev': a.severity },
    h(
      'div',
      { class: 'meta' },
      h('span', { class: 'risk' }, SEVERITY_LABEL[a.severity]),
      h('span', { class: 'site', title: a.url }, a.domain),
    ),
    h('h2', { class: 'headline' }, a.headline),
    n ? list : h('p', { class: 'muted' }, 'Nothing stood out. It may still be worth a skim.'),
    showTip
      ? h('div', { class: 'tip' }, icon('sparkle'), h('span', {}, 'Turn on Chrome’s free on-device AI in Settings for sharper summaries.'))
      : null,
    h(
      'div',
      { class: 'foot' },
      h('span', { class: 'engine', title: 'Nothing left your computer.' }, icon(a.engine === 'on-device' ? 'sparkle' : 'shield'), ENGINE_LABEL[a.engine]),
      h('button', { class: 'text-btn', onclick: () => void read(remote ? 'linked' : 'page', true) }, icon('refresh'), 'Read again'),
    ),
  );
  pagePanel.replaceChildren(wrap);
}

function render(s: ContentState): void {
  if (s.status === 'loading') return loading('Reading the fine print');
  if (s.status === 'error') {
    return empty('document', 'We couldn’t read this page', s.error ?? '', { label: 'Try again', icon: 'refresh', run: () => void read('page', true) });
  }
  if (s.status === 'done' && s.analysis) return renderResult(s.analysis, !!s.remote);
  if (s.linkedTerms) {
    return empty('document', 'This page asks you to agree to terms', `It links to “${truncate(s.linkedTerms.linkText || 'Terms', 50)}”. Read the short version before you sign up.`, {
      label: 'Summarize the terms',
      run: () => void read('linked'),
    });
  }
  return empty('document', 'No terms on this page', 'Open a Terms of Service or Privacy Policy and click Fine Print. You can also summarize any page.', {
    label: 'Summarize this page',
    run: () => void read('page'),
  });
}

async function read(what: 'page' | 'linked', force = false): Promise<void> {
  loading(what === 'linked' ? 'Fetching the terms' : 'Reading the fine print');
  try {
    render(await sendToTab<ContentState>(what === 'linked' ? { type: 'roastLinked' } : { type: 'roastNow', force }));
  } catch (e) {
    render({ status: 'error', isPolicy: false, error: e instanceof Error ? e.message : String(e) });
  }
}

async function renderHistory(): Promise<void> {
  const items = await getHistory();
  clearBtn.hidden = !items.length;
  if (!items.length) {
    historyEl.replaceChildren(h('li', { class: 'empty' }, h('p', {}, 'Policies you read will show up here.')));
    return;
  }
  historyEl.replaceChildren(
    ...items.map((it) =>
      h(
        'li',
        {},
        h(
          'button',
          { title: it.url, 'data-sev': it.severity, onclick: () => chrome.tabs.create({ url: it.url }) },
          h('span', { class: 'dot', 'aria-label': SEVERITY_LABEL[it.severity] }),
          h('span', { class: 'dom' }, it.domain),
          h('span', { class: 'when' }, timeAgo(it.at)),
          h('span', { class: 'hl' }, it.headline),
        ),
      ),
    ),
  );
}

clearBtn.addEventListener('click', async () => {
  await clearHistory();
  void renderHistory();
});

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  if (!tab?.url || !/^https?:/.test(tab.url)) {
    empty('document', 'Nothing to read here', 'Fine Print works on regular web pages.');
    return;
  }
  try {
    const s = await sendToTab<ContentState>({ type: 'getState' });
    // Clicking the icon on a policy page means "show me": start reading if it hasn't yet.
    if (s.isPolicy && (s.status === 'idle' || s.status === 'loading')) return void read('page');
    render(s);
  } catch (e) {
    empty('document', 'Can’t read this page', e instanceof Error ? e.message : String(e));
  }
}

void init();
