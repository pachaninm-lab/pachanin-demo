import { RestrictedPublicQwenService, type TaiStreamEvent } from './restricted-public-qwen.service';

const REQUEST = {
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
    maturity: 'Контекст платформы может быть нерелевантен.',
    confidence: 'medium',
    sources: [{ label: 'Главная платформы', href: '/platform-v7' }],
  },
} as const;

function sseFrame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

/**
 * A provider body whose final chunk is withheld until released, so a test can
 * observe whether text reaches the consumer before generation completes.
 */
function pausedProviderBody(head: readonly string[], tail: readonly string[]) {
  const encoder = new TextEncoder();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let cancelled = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of head) controller.enqueue(encoder.encode(chunk));
      await gate;
      for (const chunk of tail) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
    cancel() { cancelled = true; release(); },
  });

  return { body, release: () => release(), wasCancelled: () => cancelled };
}

function providerResponse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function streamOf(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  return providerResponse(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }));
}

async function collect(events: AsyncGenerator<TaiStreamEvent>): Promise<TaiStreamEvent[]> {
  const seen: TaiStreamEvent[] = [];
  for await (const event of events) seen.push(event);
  return seen;
}

const text = (events: readonly TaiStreamEvent[]) =>
  events.filter((e) => e.kind === 'delta').map((e) => (e as { text: string }).text).join('');

const terminals = (events: readonly TaiStreamEvent[]) =>
  events.filter((e) => e.kind === 'done' || e.kind === 'error' || e.kind === 'cancelled');

describe('RestrictedPublicQwenService.generateStream', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TAI_RESTRICTED_QWEN_PUBLIC_ENABLED: 'true',
      AI_ASSISTANT_PROVIDER: 'openai-compatible',
      AI_ASSISTANT_BASE_URL: 'http://192.168.0.206:18080/v1/',
      AI_ASSISTANT_MODEL: 'tai-qwen3-8b-q4km',
      AI_ASSISTANT_API_KEY: 'k'.repeat(48),
      AI_ASSISTANT_ALLOWED_HOSTS: '192.168.0.206',
      AI_ASSISTANT_TIMEOUT_MS: '45000',
      AI_ASSISTANT_MAX_TOKENS: '500',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('asks the provider to stream', async () => {
    const fetchMock = jest.fn().mockResolvedValue(streamOf([sseFrame('Ответ.'), 'data: [DONE]\n\n']));
    global.fetch = fetchMock as typeof fetch;

    await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    expect(body.stream).toBe(true);
  });

  it('delivers safe text before the provider has finished generating', async () => {
    // The property that separates real streaming from chunking a finished
    // answer: a consumer sees text while the provider is still producing.
    const paused = pausedProviderBody(
      [sseFrame('Урожайность зависит от питания. ')],
      [sseFrame('Также важна влага.'), 'data: [DONE]\n\n'],
    );
    global.fetch = jest.fn().mockResolvedValue(providerResponse(paused.body)) as typeof fetch;

    const events = new RestrictedPublicQwenService().generateStream(REQUEST);
    const first = await events.next();

    expect(first.value).toEqual({ kind: 'delta', text: 'Урожайность зависит от питания. ' });

    paused.release();
    const rest: TaiStreamEvent[] = [];
    for await (const event of events) rest.push(event);
    expect(text([first.value as TaiStreamEvent, ...rest])).toContain('Также важна влага.');
  });

  it('never emits reasoning split across chunk boundaries', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamOf([
      sseFrame('Ответ. <thi'),
      sseFrame('nk>внутренние рассуждения</think>'),
      sseFrame(' Вывод.'),
      'data: [DONE]\n\n',
    ])) as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(text(events)).not.toContain('внутренние рассуждения');
    expect(text(events)).toContain('Ответ.');
    expect(text(events)).toContain('Вывод.');
  });

  it('blocks a credential assembled across chunks and terminates', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamOf([
      sseFrame('Ключ: sk-proj-'),
      sseFrame('ABCDEFGHIJKLMNOP'),
      sseFrame('QRSTUV конец.'),
      'data: [DONE]\n\n',
    ])) as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(text(events)).not.toContain('sk-proj-ABCDEFGHIJKLMNOPQRSTUV');
    expect(terminals(events)).toEqual([{ kind: 'error', errorClass: 'safety_secret_like' }]);
  });

  it('blocks a false completed-write claim rather than streaming it', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamOf([
      sseFrame('Я под'),
      sseFrame('писал документ и выплатил деньги.'),
      'data: [DONE]\n\n',
    ])) as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(text(events)).not.toContain('подписал документ');
    expect(terminals(events)).toEqual([{ kind: 'error', errorClass: 'safety_write_claim' }]);
  });

  it('emits exactly one terminal event on a clean stream', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamOf([sseFrame('Готово.'), 'data: [DONE]\n\n'])) as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(terminals(events)).toHaveLength(1);
    expect(terminals(events)[0]).toMatchObject({ kind: 'done', modelIdentity: 'tai-qwen3-8b-q4km' });
  });

  it('ends with a controlled error on a malformed provider frame', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamOf([sseFrame('Начало. '), 'data: {broken\n\n'])) as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(terminals(events)).toEqual([{ kind: 'error', errorClass: 'provider_contract' }]);
  });

  it('ends with a controlled error when the provider disconnects mid-record', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamOf(['data: {"choices":[{"delta":{"content":"обрыв'])) as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(terminals(events)).toEqual([{ kind: 'error', errorClass: 'provider_transport' }]);
  });

  it('reports an unavailable model as a controlled error, not a hang', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('nope', { status: 503 })) as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(terminals(events)).toEqual([{ kind: 'error', errorClass: 'provider_http' }]);
  });

  it('aborts upstream generation when the caller cancels', async () => {
    // Real fetch errors the response body when its signal aborts. The mock must
    // do the same, or the test would hang on a read that production would never
    // leave pending — and would be asserting the mock, not the service.
    const encoder = new TextEncoder();
    let passedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_url: URL, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      passedSignal = signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(sseFrame('Начало. ')));
          signal.addEventListener('abort', () => {
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          }, { once: true });
        },
      });
      return Promise.resolve(providerResponse(body));
    }) as unknown as typeof fetch;

    const abort = new AbortController();
    const events = new RestrictedPublicQwenService().generateStream(REQUEST, abort.signal);
    await events.next();

    abort.abort();
    const tail = await events.next();

    expect(tail.value ?? { kind: 'cancelled' }).toMatchObject({ kind: 'cancelled' });
    expect(passedSignal?.aborted).toBe(true);
  });

  it('aborts upstream when the consumer abandons the generator', async () => {
    // A consumer that stops reading — a disconnected browser — must not leave
    // the provider generating tokens nobody will collect.
    const paused = pausedProviderBody([sseFrame('Начало. ')], [sseFrame('хвост'), 'data: [DONE]\n\n']);
    let passedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_url: URL, init: RequestInit) => {
      passedSignal = init.signal as AbortSignal;
      return Promise.resolve(providerResponse(paused.body));
    }) as unknown as typeof fetch;

    const events = new RestrictedPublicQwenService().generateStream(REQUEST);
    await events.next();
    await events.return(undefined as never);

    expect(passedSignal?.aborted).toBe(true);
  });

  it('refuses to stream the grounded contour, where the whole answer is required', async () => {
    global.fetch = jest.fn() as typeof fetch;

    const events = await collect(new RestrictedPublicQwenService()
      .generateStream({ ...REQUEST, answerMode: 'verified_platform' }));

    expect(events).toEqual([{ kind: 'error', errorClass: 'streaming_unsupported_mode' }]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails closed when the restricted contour is disabled', async () => {
    process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED = 'false';

    const events = await collect(new RestrictedPublicQwenService().generateStream(REQUEST));

    expect(events).toEqual([{ kind: 'error', errorClass: 'feature_disabled' }]);
  });
});
