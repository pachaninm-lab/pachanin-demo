import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM measurement tool, imported for its pure helpers.
import {
  MEANINGFUL_TEXT_THRESHOLD,
  MULTI_TURN_SCENARIOS,
  SPEED_CORPUS,
  captureDeployedRevision,
  groupBy,
  meaningfulLength,
  measureStream,
  parseArgs,
  percentile,
  readFrame,
  summarize,
  summarizeMultiTurn,
  waveIsHealthy,
} from '../../../../scripts/tai-speed-baseline.mjs';

/** Build an SSE body that emits token frames with real gaps between them. */
function sseResponse(
  frames: readonly { event: string; body: Record<string, unknown>; afterMs?: number }[],
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const frame of frames) {
        if (frame.afterMs) await new Promise((resolve) => setTimeout(resolve, frame.afterMs));
        const payload = { event: frame.event, ...frame.body };
        controller.enqueue(encoder.encode(`event: ${frame.event}\ndata: ${JSON.stringify(payload)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const target = { url: 'https://example.test', question: 'q', locale: 'ru' };

describe('tai speed baseline', () => {
  describe('percentile', () => {
    it('uses nearest rank over sorted values', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      expect(percentile(values, 50)).toBe(50);
      expect(percentile(values, 90)).toBe(90);
      expect(percentile(values, 100)).toBe(100);
    });

    it('returns null rather than a number when there is nothing to measure', () => {
      expect(percentile([], 50)).toBeNull();
      expect(percentile([Number.NaN], 95)).toBeNull();
    });

    it('ignores non-finite samples instead of ranking them', () => {
      // Infinity is dropped, so the ranking runs over [10, 20] alone.
      expect(percentile([10, Number.POSITIVE_INFINITY, 20], 50)).toBe(10);
      expect(percentile([10, Number.POSITIVE_INFINITY, 20], 95)).toBe(20);
    });
  });

  describe('meaningfulLength', () => {
    it('counts letters and digits across scripts', () => {
      expect(meaningfulLength('Точи лопату')).toBe(10);
      expect(meaningfulLength('sharpen 2')).toBe(8);
      expect(meaningfulLength('磨快铁锹')).toBe(4);
    });

    it('does not count whitespace, punctuation or list markers as answer text', () => {
      expect(meaningfulLength('   ')).toBe(0);
      expect(meaningfulLength('— • :')).toBe(0);
      expect(meaningfulLength('...')).toBe(0);
    });

    it('does not count a leaked reasoning marker as answer text', () => {
      expect(meaningfulLength('<think>')).toBe(0);
      expect(meaningfulLength('<|channel|>')).toBe(0);
    });
  });

  describe('readFrame', () => {
    it('reads the data line of an SSE frame', () => {
      expect(readFrame('event: token\ndata: {"event":"token","text":"привет"}')).toEqual({
        event: 'token',
        text: 'привет',
      });
    });

    it('returns null for malformed frames rather than throwing', () => {
      expect(readFrame('event: token')).toBeNull();
      expect(readFrame('data: {not json')).toBeNull();
    });
  });

  describe('measureStream', () => {
    it('times the first token frame, not the end of the answer', async () => {
      const fetchImpl = async () => sseResponse([
        { event: 'meta', body: { mode: 'public', modelIdentity: null } },
        { event: 'token', body: { text: 'Точи лопату напильником' }, afterMs: 30 },
        { event: 'token', body: { text: ' от центра к краю.' }, afterMs: 120 },
        { event: 'done', body: {} },
      ]);

      const sample = await measureStream({ ...target, fetchImpl });

      expect(sample.ok).toBe(true);
      expect(sample.error).toBeNull();
      expect(sample.tokenFrames).toBe(2);
      expect(sample.firstTokenMs).toBeGreaterThan(0);
      expect(sample.completedMs).toBeGreaterThan(sample.firstTokenMs);
    });

    it('separates first meaningful text from the first frame of whitespace', async () => {
      // A runtime that opens with a bullet and a newline has not answered yet.
      const fetchImpl = async () => sseResponse([
        { event: 'token', body: { text: '  \n• ' }, afterMs: 20 },
        { event: 'token', body: { text: 'Проверь давление в шинах.' }, afterMs: 80 },
        { event: 'done', body: {} },
      ]);

      const sample = await measureStream({ ...target, fetchImpl });

      expect(sample.ok).toBe(true);
      expect(sample.firstTokenMs).toBeGreaterThan(0);
      expect(sample.firstMeaningfulTextMs).toBeGreaterThan(sample.firstTokenMs);
    });

    it('does not start the meaningful clock on a leaked reasoning marker', async () => {
      const fetchImpl = async () => sseResponse([
        { event: 'token', body: { text: '<think>' }, afterMs: 10 },
        { event: 'token', body: { text: 'Настоящий ответ для читателя.' }, afterMs: 60 },
        { event: 'done', body: {} },
      ]);

      const sample = await measureStream({ ...target, fetchImpl });

      expect(sample.firstMeaningfulTextMs).toBeGreaterThan(sample.firstTokenMs);
    });

    it('marks a stream that emitted no text as failed', async () => {
      const fetchImpl = async () => sseResponse([
        { event: 'meta', body: { mode: 'public', modelIdentity: null } },
        { event: 'done', body: {} },
      ]);

      const sample = await measureStream({ ...target, fetchImpl });

      expect(sample.ok).toBe(false);
      expect(sample.error).toBe('no_text_emitted');
      expect(sample.firstTokenMs).toBeNull();
    });

    it('marks a stream with only punctuation as failed rather than instant', async () => {
      const fetchImpl = async () => sseResponse([
        { event: 'token', body: { text: '   ...' } },
        { event: 'done', body: {} },
      ]);

      const sample = await measureStream({ ...target, fetchImpl });

      expect(sample.ok).toBe(false);
      expect(sample.error).toBe('no_meaningful_text');
    });

    it('records a refusal frame as an error rather than a fast answer', async () => {
      const fetchImpl = async () => sseResponse([
        { event: 'error', body: { refusal: 'UPSTREAM_ERROR', message: 'unavailable' } },
      ]);

      const sample = await measureStream({ ...target, fetchImpl });

      expect(sample.ok).toBe(false);
      expect(sample.error).toBe('UPSTREAM_ERROR');
    });

    it('reports a non-200 response as an error', async () => {
      const fetchImpl = async () => new Response('nope', { status: 503 });
      const sample = await measureStream({ ...target, fetchImpl });
      expect(sample.ok).toBe(false);
      expect(sample.error).toBe('http_503');
    });

    it('reports a transport failure instead of throwing', async () => {
      const fetchImpl = async () => { throw new Error('econnrefused'); };
      const sample = await measureStream({ ...target, fetchImpl });
      expect(sample.ok).toBe(false);
      expect(sample.error).toContain('request_failed');
    });

    it('sends prior turns as history so follow-up latency is measured in context', async () => {
      let sentBody: Record<string, unknown> = {};
      const fetchImpl = async (_url: string, init: { body: string }) => {
        sentBody = JSON.parse(init.body);
        return sseResponse([{ event: 'token', body: { text: 'Ответ для продолжения диалога.' } }, { event: 'done', body: {} }]);
      };

      await measureStream({
        ...target,
        question: 'А что проверить сначала?',
        history: [{ role: 'user', text: 'Почему желтеют листья?' }],
        fetchImpl,
      });

      expect(sentBody.history).toHaveLength(1);
      expect(sentBody.question).toBe('А что проверить сначала?');
    });
  });

  describe('summarize', () => {
    const completedSample = (firstMeaningful: number, total: number) => ({
      ok: true,
      headersMs: 10,
      firstTokenMs: firstMeaningful - 5,
      firstMeaningfulTextMs: firstMeaningful,
      completedMs: total,
      charsPerSecond: 50,
      error: null,
    });

    it('keeps failures out of the latency percentiles', () => {
      const summary = summarize([
        completedSample(100, 500),
        completedSample(200, 900),
        { ok: false, firstTokenMs: null, firstMeaningfulTextMs: null, completedMs: null, error: 'timeout' },
      ]);

      expect(summary.requests).toBe(3);
      expect(summary.completed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.errors).toEqual({ timeout: 1 });
      // A timeout must not masquerade as a slow-but-successful request.
      expect(summary.firstMeaningfulTextMs.p50).toBe(100);
      expect(summary.firstMeaningfulTextMs.p95).toBe(200);
    });

    it('reports null percentiles when nothing completed', () => {
      const summary = summarize([{ ok: false, firstMeaningfulTextMs: null, completedMs: null, error: 'timeout' }]);
      expect(summary.completed).toBe(0);
      expect(summary.firstMeaningfulTextMs.p50).toBeNull();
    });
  });

  describe('waveIsHealthy', () => {
    const healthy = { requests: 10, completed: 10, failed: 0, firstMeaningfulTextMs: { p95: 3_000 } };

    it('allows escalation while the wave stayed healthy', () => {
      expect(waveIsHealthy(healthy)).toBe(true);
    });

    it('stops escalation when requests started failing', () => {
      expect(waveIsHealthy({ ...healthy, completed: 7, failed: 3 })).toBe(false);
    });

    it('stops escalation when the tail collapsed', () => {
      expect(waveIsHealthy({ ...healthy, firstMeaningfulTextMs: { p95: 90_000 } })).toBe(false);
    });

    it('treats an empty wave as unhealthy rather than fine', () => {
      expect(waveIsHealthy({ requests: 0, completed: 0, failed: 0 })).toBe(false);
      expect(waveIsHealthy(null)).toBe(false);
    });
  });

  describe('captureDeployedRevision', () => {
    it('labels the run a network measurement when the revision is unknown', async () => {
      const fetchImpl = async () => new Response(JSON.stringify({ revision: 'unknown' }), { status: 200 });
      const evidence = await captureDeployedRevision({ baseUrl: 'https://example.test', mainSha: 'abc', fetchImpl });

      expect(evidence.webRevisionProven).toBe(false);
      expect(evidence.attestation).toBe('network_measurement_only');
    });

    it('records a proven revision that does not match main as exactly that', async () => {
      const fetchImpl = async () => new Response(JSON.stringify({ revision: 'deadbeef' }), { status: 200 });
      const evidence = await captureDeployedRevision({ baseUrl: 'https://example.test', mainSha: 'abc123', fetchImpl });

      expect(evidence.webRevisionProven).toBe(true);
      expect(evidence.attestation).toBe('web_revision_proven_not_matching_main');
    });

    it('confirms a revision that matches main', async () => {
      const fetchImpl = async () => new Response(JSON.stringify({ revision: 'abc123' }), { status: 200 });
      const evidence = await captureDeployedRevision({ baseUrl: 'https://example.test', mainSha: 'abc123', fetchImpl });

      expect(evidence.attestation).toBe('web_revision_matches_main');
    });

    it('never claims the API revision was proven', async () => {
      const fetchImpl = async () => new Response(JSON.stringify({ revision: 'abc123' }), { status: 200 });
      const evidence = await captureDeployedRevision({ baseUrl: 'https://example.test', mainSha: 'abc123', fetchImpl });

      expect(evidence.apiRevisionProven).toBe(false);
      expect(evidence.notes.join(' ')).toContain('API revision is not exposed');
    });

    it('survives an unreachable health endpoint without throwing', async () => {
      const fetchImpl = async () => { throw new Error('dns'); };
      const evidence = await captureDeployedRevision({ baseUrl: 'https://example.test', fetchImpl });

      expect(evidence.webRevisionProven).toBe(false);
      expect(evidence.attestation).toBe('network_measurement_only');
    });
  });

  describe('corpus and multi-turn', () => {
    it('covers the question classes the specification calls out', () => {
      const types = new Set(SPEED_CORPUS.map((entry: { type: string }) => entry.type));
      for (const required of [
        'simple', 'dacha', 'rural_tool', 'crop', 'rare_crop',
        'disease', 'machinery', 'livestock', 'economics', 'detailed', 'long_question',
      ]) {
        expect(types.has(required)).toBe(true);
      }
    });

    it('covers RU, EN and ZH', () => {
      const locales = new Set(SPEED_CORPUS.map((entry: { locale: string }) => entry.locale));
      expect([...locales].sort()).toEqual(['en', 'ru', 'zh']);
    });

    it('defines follow-up, correction and topic-shift conversations', () => {
      const kinds = MULTI_TURN_SCENARIOS.map((entry: { kind: string }) => entry.kind);
      expect(kinds).toEqual(['follow_up', 'correction', 'topic_shift']);
    });

    it('summarizes multi-turn by later turns only, so cold questions do not dilute it', () => {
      const byKind = summarizeMultiTurn([{
        id: 'x',
        kind: 'follow_up',
        locale: 'ru',
        turns: [
          { turn: 1, ok: true, firstMeaningfulTextMs: 9_000, completedMs: 9_000, error: null },
          { turn: 2, ok: true, firstMeaningfulTextMs: 500, completedMs: 900, error: null },
        ],
      }]);

      expect(byKind.follow_up.requests).toBe(1);
      expect(byKind.follow_up.firstMeaningfulTextMs.p50).toBe(500);
    });

    it('groups samples by class', () => {
      const grouped = groupBy([
        { ok: true, type: 'simple', firstMeaningfulTextMs: 100, completedMs: 200, charsPerSecond: 10, error: null },
        { ok: true, type: 'economics', firstMeaningfulTextMs: 400, completedMs: 800, charsPerSecond: 10, error: null },
      ], 'type');
      expect(grouped.simple.firstMeaningfulTextMs.p50).toBe(100);
      expect(grouped.economics.firstMeaningfulTextMs.p50).toBe(400);
    });

    it('requires a real amount of text before an answer counts as started', () => {
      expect(MEANINGFUL_TEXT_THRESHOLD).toBeGreaterThanOrEqual(8);
    });

    it('parses flags and values', () => {
      const args = parseArgs(['--base-url', 'https://example.test', '--repeat', '3', '--verbose']);
      expect(args.get('base-url')).toBe('https://example.test');
      expect(args.get('repeat')).toBe('3');
      expect(args.get('verbose')).toBe('true');
    });
  });
});
