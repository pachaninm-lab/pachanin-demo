#!/usr/bin/env node
/**
 * TAI latency baseline harness.
 *
 * Produces the "before" side of the P0-A comparison. Its most important
 * property is what it refuses to do: without a reachable model host it emits a
 * NOT_CAPTURED result naming the exact missing prerequisite, never a zero, an
 * estimate or a placeholder number. A baseline that can be produced without the
 * model is a baseline that proves nothing, and it would be the easiest possible
 * way to manufacture a 70% improvement later.
 *
 * Usage:
 *   node scripts/tai-baseline-harness.mjs --out <dir> [--corpus <path>]
 *                                         [--levels 1,5,10] [--label before-streaming]
 *
 * Environment (all required to capture; absence is reported, not defaulted):
 *   TAI_BASELINE_BASE_URL        Base URL of the deployed web contour under test
 *   TAI_BASELINE_TARGET_SHA      Exact SHA the deployment was built from
 *   TAI_BASELINE_MODEL_IDENTITY  Expected admitted model identity
 *   TAI_BASELINE_MODEL_DIGEST    sha256 of the model file, as deployed
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RESULT_SCHEMA = 'tai.latency-baseline.v1';
const DEFAULT_CORPUS = 'config/tai/baseline-corpus.v1.json';
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^(?:sha256:)?[0-9a-f]{64}$/u;

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    args.set(key, next && !next.startsWith('--') ? next : 'true');
  }
  return args;
}

/**
 * Collect every missing prerequisite rather than failing on the first.
 * An operator fixing one variable at a time across a slow deploy loop is how a
 * harness earns a reputation for wasting an afternoon.
 */
function collectPrerequisites(env) {
  const missing = [];
  const baseUrl = (env.TAI_BASELINE_BASE_URL || '').trim();
  const targetSha = (env.TAI_BASELINE_TARGET_SHA || '').trim();
  const modelIdentity = (env.TAI_BASELINE_MODEL_IDENTITY || '').trim();
  const modelDigest = (env.TAI_BASELINE_MODEL_DIGEST || '').trim();

  if (!baseUrl) missing.push({ variable: 'TAI_BASELINE_BASE_URL', why: 'no deployed contour to measure' });
  else if (!/^https?:\/\//u.test(baseUrl)) missing.push({ variable: 'TAI_BASELINE_BASE_URL', why: 'must be an absolute http(s) URL' });

  if (!targetSha) missing.push({ variable: 'TAI_BASELINE_TARGET_SHA', why: 'a baseline not bound to a SHA cannot be compared' });
  else if (!SHA_PATTERN.test(targetSha)) missing.push({ variable: 'TAI_BASELINE_TARGET_SHA', why: 'must be a full 40-character commit SHA' });

  if (!modelIdentity) missing.push({ variable: 'TAI_BASELINE_MODEL_IDENTITY', why: 'the measured model must be named' });

  if (!modelDigest) missing.push({ variable: 'TAI_BASELINE_MODEL_DIGEST', why: 'model identity without a digest cannot prove the same weights ran' });
  else if (!DIGEST_PATTERN.test(modelDigest)) missing.push({ variable: 'TAI_BASELINE_MODEL_DIGEST', why: 'must be a sha256 digest' });

  return { baseUrl, targetSha, modelIdentity, modelDigest, missing };
}

export function loadCorpus(corpusPath) {
  const raw = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  if (raw.schemaVersion !== 'tai.baseline-corpus.v1') {
    throw new Error(`baseline_corpus_schema_invalid:${raw.schemaVersion}`);
  }
  if (!Array.isArray(raw.cases) || raw.cases.length === 0) throw new Error('baseline_corpus_empty');
  const seen = new Set();
  for (const item of raw.cases) {
    if (!item.id || seen.has(item.id)) throw new Error(`baseline_corpus_duplicate_case:${item.id}`);
    seen.add(item.id);
    if (!['ru', 'en', 'zh'].includes(item.locale)) throw new Error(`baseline_corpus_locale_invalid:${item.id}`);
    if (!['short', 'medium', 'long'].includes(item.lengthClass)) throw new Error(`baseline_corpus_length_invalid:${item.id}`);
    if (typeof item.message !== 'string' || !item.message.trim()) throw new Error(`baseline_corpus_message_missing:${item.id}`);
  }
  return raw;
}

/** Percentile over a sorted copy; null for an empty sample rather than 0. */
export function percentile(samples, fraction) {
  const usable = samples.filter((value) => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const rank = Math.min(usable.length - 1, Math.max(0, Math.ceil(fraction * usable.length) - 1));
  return usable[rank];
}

export function summarize(samples) {
  const usable = samples.filter((value) => typeof value === 'number' && Number.isFinite(value));
  return {
    count: usable.length,
    p50: percentile(usable, 0.5),
    p95: percentile(usable, 0.95),
    p99: percentile(usable, 0.99),
    min: usable.length ? Math.min(...usable) : null,
    max: usable.length ? Math.max(...usable) : null,
  };
}

/**
 * Time to the first SSE token frame carrying non-empty text.
 *
 * Measured from request start at the client, which is the only vantage point
 * that reflects what a user waits for. Frames before the first token — meta,
 * citations — are deliberately not counted as useful text.
 */
async function measureOne(baseUrl, testCase, signal) {
  const startedAt = performance.now();
  const response = await fetch(new URL('/api/agro-chat?stream=1', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message: testCase.message, locale: testCase.locale, history: testCase.history || [] }),
    signal,
  });

  if (!response.ok || !response.body) {
    return { caseId: testCase.id, ok: false, errorClass: `http_${response.status}` };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let firstUsefulTextMs = null;
  let modelIdentity = null;
  let completed = false;
  let characters = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
        if (!line) continue;
        let frame;
        try { frame = JSON.parse(line.slice('data: '.length)); } catch { continue; }
        if (frame.event === 'meta' && frame.modelIdentity) modelIdentity = frame.modelIdentity;
        if (frame.event === 'token' && typeof frame.text === 'string' && frame.text.length > 0) {
          if (firstUsefulTextMs === null) firstUsefulTextMs = performance.now() - startedAt;
          characters += frame.text.length;
        }
        if (frame.event === 'assessment' && frame.summary) {
          try {
            const assessment = JSON.parse(frame.summary);
            if (assessment.modelIdentity) modelIdentity = assessment.modelIdentity;
          } catch { /* assessment shape is not the harness's authority */ }
        }
        if (frame.event === 'done') completed = true;
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  return {
    caseId: testCase.id,
    locale: testCase.locale,
    lengthClass: testCase.lengthClass,
    ok: completed && firstUsefulTextMs !== null,
    firstUsefulTextMs,
    totalMs: performance.now() - startedAt,
    answerCharacters: characters,
    modelIdentity,
    completed,
  };
}

async function runLevel(baseUrl, cases, concurrency, repetitions) {
  const queue = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (const testCase of cases) queue.push(testCase);
  }

  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= queue.length) return;
      try {
        results.push(await measureOne(baseUrl, queue[index]));
      } catch (error) {
        results.push({ caseId: queue[index].id, ok: false, errorClass: error instanceof Error ? error.name : 'unknown' });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function writeResult(outDir, payload) {
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, 'tai-latency-baseline.json');
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const outDir = args.get('out') || 'var/tai-baseline';
  const corpusPath = args.get('corpus') || DEFAULT_CORPUS;
  const label = args.get('label') || 'unlabelled';

  const corpus = loadCorpus(corpusPath);
  const prerequisites = collectPrerequisites(env);

  const runMetadata = {
    schemaVersion: RESULT_SCHEMA,
    label,
    corpusVersion: corpus.corpusVersion,
    corpusCaseCount: corpus.cases.length,
    startedAt: new Date().toISOString(),
    harnessNode: process.version,
    harnessPlatform: `${process.platform}-${process.arch}`,
  };

  if (prerequisites.missing.length > 0) {
    // The whole point of this branch: report absence as absence.
    const payload = {
      ...runMetadata,
      status: 'NOT_CAPTURED',
      reason: 'model_host_prerequisites_absent',
      missingPrerequisites: prerequisites.missing,
      levels: [],
    };
    const target = writeResult(outDir, payload);
    process.stderr.write(`TAI baseline NOT_CAPTURED — ${prerequisites.missing.length} prerequisite(s) absent\n`);
    for (const item of prerequisites.missing) process.stderr.write(`  - ${item.variable}: ${item.why}\n`);
    process.stderr.write(`Result written to ${target}\n`);
    return { status: 'NOT_CAPTURED', target, payload };
  }

  const levels = (args.get('levels') || corpus.concurrencyLevels.join(','))
    .split(',').map((value) => Number.parseInt(value.trim(), 10)).filter((value) => Number.isInteger(value) && value > 0);

  const levelResults = [];
  for (const concurrency of levels) {
    const samples = await runLevel(prerequisites.baseUrl, corpus.cases, concurrency, corpus.repetitionsPerCase);
    const usable = samples.filter((row) => row.ok);
    const identityMismatch = usable.filter((row) => row.modelIdentity && row.modelIdentity !== prerequisites.modelIdentity);

    levelResults.push({
      concurrency,
      requested: samples.length,
      completed: usable.length,
      failed: samples.length - usable.length,
      modelIdentityMismatches: identityMismatch.length,
      firstUsefulTextMs: summarize(usable.map((row) => row.firstUsefulTextMs)),
      totalMs: summarize(usable.map((row) => row.totalMs)),
      rawSamples: samples,
    });
  }

  // A run where the admitted model was not the expected one measured something
  // else, so it is reported as invalid rather than published as a baseline.
  const mismatches = levelResults.reduce((sum, level) => sum + level.modelIdentityMismatches, 0);
  const payload = {
    ...runMetadata,
    finishedAt: new Date().toISOString(),
    status: mismatches > 0 ? 'INVALID_MODEL_IDENTITY_MISMATCH' : 'CAPTURED',
    targetSha: prerequisites.targetSha,
    modelIdentity: prerequisites.modelIdentity,
    modelDigest: prerequisites.modelDigest,
    levels: levelResults,
  };

  const target = writeResult(outDir, payload);
  process.stdout.write(`TAI baseline ${payload.status} → ${target}\n`);
  return { status: payload.status, target, payload };
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
