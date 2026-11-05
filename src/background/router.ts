import { analyzeWithRules, rulesHeadline, scoreFlags } from '../lib/rules';
import { clearCache, getCached, getSettings, pushHistory, putCached } from '../lib/storage';
import type { Analysis, AnalyzeRequest, BackgroundMessage, Engine, RedFlag } from '../lib/types';
import { analyzeOnDevice } from './nano-engine';

/** In-flight analyses, so two tabs on the same policy share one AI run. */
const inflight = new Map<string, Promise<Analysis>>();

async function analyze(req: AnalyzeRequest): Promise<Analysis> {
  if (!req.force) {
    const hit = await getCached(req.domain, req.hash);
    if (hit) {
      await pushHistory(hit);
      return hit;
    }
  }
  const key = `${req.domain}:${req.hash}`;
  let p = inflight.get(key);
  if (!p) {
    p = runAnalysis(req).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

async function runAnalysis(req: AnalyzeRequest): Promise<Analysis> {
  const settings = await getSettings();
  let engine: Engine = 'rules';
  let headline = '';
  let flags: RedFlag[] = [];
  let aiUnavailable: string | undefined;

  if (settings.useAi) {
    try {
      ({ headline, flags } = await analyzeOnDevice(req.sentences, settings.tone));
      engine = 'on-device';
    } catch (e) {
      aiUnavailable = e instanceof Error ? e.message : String(e);
    }
  }

  const ruleFlags = analyzeWithRules(req.sentences);
  if (engine === 'rules') {
    flags = ruleFlags;
  } else if (!flags.length && ruleFlags.length) {
    // The AI found nothing but the rules did: trust the receipts.
    flags = ruleFlags;
    headline = '';
  }
  if (!headline) headline = rulesHeadline(flags, settings.tone);

  const { score, severity } = scoreFlags(flags);
  const analysis: Analysis = {
    headline,
    flags,
    severity,
    score,
    engine,
    aiUnavailable,
    url: req.url,
    domain: req.domain,
    title: req.title,
    hash: req.hash,
    at: Date.now(),
  };
  // A rules result caused by the AI not being ready isn't cached, so the AI gets a go next time.
  if (!aiUnavailable) await putCached(analysis);
  await pushHistory(analysis);
  return analysis;
}

const MAX_FETCH_BYTES = 3_000_000;

/** Fetches a terms page linked from a sign-up form (content scripts can't fetch cross-origin). */
async function fetchPage(url: string): Promise<{ html: string; url: string }> {
  const u = new URL(url);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only web pages can be fetched');
  const res = await fetch(u, { credentials: 'omit', redirect: 'follow' });
  if (!res.ok) throw new Error(`Fetching the terms failed (${res.status})`);
  const type = res.headers.get('content-type') ?? '';
  if (!/html|text\/plain/i.test(type)) throw new Error('The terms link is not a web page (maybe a PDF?)');
  const html = await res.text();
  return { html: html.slice(0, MAX_FETCH_BYTES), url: res.url };
}

const BADGE_COLOR = { fine: '#10a37f', eh: '#c98a00', yikes: '#d93d42' } as const;
const BADGE_TITLE = { fine: 'Fine Print: low risk', eh: 'Fine Print: some risk', yikes: 'Fine Print: high risk' } as const;

/** The only on-page signal: a small count on the toolbar icon. Nothing pops up. */
async function setBadge(tabId: number | undefined, msg: Extract<BackgroundMessage, { type: 'setBadge' }>): Promise<void> {
  if (tabId === undefined) return;
  if (msg.severity) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR[msg.severity] });
    await chrome.action.setBadgeTextColor?.({ tabId, color: '#ffffff' });
    await chrome.action.setBadgeText({ tabId, text: String(msg.count ?? '') || ' ' });
    await chrome.action.setTitle({ tabId, title: `${BADGE_TITLE[msg.severity]} (${msg.count ?? 0} issues). Click for details.` });
  } else if (msg.hint) {
    // A sign-up form with a terms link: a quiet neutral dot, details in the popup.
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#8f8f8f' });
    await chrome.action.setBadgeText({ tabId, text: ' ' });
    await chrome.action.setTitle({ tabId, title: 'Fine Print: this page links to terms you may be agreeing to. Click to summarize.' });
  } else {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'Fine Print' });
  }
}

export async function handleMessage(msg: BackgroundMessage, sender?: chrome.runtime.MessageSender): Promise<unknown> {
  switch (msg.type) {
    case 'analyze':
      return analyze(msg);
    case 'getSettings':
      return getSettings();
    case 'setBadge':
      await setBadge(sender?.tab?.id, msg);
      return true;
    case 'fetchPage':
      return fetchPage(msg.url);
    case 'clearCache':
      await clearCache();
      return true;
  }
}
