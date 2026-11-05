/**
 * Content script. Never draws anything on the page by itself: it reads policy
 * pages quietly, reports a risk count for the toolbar badge, and answers the popup.
 */
import { bg } from '../lib/messaging';
import { hashText } from '../lib/text';
import type { Analysis, ContentMessage, ContentState, Settings } from '../lib/types';
import { findAgreeTerms } from './agree';
import { detectPolicy, extractSentences } from './extract';
import { clearHighlight, highlightQuote } from './highlight';

declare global {
  interface Window {
    __finePrintLoaded?: boolean;
  }
}

const state: ContentState = { status: 'idle', isPolicy: false };
/** Bumped on every navigation so late results from the old page are dropped. */
let generation = 0;
let running: Promise<ContentState> | null = null;

const domain = (host = location.hostname) => host.replace(/^www\./, '');

function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return /Extension context invalidated/i.test(msg) ? 'Fine Print was updated. Reload this page to use it again.' : msg;
}

function updateBadge(): void {
  const a = state.analysis;
  const msg = a && !state.remote
    ? { type: 'setBadge' as const, severity: a.severity, count: a.flags.length }
    : { type: 'setBadge' as const, hint: !!state.linkedTerms && !a };
  void bg(msg).catch(() => {});
}

/** Summarize the current page. */
function readThisPage(force = false): Promise<ContentState> {
  if (running && !force) return running;
  const gen = generation;
  state.status = 'loading';
  running = (async () => {
    try {
      const sentences = extractSentences(document);
      if (sentences.join(' ').length < 400) throw new Error('There isn’t enough text on this page to summarize.');
      const analysis = await bg<Analysis>({
        type: 'analyze',
        url: location.href.split('#')[0],
        domain: domain(),
        title: document.title,
        hash: hashText(sentences.join('\n')),
        sentences,
        force,
      });
      if (gen !== generation) return state;
      Object.assign(state, { status: 'done', analysis, remote: false, error: undefined });
    } catch (e) {
      if (gen !== generation) return state;
      Object.assign(state, { status: 'error', error: errorMessage(e) });
    }
    updateBadge();
    return state;
  })().finally(() => (running = null));
  return running;
}

/** Summarize terms linked from a sign-up form on this page (only when the popup asks). */
async function readLinkedTerms(): Promise<ContentState> {
  const hit = state.linkedTerms;
  if (!hit) return state;
  const gen = generation;
  state.status = 'loading';
  try {
    const { html, url } = await bg<{ html: string; url: string }>({ type: 'fetchPage', url: hit.url });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sentences = extractSentences(doc);
    if (sentences.join(' ').length < 400) {
      throw new Error('Those terms load their text with JavaScript, so they can’t be read from here. Open the terms page and click Fine Print there.');
    }
    const analysis = await bg<Analysis>({
      type: 'analyze',
      url: url.split('#')[0],
      domain: domain(new URL(url).hostname),
      title: doc.title || hit.linkText,
      hash: hashText(sentences.join('\n')),
      sentences,
    });
    if (gen !== generation) return state;
    Object.assign(state, { status: 'done', analysis, remote: true, error: undefined });
  } catch (e) {
    if (gen !== generation) return state;
    Object.assign(state, { status: 'error', error: errorMessage(e) });
  }
  return state;
}

async function check(): Promise<void> {
  const gen = generation;
  const settings = await bg<Settings>({ type: 'getSettings' });
  const sentences = extractSentences(document);
  const det = detectPolicy(document, location, sentences);
  if (gen !== generation) return;
  state.isPolicy = det.isPolicy;
  if (!det.isPolicy && !state.linkedTerms) {
    const hit = findAgreeTerms(document);
    if (hit) state.linkedTerms = hit;
  }
  if (det.isPolicy && settings.autoAnalyze && state.status === 'idle') {
    await readThisPage();
  } else {
    updateBadge();
  }
}

/** SPAs and slow pages render text late: look again a couple of times. */
function scheduleChecks(): void {
  const gen = generation;
  const run = () => {
    if (gen === generation && !state.isPolicy) void check().catch(() => {});
  };
  run();
  setTimeout(run, 2000);
  setTimeout(run, 5000);
}

function onNavigate(): void {
  generation++;
  clearHighlight();
  running = null;
  for (const k of ['analysis', 'remote', 'linkedTerms', 'error'] as const) delete state[k];
  state.status = 'idle';
  state.isPolicy = false;
  updateBadge();
  scheduleChecks();
}

function onMessage(msg: ContentMessage, _sender: chrome.runtime.MessageSender, reply: (r: unknown) => void): boolean {
  switch (msg?.type) {
    case 'getState':
      reply(state);
      return false;
    case 'roastNow':
      void readThisPage(msg.force).then(reply);
      return true;
    case 'roastLinked':
      void readLinkedTerms().then(reply);
      return true;
    case 'highlight':
      reply(highlightQuote(msg.quote));
      return false;
  }
  return false;
}

// Guard: the popup may inject this script into tabs that were open before install.
if (!window.__finePrintLoaded) {
  window.__finePrintLoaded = true;
  chrome.runtime.onMessage.addListener(onMessage);
  let lastUrl = location.href.split('#')[0];
  setInterval(() => {
    const now = location.href.split('#')[0];
    if (now !== lastUrl) {
      lastUrl = now;
      onNavigate();
    }
  }, 1000);
  scheduleChecks();
}
