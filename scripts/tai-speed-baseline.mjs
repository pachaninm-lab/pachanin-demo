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
 * unreachable endpoint fails loudly rather than emitting comfortable zeros,
 * percentiles are computed only over samples that actually completed, and a run
 * whose deployed revision cannot be proven is labelled a network measurement
 * rather than an exact-main baseline.
 *
 * Usage:
 *   node scripts/tai-speed-baseline.mjs --base-url https://процент-агро.рф \
 *     [--concurrency 1,2,4] [--repeat 3] [--locales ru,en,zh] \
 *     [--out var/speed-baseline.json] [--timeout-ms 150000] \
 *     [--cooldown-ms 15000] [--main-sha <sha>] [--skip-multi-turn]
 */

import { setTimeout as delay } from 'node:timers/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 150_000;
const DEFAULT_COOLDOWN_MS = 15_000;

/**
 * Characters that carry meaning to a reader. A leading space, a bullet or an
 * opening quote is a frame arriving, not an answer beginning.
 */
const MEANINGFUL_CHAR = /[\p{L}\p{N}]/u;

/** Minimum meaningful characters before an answer counts as visibly started. */
export const MEANINGFUL_TEXT_THRESHOLD = 12;

/**
 * Markers a runtime may emit around hidden reasoning. They are stripped before
 * meaningfulness is judged so a leaked marker cannot be timed as an answer.
 */
const INTERNAL_MARKER = /<\/?(?:think(?:ing)?|analysis|reasoning|scratchpad|tool[^>]*|debug)[^>]*>|<\|[^|>]{1,64}\|>/giu;

/**
 * Question classes carry different budgets, so they are never pooled: a trivial
 * dacha question must not be averaged into deep economic analysis.
 */
export const SPEED_CORPUS = Object.freeze([
  { id: 'simple-ru', type: 'simple', locale: 'ru', question: 'Как наточить лопату?' },
  { id: 'tool-ru', type: 'rural_tool', locale: 'ru', question: 'Как правильно пользоваться вилами?' },
  { id: 'tool-care-ru', type: 'rural_tool', locale: 'ru', question: 'Как обслуживать мотоблок перед сезоном?' },
  { id: 'dacha-ru', type: 'dacha', locale: 'ru', question: 'Когда высаживать помидоры в открытый грунт?' },
  { id: 'storage-ru', type: 'dacha', locale: 'ru', question: 'Как хранить картофель зимой в погребе?' },
  { id: 'crop-ru', type: 'crop', locale: 'ru', question: 'Почему желтеют нижние листья огурцов в теплице?' },
  { id: 'crop2-ru', type: 'crop', locale: 'ru', question: 'Какой севооборот выбрать после подсолнечника?' },
  { id: 'rare-crop-ru', type: 'rare_crop', locale: 'ru', question: 'Какие особенности выращивания нута в Поволжье?' },
  { id: 'rare-crop2-ru', type: 'rare_crop', locale: 'ru', question: 'Стоит ли сеять сафлор в засушливой зоне?' },
  { id: 'disease-ru', type: 'disease', locale: 'ru', question: 'Как снизить риск парши на яблоне в следующем сезоне?' },
  { id: 'disease2-ru', type: 'disease', locale: 'ru', question: 'На пшенице бурые пятна на листьях, что это может быть?' },
  { id: 'machinery-ru', type: 'machinery', locale: 'ru', question: 'Комбайн теряет зерно на соломотрясе, что проверить?' },
  { id: 'machinery2-ru', type: 'machinery', locale: 'ru', question: 'Трактор теряет тягу под нагрузкой, с чего начать диагностику?' },
  { id: 'livestock-ru', type: 'livestock', locale: 'ru', question: 'Как снизить тепловой стресс у дойных коров летом?' },
  { id: 'livestock2-ru', type: 'livestock', locale: 'ru', question: 'Почему падает привес у поросят на откорме?' },
  { id: 'economics-ru', type: 'economics', locale: 'ru', question: 'Что выгоднее: сушить зерно или продавать сразу с поля?' },
  { id: 'economics2-ru', type: 'economics', locale: 'ru', question: 'Как посчитать себестоимость гектара озимой пшеницы?' },
  {
    id: 'detailed-ru',
    type: 'detailed',
    locale: 'ru',
    question: 'Разработай технологическую карту озимой пшеницы: обработка почвы, посев, питание, защита и уборка.',
  },
  {
    id: 'long-ru',
    type: 'long_question',
    locale: 'ru',
    question: 'У меня хозяйство 1200 гектаров в Ростовской области, севооборот озимая пшеница — подсолнечник — пар, '
      + 'урожайность последние три года падает с 42 до 34 центнеров с гектара, вносим аммиачную селитру весной, '
      + 'осенью только фосфор, техника John Deere и Ростсельмаш, часть полей с уклоном и признаками эрозии, '
      + 'расход топлива вырос на 12 процентов. Объясни вероятные причины падения урожайности и что проверить в первую очередь.',
  },
  { id: 'simple-en', type: 'simple', locale: 'en', question: 'How do I sharpen a spade properly?' },
  { id: 'crop-en', type: 'crop', locale: 'en', question: 'Why are my cucumber leaves turning yellow in a greenhouse?' },
  { id: 'machinery-en', type: 'machinery', locale: 'en', question: 'My combine is losing grain over the straw walkers, what should I check?' },
  { id: 'simple-zh', type: 'simple', locale: 'zh', question: '如何正确磨快铁锹？' },
  { id: 'crop-zh', type: 'crop', locale: 'zh', question: '温室里黄瓜叶子发黄是什么原因？' },
]);

/**
 * Conversational latency is a different measurement from a cold question, so
 * these run separately and are never folded into single-turn percentiles.
 */
export const MULTI_TURN_SCENARIOS = Object.freeze([
  {
    id: 'follow-up-ru',
    kind: 'follow_up',
    locale: 'ru',
    turns: ['Почему желтеют листья огурцов?', 'А что проверить сначала?'],
  },
  {
    id: 'correction-ru',
    kind: 'correction',
    locale: 'ru',
    turns: ['Почему желтеют листья огурцов?', 'Нет, я имел в виду томаты.'],
  },
  {
    id: 'topic-shift-ru',
    kind: 'topic_shift',
    locale: 'ru',
    turns: ['Почему желтеют листья огурцов?', 'Теперь почему трактор теряет тягу?'],
  },
]);

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

/** Count characters a reader would recognise as answer text. */
export function meaningfulLength(text) {
  const withoutMarkers = String(text ?? '').replace(INTERNAL_MARKER, '');
  let count = 0;
  for (const character of withoutMarkers) {
    if (MEANINGFUL_CHAR.test(character)) count += 1;
  }
  return count;
}

/**
 * Read one SSE stream and time the events that matter to a reader.
 *
 * `firstTokenMs` is when the first frame carrying any text arrived.
 * `firstMeaningfulTextMs` is when enough real text existed to be worth reading,
 * which is what the P0 SPEED gate is actually stated in. They are recorded
 * separately because a runtime that emits a bullet, a heading or whitespace
 * first would otherwise appear to answer sooner than it does.
 */
export async function measureStream({
  url,
  question,
  locale,
  history = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
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
  };

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'text/event-stream',
        // The real Gekta browser request is same-origin and therefore reaches
        // the incremental SSE path rather than the buffered cross-site fallback.
        'sec-fetch-site': 'same-origin',
      },
      // Match the public /gekta client contract exactly. `question` is an
      // internal benchmark field only; the route reads `message` on the wire.
      body: JSON.stringify({ message: question, locale, context: 'gekta-standalone', history }),
      signal: controller.signal,
    });
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
    try {
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
          // The assessment frame says which contour actually answered. A
          // deterministic or knowledge-backed reply returns in milliseconds and
          // would flatter the model's time-to-first-text if the two were pooled.
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
          if (sample.firstMeaningfulTextMs === null
            && meaningfulLength(visible) >= MEANINGFUL_TEXT_THRESHOLD) {
            sample.firstMeaningfulTextMs = round(performance.now() - startedAt);
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    sample.completedMs = round(performance.now() - startedAt);
    sample.answerText = visible;
    sample.answerChars = visible.length;
    sample.meaningfulChars = meaningfulLength(visible);
    // An answer with no readable text is not a fast answer, it is a failed one.
    sample.ok = sample.error === null && sample.firstMeaningfulTextMs !== null;
    if (!sample.ok && !sample.error) {
      sample.error = sample.firstTokenMs === null ? 'no_text_emitted' : 'no_meaningful_text';
    }
    if (sample.ok && sample.completedMs > 0) {
      sample.charsPerSecond = round((sample.answerChars / sample.completedMs) * 1_000);
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

function round(value) {
  return Number(value.toFixed(1));
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
  return round(sorted[index]);
}

export function summarize(samples) {
  const completed = samples.filter((sample) => sample.ok);
  return {
    requests: samples.length,
    completed: completed.length,
    failed: samples.length - completed.length,
    errors: tally(samples.filter((sample) => !sample.ok).map((sample) => sample.error || 'unknown')),
    headersMs: percentiles(completed.map((sample) => sample.headersMs)),
    firstTokenMs: percentiles(completed.map((sample) => sample.firstTokenMs)),
    firstMeaningfulTextMs: percentiles(completed.map((sample) => sample.firstMeaningfulTextMs)),
    totalMs: percentiles(completed.map((sample) => sample.completedMs)),
    charsPerSecond: percentile(completed.map((sample) => sample.charsPerSecond), 50),
  };
}

function percentiles(values) {
  return {
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
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

/**
 * A wave is overloaded when requests start failing or the tail collapses. Waves
 * escalate only while the previous one stayed healthy, so a benchmark never
 * turns into a denial-of-service against production.
 */
export function waveIsHealthy(summary, { maxFailureRatio = 0.1, maxTailMs = 60_000 } = {}) {
  if (!summary || summary.requests === 0) return false;
  if (summary.completed === 0) return false;
  if (summary.failed / summary.requests > maxFailureRatio) return false;
  const tail = summary.firstMeaningfulTextMs?.p95;
  return !(Number.isFinite(tail) && tail > maxTailMs);
}

/**
 * Record what was actually deployed before measuring it.
 *
 * The web revision is published by the health endpoint. The API revision is not
 * exposed anonymously, so a run that cannot prove it is downgraded rather than
 * described as an exact-main baseline.
 */
export async function captureDeployedRevision({ baseUrl, mainSha = null, fetchImpl = fetch }) {
  const evidence = {
    capturedAt: new Date().toISOString(),
    repositoryMainSha: mainSha,
    webRevision: null,
    apiRevision: null,
    webRevisionProven: false,
    apiRevisionProven: false,
    attestation: 'network_measurement_only',
    notes: [],
  };

  try {
    const response = await fetchImpl(new URL('/api/health/ready', baseUrl).toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) {
      const body = await response.json();
      const revision = typeof body?.revision === 'string' ? body.revision.trim() : '';
      evidence.webRevision = revision || null;
      evidence.webRevisionProven = Boolean(revision) && revision !== 'unknown';
      if (!evidence.webRevisionProven) evidence.notes.push('web health endpoint reported an unknown revision');
    } else {
      evidence.notes.push(`web health endpoint returned HTTP ${response.status}`);
    }
  } catch (error) {
    evidence.notes.push(`web health endpoint unreachable: ${error?.message || 'unknown'}`);
  }

  // No anonymous endpoint publishes the API revision, so it stays unproven and
  // the run is labelled accordingly rather than overclaimed.
  evidence.notes.push('API revision is not exposed on the public contour and was not proven by this run');

  if (evidence.webRevisionProven && mainSha && evidence.webRevision === mainSha) {
    evidence.attestation = 'web_revision_matches_main';
  } else if (evidence.webRevisionProven) {
    evidence.attestation = 'web_revision_proven_not_matching_main';
  }
  return evidence;
}

/**
 * Attribute an authentication response to the layer that produced it.
 *
 * A benchmark that cannot reach the contour must say which layer refused it, so
 * the fix lands in the right place instead of weakening something at random.
 * Only the challenge scheme and the shape of the refusal are read — never a
 * credential, a cookie or a body beyond the marker it is matched against.
 */
export function classifyAuthLayer({ status, wwwAuthenticate, bodyMarker }) {
  if (status === 0) return 'unreachable';
  if (status === 503 && bodyMarker === 'private_locked') return 'next_middleware_private_mode_locked';
  if (status !== 401 && status !== 407) return status >= 200 && status < 400 ? 'open' : 'other_refusal';
  const scheme = String(wwwAuthenticate || '').trim().toLowerCase().split(/[\s,]/u)[0] || '';
  if (bodyMarker === 'private_required') return 'next_middleware_private_mode';
  if (bodyMarker === 'session_json') return 'next_middleware_session_gate';
  if (scheme === 'basic') return 'edge_basic_auth';
  return 'unattributed_401';
}

/** Recognise which refusal shape a body is, without retaining the body. */
export function bodyMarkerOf(text) {
  const head = String(text ?? '').slice(0, 200);
  if (head.includes('Private access required')) return 'private_required';
  if (head.includes('Private deployment locked')) return 'private_locked';
  if (head.includes('"unauthenticated"')) return 'session_json';
  if (head.includes('"revision"')) return 'health_json';
  return 'other';
}

/**
 * Bounded read-only probe of the public contour.
 *
 * Issues one request per canonical public entrypoint and reports status and
 * layer attribution. It sends no credential and prints no body.
 */
export async function probeContour({ baseUrl, fetchImpl = fetch, timeoutMs = 30_000 }) {
  const targets = [
    { key: 'PUBLIC_GEKTA_PAGE', path: '/gekta', method: 'GET' },
    { key: 'PUBLIC_HEALTH_READY', path: '/api/health/ready', method: 'GET' },
    { key: 'PUBLIC_ASSISTANT', path: '/api/agro-chat?stream=1', method: 'POST' },
  ];
  const results = {};
  for (const target of targets) {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(new URL(target.path, baseUrl).toString(), {
        method: target.method,
        headers: target.method === 'POST'
          ? { 'Content-Type': 'application/json; charset=utf-8', Accept: 'text/event-stream', 'sec-fetch-site': 'same-origin' }
          : { Accept: 'text/html,application/json' },
        body: target.method === 'POST'
          ? JSON.stringify({ message: 'проба', locale: 'ru', context: 'gekta-standalone', history: [] })
          : undefined,
        signal: controller.signal,
      });
      const wwwAuthenticate = response.headers.get('www-authenticate');
      const bodyMarker = bodyMarkerOf(await response.text().catch(() => ''));
      results[target.key] = {
        status: response.status,
        layer: classifyAuthLayer({ status: response.status, wwwAuthenticate, bodyMarker }),
        challengeScheme: wwwAuthenticate ? wwwAuthenticate.trim().split(/[\s,]/u)[0].toLowerCase() : null,
        bodyMarker,
      };
    } catch (error) {
      results[target.key] = {
        status: 0,
        layer: 'unreachable',
        challengeScheme: null,
        bodyMarker: `error:${error?.name || 'unknown'}`,
      };
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
  results.PUBLIC_ROUTE_EXPECTED = true;
  return results;
}

/**
 * Render the human summary of a finished report.
 *
 * This lives in the tool rather than in an inline `node -e` in the workflow.
 * The inline form carried a top-level `return`, which is a syntax error, so a
 * measurement that had succeeded and uploaded its evidence was reported as a
 * failed job. A summary must never be able to fail a measurement that passed.
 */
export function renderSummary(report) {
  const lines = [];
  const value = (label, amount) => lines.push(`${label}: ${amount ?? 'not measured'}`);
  const revision = report?.revision || {};
  lines.push(`attestation: ${revision.attestation || 'unknown'}`);
  value('deployed web revision', revision.webRevision);
  value('repository main', revision.repositoryMainSha);
  lines.push(`EXACT_MAIN_BEFORE=${revision.attestation === 'web_revision_matches_main'}`);

  for (const [key, probe] of Object.entries(report?.probe || {})) {
    if (!probe || typeof probe !== 'object') continue;
    lines.push(`${key}_HTTP=${probe.status} ${key}_LAYER=${probe.layer}`);
  }

  const waves = Array.isArray(report?.singleTurn) ? report.singleTurn : [];
  if (!waves.length) {
    lines.push('No wave completed.');
    return lines.join('\n');
  }

  for (const wave of waves) {
    const overall = wave.overall || {};
    lines.push('');
    lines.push(`concurrency ${wave.concurrency}: ${overall.completed}/${overall.requests} completed`);
    // Model-backed percentiles are the headline. A deterministic or knowledge
    // reply answers in milliseconds, and pooling the two would let a fast
    // fallback flatter the model's real time to first meaningful text.
    const model = wave.bySource?.local_qwen;
    if (model) {
      lines.push(`  model-backed ${model.completed}/${model.requests}`);
      value('  model first meaningful p50 ms', model.firstMeaningfulTextMs?.p50);
      value('  model first meaningful p95 ms', model.firstMeaningfulTextMs?.p95);
      value('  model total p50 ms', model.totalMs?.p50);
      value('  model total p95 ms', model.totalMs?.p95);
    } else {
      lines.push('  model-backed: none observed');
    }
    for (const [source, group] of Object.entries(wave.bySource || {})) {
      if (source === 'local_qwen') continue;
      lines.push(`  non-model source ${source}: ${group.completed}/${group.requests}`
        + ` first meaningful p50 ${group.firstMeaningfulTextMs?.p50 ?? 'n/a'} ms`);
    }
    value('  all-sample first meaningful p50 ms', overall.firstMeaningfulTextMs?.p50);
    lines.push(`  errors: ${JSON.stringify(overall.errors || {})}`);
  }

  if (revision.attestation !== 'web_revision_matches_main') {
    lines.push('');
    lines.push('This run is a network measurement, not an exact-main baseline:');
    for (const note of revision.notes || []) lines.push(`  - ${note}`);
  }
  return lines.join('\n');
}

async function runWave(cases, concurrency, options) {
  const queue = [...cases];
  const results = [];
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const sample = await measureStream({ ...options, question: item.question, locale: item.locale });
      // The answer body is not retained in the report: it is not a latency fact
      // and public answers do not belong in a benchmark artifact.
      const { answerText, ...rest } = sample;
      void answerText;
      results.push({ ...rest, id: item.id, type: item.type });
      await delay(25);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runMultiTurn(scenarios, options) {
  const results = [];
  for (const scenario of scenarios) {
    const history = [];
    const turns = [];
    for (let index = 0; index < scenario.turns.length; index += 1) {
      const question = scenario.turns[index];
      const sample = await measureStream({ ...options, question, locale: scenario.locale, history: [...history] });
      const { answerText, ...rest } = sample;
      turns.push({ ...rest, turn: index + 1 });
      history.push({ role: 'user', text: question });
      if (answerText) history.push({ role: 'assistant', text: answerText });
      await delay(250);
    }
    results.push({ id: scenario.id, kind: scenario.kind, locale: scenario.locale, turns });
  }
  return results;
}

export function summarizeMultiTurn(scenarios) {
  const byKind = {};
  for (const scenario of scenarios) {
    // Turn 1 is a cold question; the conversational cost is in the later turns.
    const laterTurns = scenario.turns.filter((turn) => turn.turn > 1);
    (byKind[scenario.kind] ||= []).push(...laterTurns);
  }
  return Object.fromEntries(Object.entries(byKind).map(([kind, turns]) => [kind, summarize(turns)]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summarizePath = args.get("summarize");
  if (summarizePath) {
    const { readFile } = await import("node:fs/promises");
    const report = JSON.parse(await readFile(summarizePath, "utf8"));
    process.stdout.write(`${renderSummary(report)}\n`);
    return;
  }
  const baseUrl = args.get('base-url');
  if (!baseUrl) {
    console.error('Refusing to run without --base-url. A baseline against nothing is not a baseline.');
    process.exit(2);
  }
  const url = new URL('/api/agro-chat?stream=1', baseUrl).toString();
  const locales = (args.get('locales') || 'ru,en,zh').split(',').map((value) => value.trim()).filter(Boolean);
  const concurrencies = (args.get('concurrency') || '1,2,4')
    .split(',').map((value) => Number(value.trim())).filter((value) => value > 0);
  const repeat = Math.max(1, Number(args.get('repeat') || '1'));
  const timeoutMs = Number(args.get('timeout-ms') || DEFAULT_TIMEOUT_MS);
  const cooldownMs = Number(args.get('cooldown-ms') || DEFAULT_COOLDOWN_MS);
  const cases = SPEED_CORPUS.filter((item) => locales.includes(item.locale));
  if (!cases.length) {
    console.error(`No corpus entries for locales ${locales.join(',')}.`);
    process.exit(2);
  }

  // Attribution runs first and always. When the contour refuses the benchmark,
  // the run must say which layer refused it rather than only that it failed.
  const probe = await probeContour({ baseUrl });
  for (const [key, value] of Object.entries(probe)) {
    if (typeof value !== 'object') continue;
    process.stderr.write(`${key}_HTTP=${value.status} ${key}_LAYER=${value.layer}\n`);
  }
  if (args.get('probe-only') === 'true') {
    process.stdout.write(`${JSON.stringify(probe, null, 2)}\n`);
    const reachable = probe.PUBLIC_ASSISTANT?.status === 200;
    process.exit(reachable ? 0 : 3);
  }

  const startedAt = new Date().toISOString();
  const revision = await captureDeployedRevision({ baseUrl, mainSha: args.get('main-sha') || null });
  process.stderr.write(`attestation=${revision.attestation} web=${revision.webRevision || 'unknown'}\n`);

  const waves = [];
  for (const concurrency of concurrencies) {
    const previous = waves[waves.length - 1];
    if (previous && !waveIsHealthy(previous.overall)) {
      process.stderr.write(`stopping before concurrency=${concurrency}: previous wave showed overload\n`);
      break;
    }
    if (previous) await delay(cooldownMs);
    const repeated = Array.from({ length: repeat }, () => cases).flat();
    process.stderr.write(`measuring concurrency=${concurrency} requests=${repeated.length}\n`);
    const samples = await runWave(repeated, concurrency, { url, timeoutMs });
    waves.push({
      concurrency,
      overall: summarize(samples),
      byType: groupBy(samples, 'type'),
      byLocale: groupBy(samples, 'locale'),
      bySource: groupBy(samples, 'source'),
      samples,
    });
  }

  let multiTurn = null;
  if (args.get('skip-multi-turn') !== 'true') {
    process.stderr.write(`measuring multi-turn scenarios=${MULTI_TURN_SCENARIOS.length}\n`);
    const scenarios = await runMultiTurn(MULTI_TURN_SCENARIOS, { url, timeoutMs });
    multiTurn = { scenarios, byKind: summarizeMultiTurn(scenarios) };
  }

  const report = {
    tool: 'tai-speed-baseline',
    version: 2,
    startedAt,
    finishedAt: new Date().toISOString(),
    target: url,
    revision,
    probe,
    corpusSize: cases.length,
    repeat,
    meaningfulTextThreshold: MEANINGFUL_TEXT_THRESHOLD,
    singleTurn: waves.map(({ samples, ...rest }) => rest),
    multiTurn: multiTurn ? { byKind: multiTurn.byKind } : null,
    rawSamples: waves.flatMap((wave) => wave.samples.map((sample) => ({ concurrency: wave.concurrency, ...sample }))),
    rawMultiTurn: multiTurn ? multiTurn.scenarios : null,
  };

  const outPath = args.get('out');
  if (outPath) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stderr.write(`wrote ${outPath}\n`);
  }
  process.stdout.write(`${JSON.stringify({ revision: report.revision, singleTurn: report.singleTurn, multiTurn: report.multiTurn }, null, 2)}\n`);

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
