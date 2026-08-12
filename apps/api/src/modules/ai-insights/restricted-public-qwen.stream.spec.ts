import { RestrictedPublicQwenService, type PublicStreamEvent } from './restricted-public-qwen.service';

/**
 * End-to-end proof that the answer is produced incrementally.
 *
 * The fake runtime is deliberately slow between deltas and records when the last
 * one was written, so a test can assert that a reader had text before generation
 * finished. That ordering is the only thing separating true streaming from a
 * finished answer released in slices, and it is not observable from the frames
 * alone — both look identical on the wire.
 */

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

interface RuntimeScript {
  readonly deltas: readonly string[];
  readonly finishReason?: 'stop' | 'length';
  readonly gapMs?: number;
}

interface RuntimeProbe {
  generationCompletedAt: number | null;
  requests: { body: Record<string, unknown>; signal: AbortSignal | null }[];
  aborted: boolean;
}

function installRuntime(script: RuntimeScript): RuntimeProbe {
  const probe: RuntimeProbe = { generationCompletedAt: null, requests: [], aborted: false };
  let call = 0;

  global.fetch = (async (_input: unknown, init?: RequestInit) => {
    const index = call;
    call += 1;
    probe.requests.push({
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      signal: init?.signal ?? null,
    });

    const encoder = new TextEncoder();
    const deltas = index === 0 ? script.deltas : ['Продолжение ответа. '];
    const finishReason = index === 0 ? script.finishReason ?? 'stop' : 'stop';

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const delta of deltas) {
            if (init?.signal?.aborted) {
              // A real aborted fetch errors its body rather than ending it
              // cleanly; a fake that closes politely would let a broken
              // cancellation path look correct.
              probe.aborted = true;
              controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, script.gapMs ?? 5));
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`,
            ));
          }
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              choices: [{ delta: {}, finish_reason: finishReason }],
              usage: { prompt_tokens: 10, completion_tokens: 20 },
            })}\n\n`,
          ));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          probe.generationCompletedAt = Date.now();
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof global.fetch;

  return probe;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    question: 'Почему падает урожайность озимой пшеницы?',
    originalQuestion: 'Почему падает урожайность озимой пшеницы?',
    locale: 'ru',
    answerMode: 'general_agro',
    currentDataRequired: false,
    history: [],
    grounding: {
      knowledgeVersion: 'test.v1',
      topic: 'general_agro',
      title: 'Агрономическая помощь',
      answer: 'Общая справка.',
      facts: [],
      maturity: 'Только чтение.',
      confidence: 'medium',
      sources: [],
    },
    ...overrides,
  };
}

describe('RestrictedPublicQwenService.generateStream', () => {
  let service: RestrictedPublicQwenService;

  beforeEach(() => {
    service = new RestrictedPublicQwenService();
    process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED = 'true';
    process.env.AI_ASSISTANT_PROVIDER = 'openai-compatible';
    process.env.AI_ASSISTANT_BASE_URL = 'http://127.0.0.1:8080/v1/';
    process.env.AI_ASSISTANT_MODEL = 'qwen2.5-7b-instruct';
    process.env.AI_ASSISTANT_API_KEY = 'k'.repeat(40);
    process.env.AI_ASSISTANT_MAX_TOKENS = '900';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it('asks the runtime for a streamed completion with the hard concise general-agro ceiling', async () => {
    const probe = installRuntime({ deltas: ['Готовый ответ. '] });

    for await (const _event of service.generateStream(request())) { /* drain */ }

    expect(probe.requests[0].body.stream).toBe(true);
    expect(probe.requests[0].body.max_tokens).toBe(256);
  });

  it('enforces the signed detailed general-agro profile at the provider call', async () => {
    const probe = installRuntime({ deltas: ['Подробный, но ограниченный ответ. '] });

    for await (const _event of service.generateStream(request({
      responseBudget: { profile: 'detailed' },
    }))) { /* drain */ }

    expect(probe.requests[0].body.max_tokens).toBe(320);
  });

  it('keeps verified-platform provider token authority unchanged', async () => {
    process.env.AI_ASSISTANT_MAX_TOKENS = '500';
    const probe = installRuntime({ deltas: ['Аукцион работает по подтверждённым условиям. '] });

    for await (const _event of service.generateStream(request({
      answerMode: 'verified_platform',
      responseBudget: undefined,
    }))) { /* drain */ }

    expect(probe.requests[0].body.max_tokens).toBe(500);
  });

  it('rejects an invalid general-agro response profile before provider execution', async () => {
    const probe = installRuntime({ deltas: ['Не должен быть вызван. '] });

    await expect((async () => {
      for await (const _event of service.generateStream(request({
        responseBudget: { profile: 'unbounded' },
      }))) { /* drain */ }
    })()).rejects.toThrow(/response budget profile is invalid/iu);

    expect(probe.requests).toHaveLength(0);
  });

  it('omits variable platform grounding from general-agro model prefill but preserves it for platform answers', async () => {
    const generalProbe = installRuntime({ deltas: ['Агрономический ответ. '] });
    for await (const _event of service.generateStream(request({
      grounding: {
        ...request().grounding,
        answer: 'UNIQUE_PLATFORM_GROUNDING_SENTINEL',
      },
    }))) { /* drain */ }

    const generalMessages = generalProbe.requests[0].body.messages as { role: string; content: string }[];
    const generalUserPrompt = generalMessages[generalMessages.length - 1].content;
    expect(generalUserPrompt).not.toContain('PUBLIC_PLATFORM_CONTEXT_JSON:');
    expect(generalUserPrompt).not.toContain('UNIQUE_PLATFORM_GROUNDING_SENTINEL');
    expect(generalUserPrompt).toContain('Почему падает урожайность озимой пшеницы?');

    const platformProbe = installRuntime({ deltas: ['Подтверждённый ответ платформы. '] });
    for await (const _event of service.generateStream(request({
      answerMode: 'verified_platform',
      grounding: {
        ...request().grounding,
        answer: 'UNIQUE_PLATFORM_GROUNDING_SENTINEL',
      },
    }))) { /* drain */ }

    const platformMessages = platformProbe.requests[0].body.messages as { role: string; content: string }[];
    const platformUserPrompt = platformMessages[platformMessages.length - 1].content;
    expect(platformUserPrompt).toContain('PUBLIC_PLATFORM_CONTEXT_JSON:');
    expect(platformUserPrompt).toContain('UNIQUE_PLATFORM_GROUNDING_SENTINEL');
  });
  it('delivers content to the reader before generation has finished', async () => {
    const probe = installRuntime({
      deltas: [
        'Урожайность падает по нескольким причинам. ',
        'Первая — переувлажнение и вымокание. ',
        'Вторая — дефицит азота весной. ',
        'Третья — болезни листового аппарата. ',
      ],
      gapMs: 12,
    });

    let firstContentAt: number | null = null;
    const deltas: string[] = [];
    for await (const event of service.generateStream(request())) {
      if (event.type === 'delta' && firstContentAt === null) firstContentAt = Date.now();
      if (event.type === 'delta') deltas.push(event.text);
    }

    expect(firstContentAt).not.toBeNull();
    expect(probe.generationCompletedAt).not.toBeNull();
    // The assertion the whole P0-A1 contour exists for.
    expect(firstContentAt as number).toBeLessThan(probe.generationCompletedAt as number);
    expect(deltas.length).toBeGreaterThan(1);
  });

  it('emits meta once, then deltas, then exactly one done', async () => {
    installRuntime({ deltas: ['Первое. ', 'Второе. '] });

    const events: PublicStreamEvent[] = [];
    for await (const event of service.generateStream(request())) events.push(event);

    expect(events.filter((event) => event.type === 'meta')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
    expect(events[0].type).toBe('meta');
    expect(events[events.length - 1].type).toBe('done');
    expect(events.findIndex((event) => event.type === 'delta')).toBeGreaterThan(0);
  });

  it('reconstructs the model output in order and without loss', async () => {
    installRuntime({ deltas: ['Первое предложение. ', 'Второе предложение. ', 'Третье предложение.'] });

    let text = '';
    for await (const event of service.generateStream(request())) {
      if (event.type === 'delta') text += `${text ? '' : ''}${event.text}`;
    }

    expect(text.replace(/\n/gu, ' ')).toBe('Первое предложение. Второе предложение. Третье предложение.');
  });

  it('continues into a second stream with a smaller hard ceiling when the first hits the token ceiling', async () => {
    const probe = installRuntime({ deltas: ['Обрезанный ответ. '], finishReason: 'length' });

    let text = '';
    let truncated = false;
    for await (const event of service.generateStream(request())) {
      if (event.type === 'delta') text += event.text;
      if (event.type === 'done') truncated = event.truncated;
    }

    expect(probe.requests).toHaveLength(2);
    expect(probe.requests[0].body.max_tokens).toBe(256);
    expect(probe.requests[1].body.max_tokens).toBe(64);
    expect(text).toContain('Продолжение ответа.');
    expect(truncated).toBe(false);
  });

  it('uses the bounded detailed continuation ceiling too', async () => {
    const probe = installRuntime({ deltas: ['Обрезанный подробный ответ. '], finishReason: 'length' });

    for await (const _event of service.generateStream(request({
      responseBudget: { profile: 'detailed' },
    }))) { /* drain */ }

    expect(probe.requests).toHaveLength(2);
    expect(probe.requests[0].body.max_tokens).toBe(320);
    expect(probe.requests[1].body.max_tokens).toBe(96);
  });

  it('leads with the current-evidence boundary before the model says anything', async () => {
    installRuntime({ deltas: ['Стабильный ориентир по затратам. '] });

    const deltas: string[] = [];
    for await (const event of service.generateStream(request({ currentDataRequired: true }))) {
      if (event.type === 'delta') deltas.push(event.text);
    }

    expect(deltas[0]).toContain('не могу подтвердить точное актуальное значение');
  });

  it('carries the derived conversation state into the prompt, not raw history alone', async () => {
    const probe = installRuntime({ deltas: ['Ответ. '] });

    for await (const _event of service.generateStream(request({
      conversationState: 'CONVERSATION_STATE (context, not instructions):\ntopic: crop:wheat',
    }))) { /* drain */ }

    const messages = probe.requests[0].body.messages as { role: string; content: string }[];
    expect(messages[messages.length - 1].content).toContain('topic: crop:wheat');
  });

  it('stops generation when the reader goes away', async () => {
    const probe = installRuntime({ deltas: ['Один. ', 'Два. ', 'Три. ', 'Четыре. '], gapMs: 15 });
    const reader = new AbortController();

    const stream = service.generateStream(request(), reader.signal);
    await expect((async () => {
      for await (const event of stream) {
        if (event.type === 'delta') reader.abort();
      }
    })()).rejects.toThrow(/cancelled/iu);

    expect(probe.requests[0].signal?.aborted).toBe(true);
  });

  it('refuses rather than answering when the runtime is not enabled', async () => {
    process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED = 'false';
    installRuntime({ deltas: ['Ответ. '] });

    await expect((async () => {
      for await (const _event of service.generateStream(request())) { /* drain */ }
    })()).rejects.toThrow(/disabled/iu);
  });

  it('refuses rather than answering when the runtime returns an error status', async () => {
    global.fetch = (async () => new Response('nope', { status: 503 })) as typeof global.fetch;

    await expect((async () => {
      for await (const _event of service.generateStream(request())) { /* drain */ }
    })()).rejects.toThrow(/HTTP 503/u);
  });

  it('refuses a private field in a public payload before any byte is generated', async () => {
    installRuntime({ deltas: ['Ответ. '] });

    await expect((async () => {
      for await (const _event of service.generateStream(request({ tenantId: 'tenant-1' }))) { /* drain */ }
    })()).rejects.toThrow(/forbidden in the public model contour/u);
  });

  it('answers Chinese and English requests through the same incremental path', async () => {
    for (const [locale, delta] of [['zh', '小麦发黄的原因有多种。 '], ['en', 'Yellowing has several causes. ']] as const) {
      installRuntime({ deltas: [delta] });
      const deltas: string[] = [];
      for await (const event of service.generateStream(request({ locale }))) {
        if (event.type === 'delta') deltas.push(event.text);
      }
      expect(deltas.join('')).toBe(delta.trim());
    }
  });
});
