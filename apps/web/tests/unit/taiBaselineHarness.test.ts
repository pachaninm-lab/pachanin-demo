import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error -- plain ESM harness, deliberately dependency-free
import { loadCorpus, main, percentile, summarize } from '../../../../scripts/tai-baseline-harness.mjs';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CORPUS_PATH = path.join(REPO_ROOT, 'config/tai/baseline-corpus.v1.json');

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tai-baseline-'));
}

describe('TAI baseline corpus', () => {
  it('loads, and covers all three languages across all three length classes', () => {
    const corpus = loadCorpus(CORPUS_PATH);

    expect(corpus.corpusVersion).toBeTruthy();
    for (const locale of ['ru', 'en', 'zh']) {
      const forLocale = corpus.cases.filter((row: { locale: string }) => row.locale === locale);
      expect(forLocale.map((row: { lengthClass: string }) => row.lengthClass).sort())
        .toEqual(['long', 'medium', 'short']);
    }
  });

  it('asks for enough repetitions to make a percentile meaningful', () => {
    const corpus = loadCorpus(CORPUS_PATH);

    expect(corpus.repetitionsPerCase).toBeGreaterThanOrEqual(30);
    expect(corpus.discardWarmupRepetitions).toBeGreaterThan(0);
    expect(corpus.concurrencyLevels).toEqual([1, 5, 10, 25, 50]);
  });

  it('carries history on the follow-up cases, so prompt assembly is measured', () => {
    const corpus = loadCorpus(CORPUS_PATH);
    const followUps = corpus.cases.filter((row: { lengthClass: string }) => row.lengthClass === 'short');

    expect(followUps.length).toBeGreaterThan(0);
    for (const row of followUps) expect(row.history.length).toBeGreaterThan(0);
  });

  it('rejects a corpus whose schema version it does not know', () => {
    const dir = tempDir();
    const bad = path.join(dir, 'corpus.json');
    fs.writeFileSync(bad, JSON.stringify({ schemaVersion: 'tai.baseline-corpus.v9', cases: [] }));

    expect(() => loadCorpus(bad)).toThrow(/baseline_corpus_schema_invalid/u);
  });
});

describe('TAI baseline statistics', () => {
  it('returns null rather than zero for an empty sample', () => {
    // Zero would silently become the fastest baseline ever recorded.
    expect(percentile([], 0.5)).toBeNull();
    expect(summarize([])).toMatchObject({ count: 0, p50: null, p95: null, min: null, max: null });
  });

  it('ignores non-finite samples instead of poisoning the percentile', () => {
    expect(summarize([10, Number.NaN, 20, Number.POSITIVE_INFINITY, 30]).count).toBe(3);
  });

  it('computes percentiles from the sorted sample', () => {
    const samples = [50, 10, 40, 20, 30];

    expect(percentile(samples, 0.5)).toBe(30);
    expect(percentile(samples, 0.95)).toBe(50);
  });
});

describe('TAI baseline capture refusal', () => {
  it('reports NOT_CAPTURED with every missing prerequisite named', async () => {
    const dir = tempDir();

    const result = await main(['--out', dir, '--corpus', CORPUS_PATH, '--label', 'test'], {});

    expect(result.status).toBe('NOT_CAPTURED');
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'tai-latency-baseline.json'), 'utf8'));
    expect(written.status).toBe('NOT_CAPTURED');
    expect(written.reason).toBe('model_host_prerequisites_absent');
    expect(written.missingPrerequisites.map((row: { variable: string }) => row.variable).sort()).toEqual([
      'TAI_BASELINE_BASE_URL',
      'TAI_BASELINE_MODEL_DIGEST',
      'TAI_BASELINE_MODEL_IDENTITY',
      'TAI_BASELINE_TARGET_SHA',
    ]);
  });

  it('publishes no latency numbers at all when it could not measure', async () => {
    // The failure mode this guards against is a NOT_CAPTURED result that still
    // carries zeros, which a later comparison would read as a real measurement.
    const dir = tempDir();

    await main(['--out', dir, '--corpus', CORPUS_PATH], {});
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'tai-latency-baseline.json'), 'utf8'));

    expect(written.levels).toEqual([]);
    expect(JSON.stringify(written)).not.toMatch(/"p50":\s*0/u);
    expect(written).not.toHaveProperty('modelDigest');
  });

  it('refuses a partially configured run rather than measuring against defaults', async () => {
    const dir = tempDir();

    const result = await main(['--out', dir, '--corpus', CORPUS_PATH], {
      TAI_BASELINE_BASE_URL: 'https://example.invalid',
      TAI_BASELINE_MODEL_IDENTITY: 'tai-qwen3-8b-q4km',
    });

    expect(result.status).toBe('NOT_CAPTURED');
    expect(result.payload.missingPrerequisites.map((row: { variable: string }) => row.variable).sort())
      .toEqual(['TAI_BASELINE_MODEL_DIGEST', 'TAI_BASELINE_TARGET_SHA']);
  });

  it('rejects a malformed SHA or digest instead of accepting a placeholder', async () => {
    const dir = tempDir();

    const result = await main(['--out', dir, '--corpus', CORPUS_PATH], {
      TAI_BASELINE_BASE_URL: 'https://example.invalid',
      TAI_BASELINE_MODEL_IDENTITY: 'tai-qwen3-8b-q4km',
      TAI_BASELINE_TARGET_SHA: 'TBD',
      TAI_BASELINE_MODEL_DIGEST: 'unknown',
    });

    expect(result.status).toBe('NOT_CAPTURED');
    const variables = result.payload.missingPrerequisites.map((row: { variable: string }) => row.variable).sort();
    expect(variables).toEqual(['TAI_BASELINE_MODEL_DIGEST', 'TAI_BASELINE_TARGET_SHA']);
  });
});
