import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM measurement tool, imported for its pure helpers.
import {
  MEANINGFUL_TEXT_THRESHOLD,
  bodyMarkerOf,
  renderSummary,
  classifyAuthLayer,
  probeContour,
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
  describe('auth layer attribution', () => {
    it('names the middleware private-mode challenge rather than guessing', () => {
      expect(classifyAuthLayer({ status: 401, wwwAuthenticate: 'Basic realm="x"', bodyMarker: 'private_required' }))
        .toBe('next_middleware_private_mode');
      expect(classifyAuthLayer({ status: 503, wwwAuthenticate: null, bodyMarker: 'private_locked' }))
        .toBe('next_middleware_private_mode_locked');
    });

    it('separates a session gate from an edge challenge', () => {
      expect(classifyAuthLayer({ status: 401, wwwAuthenticate: null, bodyMarker: 'session_json' }))
        .toBe('next_middleware_session_gate');
      expect(classifyAuthLayer({ status: 401, wwwAuthenticate: 'Basic realm="edge"', bodyMarker: 'other' }))
        .toBe('edge_basic_auth');
    });

    it('refuses to attribute a 401 it cannot explain', () => {
      expect(classifyAuthLayer({ status: 401, wwwAuthenticate: null, bodyMarker: 'other' }))
        .toBe('unattributed_401');
    });

    it('reports an open contour and an unreachable one distinctly', () => {
      expect(classifyAuthLayer({ status: 200, wwwAuthenticate: null, bodyMarker: 'health_json' })).toBe('open');
      expect(classifyAuthLayer({ status: 0, wwwAuthenticate: null, bodyMarker: 'error:TypeError' })).toBe('unreachable');
    });

    it('recognises refusal shapes without retaining the body', () => {
      expect(bodyMarkerOf('Private access required.')).toBe('private_required');
      expect(bodyMarkerOf('Private deployment locked.')).toBe('private_locked');
      expect(bodyMarkerOf('{"ok":false,"message":"unauthenticated"}')).toBe('session_json');
    });

    it('probes the canonical public entrypoints and sends no credential', async () => {
      const seen: { url: string; headers: Record<string, string> }[] = [];
      const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
        seen.push({ url, headers: init.headers });
        return new Response('Private access required.', {
          status: 401,
          headers: { 'www-authenticate': 'Basic realm="x"' },
        });
      };

      const probe = await probeContour({ baseUrl: 'https://example.test', fetchImpl });

      expect(seen.map((entry) => new URL(entry.url).pathname + new URL(entry.url).search)).toEqual([
        '/gekta',
        '/api/health/ready',
        '/api/agro-chat?stream=1',
      ]);
      for (const entry of seen) {
        expect(Object.keys(entry.headers).map((key) => key.toLowerCase())).not.toContain('authorization');
        expect(Object.keys(entry.headers).map((key) => key.toLowerCase())).not.toContain('cookie');
      }
      expect(probe.PUBLIC_ASSISTANT.layer).toBe('next_middleware_private_mode');
      expect(probe.PUBLIC_GEKTA_PAGE.status).toBe(401);
    });
  });


  describe('renderSummary', () => {
    const report = {
      revision: {
        attestation: 'web_revision_proven_not_matching_main',
        webRevision: '148407e9',
        repositoryMainSha: '506ec40c',
        notes: ['deployed revision does not match repository main'],
      },
      probe: { PUBLIC_ASSISTANT: { status: 200, layer: 'open' } },
      singleTurn: [{
        concurrency: 1,
        overall: { requests: 24, completed: 24, errors: {}, firstMeaningfulTextMs: { p50: 13949.1 } },
        bySource: {
          local_qwen: {
            requests: 20,
            completed: 20,
            firstMeaningfulTextMs: { p50: 15000, p95: 19356.4 },
            totalMs: { p50: 26299.3, p95: 36276.8 },
          },
          verified_knowledge: {
            requests: 4,
            completed: 4,
            firstMeaningfulTextMs: { p50: 162 },
          },
        },
      }],
    };

    it('renders without throwing on a report that has no wave', () => {
      // The inline summary this replaced used a top-level return, which is a
      // syntax error, and reported a passed measurement as a failed job.
      expect(() => renderSummary({ revision: {}, singleTurn: [] })).not.toThrow();
      expect(renderSummary({ revision: {}, singleTurn: [] })).toContain('No wave completed.');
    });

    it('keeps a fast non-model answer out of the model headline', () => {
      const text = renderSummary(report);
      // 162 ms is a knowledge reply; reporting it as the model's time to first
      // meaningful text would make Qwen look an order of magnitude faster.
      expect(text).toContain('model first meaningful p50 ms: 15000');
      expect(text).toContain('non-model source verified_knowledge');
      expect(text).not.toMatch(/model first meaningful p50 ms: 162/u);
    });

    it('states plainly whether the run is an exact-main before', () => {
      expect(renderSummary(report)).toContain('EXACT_MAIN_BEFORE=false');
      expect(renderSummary({
        revision: { attestation: 'web_revision_matches_main' },
        singleTurn: [],
      })).toContain('EXACT_MAIN_BEFORE=true');
    });

    it('says a run whose revision does not match main is not a baseline', () => {
      expect(renderSummary(report)).toContain('network measurement, not an exact-main baseline');
    });
  });

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

    it('uses the exact Gekta wire contract and sends prior turns for follow-up latency', async () => {
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
      expect(sentBody.message).toBe('А что проверить сначала?');
      expect(sentBody.context).toBe('gekta-standalone');
      expect(sentBody).not.toHaveProperty('question');
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
