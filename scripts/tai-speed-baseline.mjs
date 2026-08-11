#!/usr/bin/env node
/**
 * Гекта speed baseline — measured, never estimated.
 *
 * The P0 SPEED gate is stated in user-visible terms: how long until the reader
 * sees the first meaningful text, and how long until the answer is done. Those
 * are properties of the SSE stream the browser actually consumes, so this tool
 * measures exactly that stream and nothing else. It does not time the model in
 * isolation, because a fast model behind a buffering proxy is not a fast answer.
 *
 * It reports what it measured and refuses to invent the rest: a run against an
 * unreachable endpoint fails loudly rather than emitting comfortable zeros, and
 * percentiles are computed only over samples that actually completed.
 *
 * Usage:
 *   node scripts/tai-speed-baseline.mjs --base-url https://процент-агро.рф \
 *     [--concurrency 1,2,4] [--repeat 3] [--locales ru,en,zh] \
 *     [--out var/speed-baseline.json] [--timeout-ms 150000]
 *
 * The corpus deliberately spans the question classes the specification calls
 * out — trivial dacha questions must not pay the latency of deep analysis, so
 * they are measured separately rather than averaged into one number.
 */

import { setTimeout as delay } from 'node:timers/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** Question classes carry different budgets, so they are never pooled. */
export const SPEED_CORPUS = Object.freeze([
  { id: 'simple-ru', type: 'simple', locale: 'ru', question: 'Как наточить лопату?' },
  { id: 'dacha-ru', type: 'dacha', locale: 'ru', question: 'Когда высаживать помидоры в открытый грунт?' },
  { id: 'storage-ru', type: 'dacha', locale: 'ru', question: 'Как хранить картофель зимой в погребе?' },
  { id: 'crop-ru', type: 'crop', locale: 'ru', question: 'Почему желтеют нижние листья огурцов в теплице?' },
  { id: 'rare-crop-ru', type: 'rare_crop', locale: 'ru', question: 'Какие особенности выращивания нута в Поволжье?' },
  { id: 'machinery-ru', type: 'machinery', locale: 'ru', question: 'Комбайн теряет зерно на соломотрясе, что проверить?' },
  { id: 'livestock-ru', type: 'livestock', locale: 'ru', question: 'Как снизить тепловой стресс у дойных коров летом?' },
  { id: 'economics-ru', type: 'economics', locale: 'ru', question: 'Что выгоднее: сушить зерно или продавать сразу с поля?' },
  { id: 'tool-ru', type: 'simple', locale: 'ru', question: 'Как правильно пользоваться вилами?' },
  { id: 'simple-en', type: 'simple', locale: 'en', question: 'How do I sharpen a spade properly?' },
  { id: 'crop-en', type: 'crop', locale: 'en', question: 'Why are my cucumber leaves turning yellow in a greenhouse?' },
  { id: 'simple-zh', type: 'simple', locale: 'zh', question: '如何正确磨快铁锹？' },
]);

const DEFAULT_TIMEOUT_MS = 150_000;

export function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      args.set(key, 'true');
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

/**
 * Read one SSE stream and time the events that matter to a reader.
 *
 * `firstTokenMs` is the headline number: the moment the first `token` frame is
 * readable, which is the first text a person can actually see. Header time is
 * kept separately so a slow proxy is distinguishable from a slow model.
 */
export async function measureStream({ url, question, locale, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  const sample = {
    question,
    locale,
    ok: false,
    error: null,
    headersMs: null,
    firstTokenMs: null,
    completedMs: null,
    answerChars: 0,
    tokenFrames: 0,
    charsPerSecond: null,
  };

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'text/event-stream',
        // The route serves the buffered contract to cross-site callers.
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({ question, locale, history: [] }),
      signal: controller.signal,
    });
    sample.headersMs = performance.now() - startedAt;
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
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let boundary = pending.indexOf('\n\n');
        while (boundary >= 0) {
          const frame = pending.slice(0, boundary);
          pending = pending.slice(boundary + 2);
          boundary = pending.indexOf('\n\n');
          const event = readFrame(frame);
          if (!event) continue;
          if (event.event === 'token') {
            if (sample.firstTokenMs === null) sample.firstTokenMs = performance.now() - startedAt;
            sample.tokenFrames += 1;
            sample.answerChars += typeof event.text === 'string' ? event.text.length : 0;
          }
          if (event.event === 'error') sample.error = String(event.refusal || 'stream_error');
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    sample.completedMs = performance.now() - startedAt;
    // An answer with no text is not a fast answer, it is a failed one.
    sample.ok = sample.error === null && sample.firstTokenMs !== null && sample.answerChars > 0;
    if (!sample.ok && !sample.error) sample.error = 'no_text_emitted';
    if (sample.ok && sample.completedMs > 0) {
      sample.charsPerSecond = Number(((sample.answerChars / sample.completedMs) * 1_000).toFixed(1));
    }
  } catch (error) {
    sample.error = error?.name === 'AbortError' ? 'timeout' : `request_failed:${error?.message || 'unknown'}`;
  } finally {
    globalThis.clearTimeout(timer);
  }
  return sample;
}

export function readFrame(rawFrame) {
  const dataLine = rawFrame.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice(5).trim());
  } catch {
    return null;
  }
}

/**
 * Nearest-rank percentile over completed samples only.
 *
 * Failed requests are counted separately rather than folded in as large
 * latencies: mixing them produces a number that is neither a latency nor an
 * error rate, and hides which one moved.
 */
export function percentile(values, rank) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const position = Math.ceil((rank / 100) * sorted.length);
  const index = Math.min(Math.max(position, 1), sorted.length) - 1;
  return Number(sorted[index].toFixed(1));
}

export function summarize(samples) {
  const completed = samples.filter((sample) => sample.ok);
  const firstToken = completed.map((sample) => sample.firstTokenMs);
  const total = completed.map((sample) => sample.completedMs);
  return {
    requests: samples.length,
    completed: completed.length,
    failed: samples.length - completed.length,
    errors: tally(samples.filter((sample) => !sample.ok).map((sample) => sample.error || 'unknown')),
    firstTokenMs: percentiles(firstToken),
    totalMs: percentiles(total),
    charsPerSecond: percentile(completed.map((sample) => sample.charsPerSecond), 50),
  };
}

function percentiles(values) {
  return { p50: percentile(values, 50), p75: percentile(values, 75), p90: percentile(values, 90), p95: percentile(values, 95), p99: percentile(values, 99) };
}

function tally(items) {
  const counts = {};
  for (const item of items) counts[item] = (counts[item] || 0) + 1;
  return counts;
}

export function groupBy(samples, key) {
  const groups = {};
  for (const sample of samples) {
    const bucket = sample[key] ?? 'unknown';
    (groups[bucket] ||= []).push(sample);
  }
  return Object.fromEntries(Object.entries(groups).map(([name, rows]) => [name, summarize(rows)]));
}

async function runWave(cases, concurrency, options) {
  const queue = [...cases];
  const results = [];
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const sample = await measureStream({ ...options, question: item.question, locale: item.locale });
      results.push({ ...sample, id: item.id, type: item.type });
      // A short gap keeps a bounded queue from being measured as a thundering herd.
      await delay(25);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.get('base-url');
  if (!baseUrl) {
    console.error('Refusing to run without --base-url. A baseline against nothing is not a baseline.');
    process.exit(2);
  }
  const url = new URL('/api/agro-chat?stream=1', baseUrl).toString();
  const locales = (args.get('locales') || 'ru,en,zh').split(',').map((value) => value.trim()).filter(Boolean);
  const concurrencies = (args.get('concurrency') || '1').split(',').map((value) => Number(value.trim())).filter((value) => value > 0);
  const repeat = Math.max(1, Number(args.get('repeat') || '1'));
  const timeoutMs = Number(args.get('timeout-ms') || DEFAULT_TIMEOUT_MS);
  const cases = SPEED_CORPUS.filter((item) => locales.includes(item.locale));
  if (!cases.length) {
    console.error(`No corpus entries for locales ${locales.join(',')}.`);
    process.exit(2);
  }

  const startedAt = new Date().toISOString();
  const waves = [];
  for (const concurrency of concurrencies) {
    const repeated = Array.from({ length: repeat }, () => cases).flat();
    process.stderr.write(`measuring concurrency=${concurrency} requests=${repeated.length}\n`);
    const samples = await runWave(repeated, concurrency, { url, timeoutMs });
    waves.push({
      concurrency,
      overall: summarize(samples),
      byType: groupBy(samples, 'type'),
      byLocale: groupBy(samples, 'locale'),
      samples,
    });
  }

  const report = {
    tool: 'tai-speed-baseline',
    version: 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    target: url,
    corpusSize: cases.length,
    repeat,
    waves: waves.map(({ samples, ...rest }) => rest),
    rawSamples: waves.flatMap((wave) => wave.samples.map((sample) => ({ concurrency: wave.concurrency, ...sample }))),
  };

  const outPath = args.get('out');
  if (outPath) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stderr.write(`wrote ${outPath}\n`);
  }
  process.stdout.write(`${JSON.stringify(report.waves, null, 2)}\n`);

  const firstWave = waves[0];
  if (!firstWave || firstWave.overall.completed === 0) {
    console.error('No request completed. Reporting no baseline rather than a fabricated one.');
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
