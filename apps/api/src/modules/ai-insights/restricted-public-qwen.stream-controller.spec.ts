import { createHash, createHmac } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RestrictedPublicQwenController, canonicalJson } from './restricted-public-qwen.controller';
import type { RestrictedPublicQwenService, TaiStreamEvent } from './restricted-public-qwen.service';

const SECRET = 's'.repeat(48);
const TRACE = 'ab'.repeat(16);

const BODY = {
  question: 'Почему падает урожайность озимой пшеницы?',
  originalQuestion: 'Почему падает урожайность озимой пшеницы?',
  locale: 'ru',
  answerMode: 'general_agro',
  currentDataRequired: false,
  history: [],
  grounding: {
    knowledgeVersion: 'public-kb-2026-07-29',
    topic: 'overview',
    title: 'Общий агровопрос',
    answer: 'Публичная база не содержит отдельной статьи.',
    facts: [],
    maturity: 'Нерелевантно.',
    confidence: 'medium',
    sources: [{ label: 'Главная платформы', href: '/platform-v7' }],
  },
};

function signedHeaders(body: unknown, traceId: string | null = TRACE): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const canonical = canonicalJson(body);
  const bodyHash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  const signature = createHmac('sha256', SECRET)
    .update(['tai-public-qwen.v1', 'POST', '/internal/tai/public-stream', timestamp, bodyHash].join('\n'), 'utf8')
    .digest('hex');
  return {
    'x-tai-signature-version': 'tai-public-qwen.v1',
    'x-tai-timestamp': timestamp,
    'x-tai-signature': signature,
    ...(traceId ? { 'x-tai-trace-id': traceId } : {}),
  };
}

/** Minimal ServerResponse/IncomingMessage doubles that record what was written. */
function harness() {
  const chunks: string[] = [];
  let headers: Record<string, string> = {};
  let status = 0;
  let ended = false;
  const closeHandlers: (() => void)[] = [];

  const response = {
    writeHead(code: number, sent: Record<string, string>) { status = code; headers = sent; return response; },
    write(chunk: string) { chunks.push(chunk); return true; },
    end() { ended = true; },
  } as unknown as ServerResponse;

  const request = {
    on(event: string, handler: () => void) { if (event === 'close') closeHandlers.push(handler); return request; },
    off() { return request; },
  } as unknown as IncomingMessage;

  return {
    response,
    request,
    disconnect: () => closeHandlers.forEach((handler) => handler()),
    get status() { return status; },
    get headers() { return headers; },
    get ended() { return ended; },
    get wire() { return chunks.join(''); },
    frames(): TaiStreamEvent[] {
      return chunks.join('').split('\n\n').filter(Boolean).map((block) => {
        const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
        return JSON.parse(String(line).slice('data: '.length)) as TaiStreamEvent;
      });
    },
  };
}

function serviceYielding(events: readonly TaiStreamEvent[], onSignal?: (signal?: AbortSignal) => void) {
  return {
    async* generateStream(_body: unknown, signal?: AbortSignal) {
      onSignal?.(signal);
      for (const event of events) yield event;
    },
  } as unknown as RestrictedPublicQwenService;
}

const terminals = (frames: readonly TaiStreamEvent[]) => frames.filter((f) => f.kind !== 'delta');

describe('RestrictedPublicQwenController.stream', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TAI_PUBLIC_GATEWAY_HMAC_SECRET: SECRET };
  });

  afterEach(() => { process.env = originalEnv; });

  it('emits normalized events in order and ends with one terminal frame', async () => {
    const h = harness();
    const controller = new RestrictedPublicQwenController(serviceYielding([
      { kind: 'delta', text: 'Урожайность зависит от питания. ' },
      { kind: 'delta', text: 'Также важна влага.' },
      { kind: 'done', finishReason: 'stop', promptTokens: 10, completionTokens: 4, modelIdentity: 'tai-qwen3-8b-q4km' },
    ]));

    await controller.stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(h.frames().map((f) => f.kind)).toEqual(['delta', 'delta', 'done']);
    expect(terminals(h.frames())).toHaveLength(1);
    expect(h.ended).toBe(true);
  });

  it('sets streaming headers and echoes the trace id', async () => {
    const h = harness();
    const controller = new RestrictedPublicQwenController(serviceYielding([
      { kind: 'done', finishReason: 'stop', promptTokens: null, completionTokens: null, modelIdentity: 'tai-qwen3-8b-q4km' },
    ]));

    await controller.stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(h.status).toBe(200);
    expect(h.headers['Content-Type']).toContain('text/event-stream');
    expect(h.headers['X-Accel-Buffering']).toBe('no');
    expect(h.headers['x-tai-trace-id']).toBe(TRACE);
  });

  it('does not echo a malformed trace id', async () => {
    const h = harness();
    const controller = new RestrictedPublicQwenController(serviceYielding([
      { kind: 'done', finishReason: 'stop', promptTokens: null, completionTokens: null, modelIdentity: 'm' },
    ]));

    await controller.stream(BODY, signedHeaders(BODY, 'not-a-trace; DROP TABLE deals'), h.response, h.request);

    expect(h.headers['x-tai-trace-id']).toBeUndefined();
    expect(h.wire).not.toContain('DROP TABLE');
  });

  it('never writes the prompt, grounding or model internals onto the wire', async () => {
    const h = harness();
    const controller = new RestrictedPublicQwenController(serviceYielding([
      { kind: 'delta', text: 'Питание и влага определяют результат.' },
      { kind: 'done', finishReason: 'stop', promptTokens: 10, completionTokens: 4, modelIdentity: 'tai-qwen3-8b-q4km' },
    ]));

    await controller.stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(h.wire).not.toContain('Почему падает урожайность');
    expect(h.wire).not.toContain('public-kb-2026-07-29');
    expect(h.wire).not.toContain('Публичная база');
    expect(h.wire).not.toContain(SECRET);
  });

  it('fails the stream if an internal marker survives the safety buffer', async () => {
    // Stripping it here would emit a clean answer and hide that the buffer's
    // guarantee had been broken.
    const h = harness();
    const controller = new RestrictedPublicQwenController(serviceYielding([
      { kind: 'delta', text: 'Ответ <think>скрытое</think>' },
    ]));

    await controller.stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(h.wire).not.toContain('скрытое');
    expect(terminals(h.frames())).toEqual([{ kind: 'error', errorClass: 'safety_internal_marker' }]);
  });

  it('passes an abort signal the client disconnect can trigger', async () => {
    const h = harness();
    let captured: AbortSignal | undefined;
    const controller = new RestrictedPublicQwenController(
      serviceYielding([{ kind: 'delta', text: 'частично' }], (signal) => { captured = signal; }),
    );

    await controller.stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(captured).toBeInstanceOf(AbortSignal);
    // The finally block aborts once the response is finished, so an abandoned
    // generation cannot outlive the request.
    expect(captured?.aborted).toBe(true);
  });

  it('turns a generator that ends without a terminal event into a controlled error', async () => {
    const h = harness();
    const controller = new RestrictedPublicQwenController(serviceYielding([{ kind: 'delta', text: 'обрыв' }]));

    await controller.stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(terminals(h.frames())).toEqual([{ kind: 'error', errorClass: 'provider_transport' }]);
  });

  it('emits one terminal event even when the generator throws', async () => {
    const h = harness();
    const service = {
      // eslint-disable-next-line require-yield -- the throw is the behaviour under test
      async* generateStream() { throw new Error('provider exploded'); },
    } as unknown as RestrictedPublicQwenService;

    await new RestrictedPublicQwenController(service).stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(terminals(h.frames())).toEqual([{ kind: 'error', errorClass: 'internal' }]);
    expect(h.wire).not.toContain('provider exploded');
    expect(h.ended).toBe(true);
  });

  it('never emits a second terminal event', async () => {
    const h = harness();
    const controller = new RestrictedPublicQwenController(serviceYielding([
      { kind: 'error', errorClass: 'provider_contract' },
      { kind: 'done', finishReason: 'stop', promptTokens: null, completionTokens: null, modelIdentity: 'm' },
    ]));

    await controller.stream(BODY, signedHeaders(BODY), h.response, h.request);

    expect(terminals(h.frames())).toEqual([{ kind: 'error', errorClass: 'provider_contract' }]);
  });

  it('refuses an unsigned request before reaching the model', async () => {
    const h = harness();
    let called = false;
    const controller = new RestrictedPublicQwenController(
      serviceYielding([], () => { called = true; }),
    );

    await expect(controller.stream(BODY, {}, h.response, h.request)).rejects.toBeDefined();
    expect(called).toBe(false);
  });
});
