import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM measurement tool, imported for its pure helpers.
import {
  SPEED_CORPUS,
  groupBy,
  measureStream,
  parseArgs,
  percentile,
  readFrame,
  summarize,
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
        { event: 'token', body: { text: 'Точи лопату' }, afterMs: 30 },
        { event: 'token', body: { text: ' напильником.' }, afterMs: 120 },
        { event: 'done', body: {} },
      ]);

      const sample = await measureStream({ url: 'https://example.test', question: 'q', locale: 'ru', fetchImpl });

      expect(sample.ok).toBe(true);
      expect(sample.error).toBeNull();
      expect(sample.tokenFrames).toBe(2);
      expect(sample.answerChars).toBe('Точи лопату напильником.'.length);
      // The headline number must reflect the first visible text, well before the
      // stream ends — that separation is the entire point of the measurement.
      expect(sample.firstTokenMs).toBeGreaterThan(0);
      expect(sample.completedMs).toBeGreaterThan(sample.firstTokenMs);
      expect(sample.firstTokenMs).toBeLessThan(sample.completedMs);
    });

    it('marks a stream that emitted no text as failed', async () => {
      const fetchImpl = async () => sseResponse([
        { event: 'meta', body: { mode: 'public', modelIdentity: null } },
        { event: 'done', body: {} },
      ]);

      const sample = await measureStream({ url: 'https://example.test', question: 'q', locale: 'ru', fetchImpl });

      expect(sample.ok).toBe(false);
      expect(sample.error).toBe('no_text_emitted');
      expect(sample.firstTokenMs).toBeNull();
    });

    it('records a refusal frame as an error rather than a fast answer', async () => {
      const fetchImpl = async () => sseResponse([
        { event: 'error', body: { refusal: 'UPSTREAM_ERROR', message: 'unavailable' } },
      ]);

      const sample = await measureStream({ url: 'https://example.test', question: 'q', locale: 'ru', fetchImpl });

      expect(sample.ok).toBe(false);
      expect(sample.error).toBe('UPSTREAM_ERROR');
    });

    it('reports a non-200 response as an error', async () => {
      const fetchImpl = async () => new Response('nope', { status: 503 });
      const sample = await measureStream({ url: 'https://example.test', question: 'q', locale: 'ru', fetchImpl });
      expect(sample.ok).toBe(false);
      expect(sample.error).toBe('http_503');
    });

    it('reports a transport failure instead of throwing', async () => {
      const fetchImpl = async () => { throw new Error('econnrefused'); };
      const sample = await measureStream({ url: 'https://example.test', question: 'q', locale: 'ru', fetchImpl });
      expect(sample.ok).toBe(false);
      expect(sample.error).toContain('request_failed');
    });
  });

  describe('summarize', () => {
    it('keeps failures out of the latency percentiles', () => {
      const summary = summarize([
        { ok: true, firstTokenMs: 100, completedMs: 500, charsPerSecond: 40, error: null },
        { ok: true, firstTokenMs: 200, completedMs: 900, charsPerSecond: 60, error: null },
        { ok: false, firstTokenMs: null, completedMs: null, charsPerSecond: null, error: 'timeout' },
      ]);

      expect(summary.requests).toBe(3);
      expect(summary.completed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.errors).toEqual({ timeout: 1 });
      // A timeout must not masquerade as a slow-but-successful request.
      expect(summary.firstTokenMs.p50).toBe(100);
      expect(summary.firstTokenMs.p95).toBe(200);
    });

    it('reports null percentiles when nothing completed', () => {
      const summary = summarize([{ ok: false, firstTokenMs: null, completedMs: null, error: 'timeout' }]);
      expect(summary.completed).toBe(0);
      expect(summary.firstTokenMs.p50).toBeNull();
    });
  });

  describe('corpus and arguments', () => {
    it('separates question classes so trivial questions are not averaged away', () => {
      const types = new Set(SPEED_CORPUS.map((entry: { type: string }) => entry.type));
      expect(types.has('simple')).toBe(true);
      expect(types.has('economics')).toBe(true);
      const locales = new Set(SPEED_CORPUS.map((entry: { locale: string }) => entry.locale));
      expect([...locales].sort()).toEqual(['en', 'ru', 'zh']);
    });

    it('groups samples by class', () => {
      const grouped = groupBy([
        { ok: true, type: 'simple', firstTokenMs: 100, completedMs: 200, charsPerSecond: 10, error: null },
        { ok: true, type: 'economics', firstTokenMs: 400, completedMs: 800, charsPerSecond: 10, error: null },
      ], 'type');
      expect(grouped.simple.firstTokenMs.p50).toBe(100);
      expect(grouped.economics.firstTokenMs.p50).toBe(400);
    });

    it('parses flags and values', () => {
      const args = parseArgs(['--base-url', 'https://example.test', '--repeat', '3', '--verbose']);
      expect(args.get('base-url')).toBe('https://example.test');
      expect(args.get('repeat')).toBe('3');
      expect(args.get('verbose')).toBe('true');
    });
  });
});
