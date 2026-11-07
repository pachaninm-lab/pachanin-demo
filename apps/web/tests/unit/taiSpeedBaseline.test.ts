import { describe, expect, it } from 'vitest';
import { gunzipSync, gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error -- existing pure ESM artifact hash helper.
import { sha256 as artifactSha256 } from '../../../../scripts/release/immutable-release-lib.mjs';
// @ts-expect-error -- plain ESM measurement tool, imported for its pure helpers.
import {
  BROAD_CONTRACT, broadCorpus, broadValidateSeed, broadDecodeSeed, broadResolveSeed, broadAuthorized, broadValidatePrior, broadValidateNativeRow, broadSummary, broadNativePriorManifest, broadConsecutiveFailures, broadHealth, measureBroadStream,
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


type BroadSeedFixture = {schema:string;corpusSha256:string;rawJournalSha256:string;records:Record<string, unknown>[]};
const localSeedFixture = (): BroadSeedFixture => JSON.parse(gunzipSync(Buffer.from('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','base64')).toString('utf8'));
const hashObject = (value:unknown) => artifactSha256(JSON.stringify(value)).slice(7);
const nativeOwner = {GITHUB_REPOSITORY:'pachaninm-lab/pachanin-demo',GITHUB_ACTOR:'pachaninm-lab',GITHUB_TRIGGERING_ACTOR:'pachaninm-lab',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/heads/main'};
const broadPlanFixture = () => {
  const seed=localSeedFixture(),done=new Set(seed.records.map(row=>row.id));
  const remainingIds=broadCorpus().filter((row:{id:string})=>!done.has(row.id)).map((row:{id:string})=>row.id);
  return {schema:BROAD_CONTRACT.schema,sourceSha:'a'.repeat(40),runId:'123',deployedRevision:BROAD_CONTRACT.deployedRevision,corpusSha256:BROAD_CONTRACT.corpusSha256,seedSha256:hashObject(seed),seed,remainingIds,clientCount:Math.ceil(remainingIds.length/16)};
};
const receiptFixture = (plan:ReturnType<typeof broadPlanFixture>) => {
  const cases=new Map<string,{id:string;sequence:number;locale:string;domain:string;task:string}>(broadCorpus().map((item:{id:string;sequence:number;locale:string;domain:string;task:string})=>[item.id,item]));
  const answerText='A synthetic agricultural answer.',answerSha256=artifactSha256(answerText).slice(7);
  const rows:Record<string,unknown>[]=plan.remainingIds.slice(0,16).map(id=>{
    const item=cases.get(id)!;
    return {id,sequence:item.sequence,locale:item.locale,domain:item.domain,task:item.task,startedAt:'2026-11-03T02:59:59.900Z',finishedAt:'2026-11-03T03:00:00Z',observation:'NATIVE_HOSTED',concurrency:1,ok:true,done:true,error:null,headersMs:1,firstTokenMs:5,firstMeaningfulTextMs:10,completedMs:100,elapsedMs:100,httpStatus:200,source:'local_qwen',answerMode:null,assessment:null,assessmentSummary:{source:'local_qwen',answerMode:null,upstreamTruncated:null,upstreamFinishReason:null},frameErrors:[],protocolErrors:0,tokenFrames:1,answerText,responseBytes:200,qualityReviewFlags:[],captureTruncated:false,answerSha256,assessmentSha256:'a'.repeat(64),fullMeasurementSha256:'b'.repeat(64),semanticAcceptance:'UNREVIEWED synthetic fixture'};
  });
  return {schema:plan.schema,sourceSha:plan.sourceSha,runId:plan.runId,deployedRevision:plan.deployedRevision,corpusSha256:plan.corpusSha256,seedSha256:plan.seedSha256,slot:7,ordinal:0,status:'COMPLETE_BATCH',stopReason:null as string|null,rows,rowsSha256:hashObject(rows)};
};

describe('finite hosted BEFORE1000 measurement',()=>{
  it('embeds the exact frozen1000-case corpus with original coverage',()=>{
    const cases=broadCorpus();expect(cases).toHaveLength(1000);expect(new Set(cases.map((row:{id:string})=>row.id)).size).toBe(1000);
    expect(cases.filter((row:{locale:string})=>row.locale==='ru')).toHaveLength(800);
    expect(cases.filter((row:{locale:string})=>row.locale==='en')).toHaveLength(100);
    expect(cases.filter((row:{locale:string})=>row.locale==='zh')).toHaveLength(100);
    expect(cases.filter((row:{domain:string})=>row.domain==='off_topic')).toHaveLength(20);
    expect(cases.filter((row:{expected:{kind:string}})=>row.expected.kind==='numeric')).toHaveLength(120);
  });
  it('preserves the original measurement body, timeout and widget target',()=>{
    // Vitest transforms function source; hash the committed original bytes.
    const toolPath=['scripts/tai-speed-baseline.mjs','../../scripts/tai-speed-baseline.mjs'].map(file=>resolve(process.cwd(),file)).find(file=>existsSync(file));
    expect(toolPath).toBeDefined();
    const tool=readFileSync(toolPath!,'utf8');
    const start=tool.indexOf('async function measure(item,fetcher=fetch){');
    const body=tool.slice(start,tool.indexOf('\n return measure;',start)).trimEnd();
    expect(artifactSha256(body)).toBe('sha256:d936aeef1e1c00a932ac9d99bf4a725bab23fef7c3f6a206f6746a712bd55831');
    expect(BROAD_CONTRACT).toMatchObject({timeoutMs:150000,maxConcurrency:1,maxCasesPerClient:16,deployedRevision:'a81d69fb9aa0434ed581e057252808f4cda82f08'});
  });
  it('retains all234 known outcomes including one real error and three unknowns',()=>{
    const seed=broadValidateSeed(localSeedFixture());expect(seed.records).toHaveLength(234);
    expect(seed.records.filter((row:Record<string,unknown>)=>row.ok)).toHaveLength(230);
    expect(seed.records.filter((row:Record<string,unknown>)=>row.error==='stream:UPSTREAM_ERROR')).toHaveLength(1);
    expect(seed.records.filter((row:Record<string,unknown>)=>row.measurementInterruption)).toHaveLength(3);
    expect(broadDecodeSeed(gzipSync(JSON.stringify(seed)).toString('base64'))).toEqual(seed);
  });
  it.each(['omitted','repeated','rewritten','unknown_success','wrong_corpus','extra_field'])('refuses %s local evidence',kind=>{
    const seed=localSeedFixture();
    if(kind==='omitted')seed.records.shift();
    if(kind==='repeated')seed.records[1]=seed.records[0];
    if(kind==='rewritten')seed.records[0].completedMs=1;
    if(kind==='unknown_success')seed.records.find(row=>row.measurementInterruption)!.ok=true;
    if(kind==='wrong_corpus')seed.corpusSha256='b'.repeat(64);
    if(kind==='extra_field')seed.records[0].url='https://elsewhere.test';
    expect(()=>broadValidateSeed(seed)).toThrow();
  });
  it.each(['!not_base64','A'.repeat(60001),gzipSync('A'.repeat(800001)).toString('base64')])('bounds encoded and expanded seed',value=>{
    expect(()=>broadDecodeSeed(value)).toThrow();
  });
  it('allows only the owner on main and the exact existing issue BEFORE command',()=>{
    const dispatch={inputs:{operation:'broad1000',phase:'before'}};
    expect(broadAuthorized('workflow_dispatch',dispatch,nativeOwner)).toBe(true);
    expect(broadAuthorized('workflow_dispatch',{inputs:{operation:'broad1000',phase:'after'}},nativeOwner)).toBe(false);
    const comment={action:'created',issue:{number:3072},comment:{user:{login:'pachaninm-lab'},body:'/gekta broad1000 current-main\nSEED_GZIP_BASE64=AAAA'}};
    expect(broadAuthorized('issue_comment',comment,nativeOwner)).toBe(true);
    expect(broadAuthorized('issue_comment',{...comment,issue:{number:3896}},nativeOwner)).toBe(false);
    expect(broadAuthorized('issue_comment',{...comment,comment:{...comment.comment,body:comment.comment.body+'\n--base-url https://elsewhere.test'}},nativeOwner)).toBe(false);
    for(const change of [{GITHUB_ACTOR:'outsider'},{GITHUB_TRIGGERING_ACTOR:'outsider'},{GITHUB_REF:'refs/heads/other'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_REPOSITORY:'other/repo'}]) expect(broadAuthorized('workflow_dispatch',dispatch,{...nativeOwner,...change})).toBe(false);
  });
  it('binds complete receipts to run/source/corpus/seed and never repeats seeded IDs',()=>{
    const plan=broadPlanFixture(),receipt=receiptFixture(plan);expect(broadValidatePrior(plan,[receipt]).rows).toHaveLength(250);
    expect(broadValidatePrior(plan,[receipt]).done.size).toBe(250);
    expect(()=>broadValidatePrior(plan,[receipt,receipt])).toThrow();
    for(const change of [{runId:'456'},{sourceSha:'b'.repeat(40)},{seedSha256:'b'.repeat(64)},{corpusSha256:'b'.repeat(64)},{ordinal:1},{rowsSha256:'b'.repeat(64)}]) expect(()=>broadValidatePrior(plan,[{...receipt,...change}])).toThrow();
    const replay=structuredClone(receipt);replay.rows[0].id=String(plan.seed.records[0].id);replay.rowsSha256=hashObject(replay.rows);expect(()=>broadValidatePrior(plan,[replay])).toThrow();
    const partial=structuredClone(receipt);partial.rows.pop();partial.rowsSha256=hashObject(partial.rows);expect(()=>broadValidatePrior(plan,[partial])).toThrow();
  });
  it.each(['missing_finish','missing_first_visible','negative_latency','infinite_latency','over_budget','unordered_latency','invalid_timestamp','http401_success','missing_done','frame_error_success','wrong_identity','missing_elapsed','wrong_capture_hash','unexpected_field'])('rejects %s even with a recomputed receipt hash',fault=>{
    const plan=broadPlanFixture(),receipt=receiptFixture(plan),row=receipt.rows[0];
    if(fault==='missing_finish')delete row.finishedAt;
    if(fault==='missing_first_visible')delete row.firstMeaningfulTextMs;
    if(fault==='negative_latency')row.completedMs=-1;
    if(fault==='infinite_latency')row.elapsedMs=Infinity;
    if(fault==='over_budget')row.elapsedMs=180001;
    if(fault==='unordered_latency')row.firstMeaningfulTextMs=101;
    if(fault==='invalid_timestamp')row.finishedAt='not-a-date';
    if(fault==='http401_success')row.httpStatus=401;
    if(fault==='missing_done')row.done=false;
    if(fault==='frame_error_success')row.frameErrors=['UPSTREAM_ERROR'];
    if(fault==='wrong_identity')row.locale='xx';
    if(fault==='missing_elapsed')row.elapsedMs=null;
    if(fault==='wrong_capture_hash')row.answerText='Changed answer without its content hash';
    if(fault==='unexpected_field')row.measurementInterruption='pretend_native_unknown';
    receipt.rowsSha256=hashObject(receipt.rows);expect(()=>broadValidatePrior(plan,[receipt])).toThrow();
  });
  it('rejects the reviewed minimal-success counterexample and accepts actual complete failure data',()=>{
    const plan=broadPlanFixture(),receipt=receiptFixture(plan),item=broadCorpus().find((value:{id:string})=>value.id===receipt.rows[0].id);
    expect(()=>broadValidateNativeRow({id:item.id,concurrency:1,observation:'NATIVE_HOSTED',ok:true,done:true,error:null,completedMs:-1},item)).toThrow();
    const failed={...receipt.rows[0],ok:false,done:false,error:'http_401',httpStatus:401,headersMs:1,firstTokenMs:null,firstMeaningfulTextMs:null,completedMs:null,tokenFrames:0,answerText:'',answerSha256:artifactSha256('').slice(7),source:null,assessmentSummary:{source:null,answerMode:null,upstreamTruncated:null,upstreamFinishReason:null},errorBody:'synthetic denied'};
    expect(broadValidateNativeRow(failed,item)).toBe(failed);
  });
  it.each(['empty','short','false_truncation'])('rejects %s successful capture even with recomputed content and receipt hashes',fault=>{
    const plan=broadPlanFixture(),receipt=receiptFixture(plan),row=receipt.rows[0];
    row.answerText=fault==='empty'?'':'12345';row.captureTruncated=fault==='false_truncation';
    row.answerSha256=artifactSha256(String(row.answerText)).slice(7);receipt.rowsSha256=hashObject(receipt.rows);
    expect(()=>broadValidatePrior(plan,[receipt])).toThrow();
  });
  it('preserves a real18000-character truncated prefix whose meaningful text was later in the stream',()=>{
    const plan=broadPlanFixture(),receipt=receiptFixture(plan),row=receipt.rows[0];
    row.answerText=' '.repeat(18000);row.captureTruncated=true;
    row.answerSha256=artifactSha256(String(row.answerText)+'A meaningful answer beyond the retained prefix.').slice(7);
    receipt.rowsSha256=hashObject(receipt.rows);expect(broadValidatePrior(plan,[receipt]).rows).toHaveLength(250);
  });
  it('carries a full late1000-record seed through immutable blob transport without shortening evidence',async()=>{
    const seed=localSeedFixture(),done=new Set(seed.records.map(row=>row.id));
    for(const item of broadCorpus().filter((value:{id:string})=>!done.has(value.id))) {
      const h=artifactSha256('synthetic late seed '+item.id).slice(7),time=Number.parseInt(h.slice(0,6),16)%90000+100;
      seed.records.push({...seed.records[0],id:item.id,sequence:item.sequence,locale:item.locale,domain:item.domain,task:item.task,headersMs:1,firstTokenMs:time/4,firstMeaningfulTextMs:time/3,completedMs:time,elapsedMs:time+1,answerSha256:h});
    }
    expect(seed.records).toHaveLength(1000);expect(broadValidateSeed(seed)).toBe(seed);
    const inline=gzipSync(JSON.stringify(seed)).toString('base64');expect(inline.length).toBeGreaterThan(60000);expect(()=>broadDecodeSeed(inline)).toThrow();
    const bytes=Buffer.from(JSON.stringify(seed)),gitSha='c'.repeat(40),sha=artifactSha256(bytes).slice(7);
    const response=await broadResolveSeed(`blob:${gitSha}:${sha}`,async(url:string,options:RequestInit)=>{
      expect(url).toBe(`https://api.github.com/repos/pachaninm-lab/pachanin-demo/git/blobs/${gitSha}`);expect(options.redirect).toBe('error');expect(options.headers).toEqual({Authorization:'Bearer synthetic-read-only',Accept:'application/vnd.github+json'});
      return Response.json({sha:gitSha,size:bytes.length,encoding:'base64',content:bytes.toString('base64')});
    },'synthetic-read-only');expect(response).toEqual(seed);
    const event={action:'created',issue:{number:3072},comment:{user:{login:'pachaninm-lab'},body:`/gekta broad1000 current-main\nSEED_BLOB=${gitSha}\nSEED_SHA256=${sha}`}};
    expect(broadAuthorized('issue_comment',event,nativeOwner)).toBe(true);
  });
  it.each(['wrong_sha','wrong_hash','wrong_size','wrong_encoding','oversize','oversize_body','denied','arbitrary_url'])('refuses %s immutable seed transport',async fault=>{
    const seed=localSeedFixture(),bytes=Buffer.from(JSON.stringify(seed)),gitSha='c'.repeat(40),sha=artifactSha256(bytes).slice(7);
    const reference=fault==='arbitrary_url'?`blob:https://elsewhere.test:${sha}`:`blob:${gitSha}:${sha}`;
    let requests=0;
    await expect(broadResolveSeed(reference,async()=>{
      requests++;
      if(fault==='denied')return new Response('denied',{status:403});
      if(fault==='oversize_body')return new Response('x'.repeat(1400001));
      return Response.json({sha:fault==='wrong_sha'?'d'.repeat(40):gitSha,size:fault==='oversize'?800001:fault==='wrong_size'?bytes.length+1:bytes.length,encoding:fault==='wrong_encoding'?'utf8':'base64',content:fault==='wrong_hash'?Buffer.from('tampered'.padEnd(bytes.length)).toString('base64'):bytes.toString('base64')});
    },'synthetic-read-only')).rejects.toThrow();
    if(fault==='arbitrary_url')expect(requests).toBe(0);
  });
  it('rejects a mutated plan partition and preserves a partial pause',()=>{
    const plan=broadPlanFixture();expect(()=>broadValidatePrior({...plan,remainingIds:plan.remainingIds.slice(1)},[])).toThrow();
    const receipt=receiptFixture(plan);receipt.rows=receipt.rows.slice(0,2);receipt.rowsSha256=hashObject(receipt.rows);receipt.status='PAUSED';receipt.stopReason='synthetic failure';
    expect(broadValidatePrior(plan,[receipt]).paused).toBe(true);
    const next={...receiptFixture(plan),slot:8,ordinal:1};expect(()=>broadValidatePrior(plan,[receipt,next])).toThrow();
  });
  it('requires every completed native client to have a successful matching immutable artifact',()=>{
    const plan=broadPlanFixture();const current={name:'Gekta broad client (0)',status:'in_progress'};
    const completed={name:'Gekta broad client (7)',status:'completed',conclusion:'success'};
    const artifact={name:'gekta-1000-part-7',id:11,size_in_bytes:10000,expired:false};
    expect(broadNativePriorManifest(plan,0,[current,completed],[artifact]).artifactIds).toEqual([11]);
    expect(()=>broadNativePriorManifest(plan,0,[current,completed],[])).toThrow();
    expect(()=>broadNativePriorManifest(plan,0,[current,{...completed,conclusion:'failure'}],[artifact])).toThrow();
    expect(()=>broadNativePriorManifest(plan,0,[current,completed],[{...artifact,expired:true}])).toThrow();
    expect(()=>broadNativePriorManifest(plan,0,[current,completed],[{...artifact,size_in_bytes:2097153}])).toThrow();
    expect(()=>broadNativePriorManifest(plan,0,[current,{name:'Gekta broad client (1)',status:'in_progress'}],[])).toThrow();
  });
  it('counts genuine consecutive failures across chunks while keeping unknown measurements separate',()=>{
    expect(broadConsecutiveFailures([{ok:true},{ok:false},{ok:false},{ok:false}])).toBe(3);
    expect(broadConsecutiveFailures([{ok:false},{ok:true},{ok:false}])).toBe(1);
    expect(broadConsecutiveFailures([{ok:true},{ok:false,measurementInterruption:'EXEC_SESSION_LOST_CAUSE_UNKNOWN'}])).toBe(0);
  });
  it('holds the deployed Web identity and readiness before any new request',async()=>{
    const good=()=>new Response(JSON.stringify({status:'ok',revision:BROAD_CONTRACT.deployedRevision}));
    expect((await broadHealth(async(url:string,options:RequestInit)=>{expect(url).toBe(BROAD_CONTRACT.base+'/api/health/ready');expect(options.headers).toEqual({'Cache-Control':'no-cache'});return good();})).revision).toBe(BROAD_CONTRACT.deployedRevision);
    await expect(broadHealth(async()=>new Response(JSON.stringify({status:'ok',revision:'b'.repeat(40)})))).rejects.toThrow();
    await expect(broadHealth(async()=>new Response(JSON.stringify({status:'not_ready',revision:BROAD_CONTRACT.deployedRevision})))).rejects.toThrow();
  });
  it('uses the real public-widget payload with history/documents and no credentials',async()=>{
    const item=broadCorpus().find((row:{documents:unknown[];history:unknown[]})=>row.documents.length>0);
    const result=await measureBroadStream(item,async(url:string,options:RequestInit)=>{
      expect(url).toBe(BROAD_CONTRACT.base+'/api/public-platform-assistant?stream=1');
      expect(options.headers).toEqual({'Content-Type':'application/json',Accept:'text/event-stream'});
      expect(JSON.parse(String(options.body))).toEqual({message:item.message,locale:item.locale,context:'platform',history:item.history,documents:item.documents});
      return sseResponse([{event:'token',body:{text:'A complete synthetic agricultural answer.'}},{event:'assessment',body:{summary:JSON.stringify({source:'local_qwen'})}},{event:'done',body:{complete:true}}]);
    });expect(result.ok).toBe(true);expect(result.source).toBe('local_qwen');
  });
  it.each(['missing_done','done_false','error_frame','invalid_json','no_text','http401','non_sse'])('does not promote %s to completed measurement',async kind=>{
    const item=broadCorpus()[0];
    const result=await measureBroadStream(item,async()=>{
      if(kind==='http401')return new Response('denied',{status:401});
      if(kind==='non_sse')return new Response('not a stream');
      if(kind==='invalid_json')return new Response('data: {broken}\n\n',{headers:{'Content-Type':'text/event-stream'}});
      const frames: {event:string;body:Record<string,unknown>}[]=kind==='no_text'?[]:[{event:'token',body:{text:'A synthetic agricultural answer.'}}];
      if(kind==='error_frame')frames.push({event:'error',body:{refusal:'UPSTREAM_ERROR'}});
      if(kind!=='missing_done')frames.push({event:'done',body:{complete:kind!=='done_false'}});
      return sseResponse(frames);
    });expect(result.ok).toBe(false);if(kind==='http401')expect(result.error).toBe('http_401');
  });
  it('keeps failed/null latencies out of percentiles and never labels protocol success quality PASS',()=>{
    const summary=broadSummary([{ok:true,source:'local_qwen',completedMs:1000,firstMeaningfulTextMs:200},{ok:false,completedMs:999999,firstMeaningfulTextMs:null},{ok:false,measurementInterruption:'EXEC_SESSION_LOST_CAUSE_UNKNOWN',completedMs:null,firstMeaningfulTextMs:null}]);
    expect(summary).toMatchObject({protocolCompleted:1,unknownInterrupted:1,observedFailures:1});expect(summary.modelBackedLatency.totalP95Ms).toBe(1000);
    expect(summary.semanticAcceptance).toContain('UNREVIEWED');expect(summary.latencyCaveat).toContain('not model TTFT');
  });
});
