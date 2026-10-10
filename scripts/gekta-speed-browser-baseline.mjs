#!/usr/bin/env node

import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MEANINGFUL_TEXT_THRESHOLD,
  MULTI_TURN_SCENARIOS,
  SPEED_CORPUS,
  captureDeployedRevision,
  groupBy,
  parseArgs,
  percentile,
  probeContour,
  renderSummary,
  summarize,
  summarizeMultiTurn,
  waveIsHealthy,
} from './tai-speed-baseline.mjs';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const DEFAULT_TIMEOUT_MS = 150_000;
const DEFAULT_COOLDOWN_MS = 15_000;

function reservationPercentiles(samples) {
  const values = samples.map((sample) => sample.reservationMs).filter(Number.isFinite);
  return {
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
}

function summarizeWave(samples) {
  return { ...summarize(samples), reservationMs: reservationPercentiles(samples) };
}

export async function prepareAnonymousPage(browser, baseUrl, label = 'speed') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl.replace(/\/+$/u, '')}/gekta?speed=${encodeURIComponent(label)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.locator('[data-gekta-chat-workspace="true"]').waitFor({ state: 'visible', timeout: 30_000 });
  const prepared = await page.evaluate(async () => {
    const current = await fetch('/api/gekta/entitlement', { cache: 'no-store', credentials: 'same-origin' });
    if (!current.ok) return { ok: false, error: `entitlement_${current.status}` };
    const payload = await current.json().catch(() => null);
    if (!payload || typeof payload.legalVersion !== 'string') return { ok: false, error: 'legal_version_missing' };
    if (payload.consent?.version !== payload.legalVersion) {
      const accepted = await fetch('/api/gekta/entitlement', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consent' }),
      });
      const body = await accepted.json().catch(() => null);
      if (!accepted.ok || body?.consent?.version !== payload.legalVersion) {
        return { ok: false, error: `consent_${accepted.status}` };
      }
    }
    return { ok: true, error: null };
  });
  if (!prepared.ok) {
    await context.close();
    throw new Error(prepared.error || 'anonymous_prepare_failed');
  }
  return { context, page };
}

export async function measurePreparedPage(page, {
  question,
  locale,
  history = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  conversationId = `speed-${Date.now()}`,
}) {
  return page.evaluate(async ({ question, locale, history, timeoutMs, conversationId, meaningfulThreshold }) => {
    const round = (value) => Number(value.toFixed(1));
    const meaningfulLength = (text) => {
      const withoutMarkers = String(text ?? '').replace(/<\/?(?:think(?:ing)?|analysis|reasoning|scratchpad|tool[^>]*|debug)[^>]*>|<\|[^|>]{1,64}\|>/giu, '');
      let count = 0;
      for (const character of withoutMarkers) if (/[\p{L}\p{N}]/u.test(character)) count += 1;
      return count;
    };
    const readFrame = (rawFrame) => {
      const dataLine = rawFrame.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) return null;
      try { return JSON.parse(dataLine.slice(5).trim()); } catch { return null; }
    };
    const failed = (error, reservationMs = null) => ({
      question,
      locale,
      ok: false,
      error,
      headersMs: null,
      firstTokenMs: null,
      firstMeaningfulTextMs: null,
      completedMs: null,
      answerChars: 0,
      meaningfulChars: 0,
      tokenFrames: 0,
      charsPerSecond: null,
      source: null,
      answerMode: null,
      streaming: null,
      modelBacked: false,
      answerText: '',
      reservationMs,
    });

    const startedAt = performance.now();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    let ticket = '';
    let reservationMs = null;
    try {
      const reservation = await fetch('/api/gekta/entitlement', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reserve' }),
        signal: controller.signal,
      });
      const reservationBody = await reservation.json().catch(() => null);
      reservationMs = round(performance.now() - startedAt);
      if (!reservation.ok || reservationBody?.allowed !== true || typeof reservationBody?.ticket !== 'string') {
        return failed(`reservation_http_${reservation.status}`, reservationMs);
      }
      ticket = reservationBody.ticket;

      const response = await fetch('/api/agro-chat?stream=1', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'x-gekta-answer-ticket': ticket,
        },
        body: JSON.stringify({ message: question, locale, context: 'gekta-standalone', conversationId, history }),
        signal: controller.signal,
      });
      const sample = failed(null, reservationMs);
      sample.headersMs = round(performance.now() - startedAt);
      if (!response.ok) {
        sample.error = `http_${response.status}`;
        return sample;
      }
      if (!response.body) {
        sample.error = 'no_stream_body';
        return sample;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let visible = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let boundary = pending.indexOf('\n\n');
        while (boundary >= 0) {
          const rawFrame = pending.slice(0, boundary);
          pending = pending.slice(boundary + 2);
          boundary = pending.indexOf('\n\n');
          const event = readFrame(rawFrame);
          if (!event) continue;
          if (event.event === 'error') {
            sample.error = String(event.refusal || 'stream_error');
            continue;
          }
          if (event.event === 'assessment') {
            try {
              const assessment = JSON.parse(String(event.summary || '{}'));
              sample.source = typeof assessment.source === 'string' ? assessment.source : null;
              sample.answerMode = typeof assessment.answerMode === 'string' ? assessment.answerMode : null;
              sample.streaming = typeof assessment.streaming === 'string' ? assessment.streaming : null;
              sample.modelBacked = sample.source === 'local_qwen';
            } catch {
              sample.source = 'unparsed_assessment';
            }
            continue;
          }
          if (event.event !== 'token' || typeof event.text !== 'string') continue;
          if (sample.firstTokenMs === null) sample.firstTokenMs = round(performance.now() - startedAt);
          sample.tokenFrames += 1;
          visible += event.text;
          if (sample.firstMeaningfulTextMs === null && meaningfulLength(visible) >= meaningfulThreshold) {
            sample.firstMeaningfulTextMs = round(performance.now() - startedAt);
          }
        }
      }

      sample.completedMs = round(performance.now() - startedAt);
      sample.answerText = visible;
      sample.answerChars = visible.length;
      sample.meaningfulChars = meaningfulLength(visible);
      sample.ok = sample.error === null && sample.firstMeaningfulTextMs !== null;
      if (!sample.ok && !sample.error) sample.error = sample.firstTokenMs === null ? 'no_text_emitted' : 'no_meaningful_text';
      if (sample.ok && sample.completedMs > 0) sample.charsPerSecond = round((sample.answerChars / sample.completedMs) * 1000);

      if (sample.ok) {
        void fetch('/api/gekta/entitlement', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete', ticket }),
        }).catch(() => undefined);
      }
      return sample;
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      return failed(aborted ? 'timeout' : `request_failed:${error instanceof Error ? error.message : 'unknown'}`, reservationMs);
    } finally {
      window.clearTimeout(timer);
    }
  }, { question, locale, history, timeoutMs, conversationId, meaningfulThreshold: MEANINGFUL_TEXT_THRESHOLD });
}

async function runWave(browser, cases, concurrency, options) {
  const results = [];
  for (let offset = 0; offset < cases.length; offset += concurrency) {
    const batch = cases.slice(offset, offset + concurrency);
    const prepared = await Promise.all(batch.map(async (item, index) => {
      try {
        const surface = await prepareAnonymousPage(browser, options.baseUrl, `${options.label}-${offset + index}`);
        return { item, surface, error: null };
      } catch (error) {
        return { item, surface: null, error: `bootstrap_failed:${error?.message || 'unknown'}` };
      }
    }));

    const rows = await Promise.all(prepared.map(async ({ item, surface, error }, index) => {
      if (!surface) {
        return {
          question: item.question,
          locale: item.locale,
          ok: false,
          error,
          headersMs: null,
          firstTokenMs: null,
          firstMeaningfulTextMs: null,
          completedMs: null,
          answerChars: 0,
          meaningfulChars: 0,
          tokenFrames: 0,
          charsPerSecond: null,
          source: null,
          answerMode: null,
          streaming: null,
          modelBacked: false,
          reservationMs: null,
          id: item.id,
          type: item.type,
        };
      }
      try {
        const sample = await measurePreparedPage(surface.page, {
          question: item.question,
          locale: item.locale,
          timeoutMs: options.timeoutMs,
          conversationId: `${options.label}-${offset + index}`,
        });
        const { answerText, ...rest } = sample;
        void answerText;
        return { ...rest, id: item.id, type: item.type };
      } finally {
        await surface.context.close().catch(() => undefined);
      }
    }));
    results.push(...rows);
  }
  return results;
}

async function runMultiTurn(browser, scenarios, options) {
  const results = [];
  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
    const scenario = scenarios[scenarioIndex];
    const surface = await prepareAnonymousPage(browser, options.baseUrl, `${options.label}-mt-${scenarioIndex}`);
    const history = [];
    const turns = [];
    try {
      for (let index = 0; index < scenario.turns.length; index += 1) {
        const question = scenario.turns[index];
        const sample = await measurePreparedPage(surface.page, {
          question,
          locale: scenario.locale,
          history: [...history],
          timeoutMs: options.timeoutMs,
          conversationId: `${options.label}-mt-${scenarioIndex}`,
        });
        const { answerText, ...rest } = sample;
        turns.push({ ...rest, turn: index + 1 });
        history.push({ role: 'user', text: question });
        if (answerText) history.push({ role: 'assistant', text: answerText });
        await delay(250);
      }
    } finally {
      await surface.context.close().catch(() => undefined);
    }
    results.push({ id: scenario.id, kind: scenario.kind, locale: scenario.locale, turns });
  }
  return results;
}

export function renderBrowserSummary(report) {
  const lines = [renderSummary(report), '', 'reservation latency is INCLUDED in user-visible TTFT'];
  for (const wave of report?.singleTurn || []) {
    lines.push(`concurrency ${wave.concurrency} reservation p50 ms: ${wave.overall?.reservationMs?.p50 ?? 'not measured'}`);
    lines.push(`concurrency ${wave.concurrency} reservation p95 ms: ${wave.overall?.reservationMs?.p95 ?? 'not measured'}`);
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summarizePath = args.get('summarize');
  if (summarizePath) {
    const report = JSON.parse(await readFile(summarizePath, 'utf8'));
    process.stdout.write(`${renderBrowserSummary(report)}\n`);
    return;
  }

  const baseUrl = args.get('base-url');
  if (!baseUrl) process.exit(2);
  const locales = (args.get('locales') || 'ru,en,zh').split(',').map((value) => value.trim()).filter(Boolean);
  const concurrencies = (args.get('concurrency') || '1,2,4').split(',').map((value) => Number(value.trim())).filter((value) => value > 0);
  const repeat = Math.max(1, Number(args.get('repeat') || '1'));
  const timeoutMs = Number(args.get('timeout-ms') || DEFAULT_TIMEOUT_MS);
  const cooldownMs = Number(args.get('cooldown-ms') || DEFAULT_COOLDOWN_MS);
  const cases = SPEED_CORPUS.filter((item) => locales.includes(item.locale));
  if (!cases.length) process.exit(2);

  const probe = await probeContour({ baseUrl });
  const revision = await captureDeployedRevision({ baseUrl, mainSha: args.get('main-sha') || null });
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true });
  const waves = [];
  let multiTurn = null;
  try {
    for (const concurrency of concurrencies) {
      const previous = waves[waves.length - 1];
      if (previous && !waveIsHealthy(previous.overall)) break;
      if (previous) await delay(cooldownMs);
      const repeated = Array.from({ length: repeat }, () => cases).flat();
      const samples = await runWave(browser, repeated, concurrency, {
        baseUrl,
        timeoutMs,
        label: `run-${Date.now()}-c${concurrency}`,
      });
      waves.push({
        concurrency,
        overall: summarizeWave(samples),
        byType: groupBy(samples, 'type'),
        byLocale: groupBy(samples, 'locale'),
        bySource: groupBy(samples, 'source'),
        samples,
      });
    }
    if (args.get('skip-multi-turn') !== 'true') {
      const scenarios = await runMultiTurn(browser, MULTI_TURN_SCENARIOS, {
        baseUrl,
        timeoutMs,
        label: `run-${Date.now()}`,
      });
      multiTurn = { scenarios, byKind: summarizeMultiTurn(scenarios) };
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const report = {
    tool: 'gekta-speed-browser-baseline',
    version: 3,
    startedAt,
    finishedAt: new Date().toISOString(),
    target: new URL('/api/agro-chat?stream=1', baseUrl).toString(),
    revision,
    probe,
    corpusSize: cases.length,
    repeat,
    meaningfulTextThreshold: MEANINGFUL_TEXT_THRESHOLD,
    reservationIncludedInLatency: true,
    singleTurn: waves.map(({ samples, ...rest }) => rest),
    multiTurn: multiTurn ? { byKind: multiTurn.byKind } : null,
    rawSamples: waves.flatMap((wave) => wave.samples.map((sample) => ({ concurrency: wave.concurrency, ...sample }))),
    rawMultiTurn: multiTurn ? multiTurn.scenarios : null,
  };

  const outPath = args.get('out');
  if (outPath) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({ revision: report.revision, singleTurn: report.singleTurn, multiTurn: report.multiTurn }, null, 2)}\n`);
  if (!waves[0] || waves[0].overall.completed === 0) process.exit(1);
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) main().catch((error) => { console.error(error); process.exit(1); });
