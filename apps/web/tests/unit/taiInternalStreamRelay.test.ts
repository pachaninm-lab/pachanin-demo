import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';
import {
  applyGeneralAgroResponseBudget,
  signInternalStreamRequest,
  streamInternalModel,
  type InternalStreamEvent,
} from '@/lib/platform-v7/tai-internal-stream';

const STREAM = 'stream-abcdef12';
const IDENTITY = 'qwen2.5-7b-instruct';

const config = {
  endpoint: new URL('http://127.0.0.1:4000/internal/tai/public-generate-stream'),
  secret: 's'.repeat(48),
  identity: IDENTITY,
  timeoutMs: 5_000,
};

const meta = (modelIdentity: string | null = IDENTITY): GatewayFrame => ({
  event: 'meta', mode: 'public', streamId: STREAM, modelIdentity,
});
const token = (text: string): GatewayFrame => ({ event: 'token', streamId: STREAM, text });
const done = (complete: boolean): GatewayFrame => ({ event: 'done', streamId: STREAM, complete });
const failure = (): GatewayFrame => ({
  event: 'error', streamId: STREAM, refusal: 'UPSTREAM_ERROR', message: 'upstream died',
});

/** Serve a wire body in the exact byte slices given, so boundaries are testable. */
function serve(slices: readonly string[], options: { status?: number; gapMs?: number } = {}) {
  const encoder = new TextEncoder();
  const state = { aborted: false };

  global.fetch = (async (_input: unknown, init?: RequestInit) => {
    if (options.status && options.status !== 200) {
      return new Response('no', { status: options.status });
    }
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const slice of slices) {
          if (init?.signal?.aborted) {
            state.aborted = true;
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            return;
          }
          if (options.gapMs) await new Promise((resolve) => setTimeout(resolve, options.gapMs));
          controller.enqueue(encoder.encode(slice));
        }
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  }) as typeof global.fetch;

  return state;
}

async function collect(signal = new AbortController().signal): Promise<InternalStreamEvent[]> {
  const events: InternalStreamEvent[] = [];
  for await (const event of streamInternalModel(config, { question: 'тест' }, signal)) {
    events.push(event);
  }
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('internal stream signing', () => {
  it('signs the streaming path, not the buffered one', () => {
    const signed = signInternalStreamRequest(config.secret, '{"a":1}', 1_700_000_000);

    expect(signed.timestamp).toBe('1700000000');
    expect(signed.signature).toMatch(/^[a-f0-9]{64}$/u);
    // A signature over the buffered path must not be reusable here.
    const other = signInternalStreamRequest(`${config.secret}x`, '{"a":1}', 1_700_000_000);
    expect(other.signature).not.toBe(signed.signature);
  });

  it('adds a typed completion profile without mutating the user question or state', () => {
    const question = 'Как интерпретировать коэффициент кущения?';
    const general = applyGeneralAgroResponseBudget({
      question,
      originalQuestion: question,
      locale: 'ru',
      answerMode: 'general_agro',
      conversationState: 'topic: crop:wheat',
    }) as Record<string, unknown>;
    const verified = {
      question: 'Как работает аукцион?',
      originalQuestion: 'Как работает аукцион?',
      locale: 'ru',
      answerMode: 'verified_platform',
    };

    expect(general.question).toBe(question);
    expect(general.originalQuestion).toBe(question);
    expect(general.conversationState).toBe('topic: crop:wheat');
    expect(general.responseBudget).toEqual({ profile: 'concise' });
    expect(applyGeneralAgroResponseBudget(verified)).toBe(verified);
  });

  it('selects a detailed profile in RU, EN and ZH without appending prompt text', () => {
    for (const [question, locale] of [
      ['Объясни подробно, как хранить зерно после уборки', 'ru'],
      ['Explain grain storage in detail', 'en'],
      ['请详细说明粮食收获后如何储存', 'zh'],
    ] as const) {
      const budgeted = applyGeneralAgroResponseBudget({
        question,
        originalQuestion: question,
        locale,
        answerMode: 'general_agro',
      }) as Record<string, unknown>;
      expect(budgeted.question).toBe(question);
      expect(budgeted.responseBudget).toEqual({ profile: 'detailed' });
    }
  });

  it('preserves a valid 1200-character question exactly', () => {
    const question = 'п'.repeat(1_200);
    const budgeted = applyGeneralAgroResponseBudget({
      question,
      originalQuestion: question,
      locale: 'ru',
      answerMode: 'general_agro',
    }) as Record<string, unknown>;

    expect(budgeted.question).toBe(question);
    expect((budgeted.question as string)).toHaveLength(1_200);
    expect(budgeted.responseBudget).toEqual({ profile: 'concise' });
  });
});

describe('relaying an internal stream', () => {
  it('forwards each token as it arrives', async () => {
    serve([encodeFrame(meta()), encodeFrame(token('Первое. ')), encodeFrame(token('Второе.')), encodeFrame(done(true))]);

    const events = await collect();

    expect(events.map((event) => event.kind)).toEqual(['meta', 'token', 'token', 'terminal']);
    expect(events.filter((event) => event.kind === 'token').map((event) => (event as { text: string }).text))
      .toEqual(['Первое. ', 'Второе.']);
    expect(events.at(-1)).toEqual({ kind: 'terminal', complete: true, refusal: null });
  });

  it('reassembles frames split across arbitrary chunk boundaries', async () => {
    const wire = [meta(), token('Пшеница желтеет. '), token('Причин несколько.'), done(true)].map(encodeFrame).join('');
    const slices = [wire.slice(0, 31), wire.slice(31, 97), wire.slice(97)];
    serve(slices);

    const events = await collect();

    expect(events.filter((event) => event.kind === 'token').map((event) => (event as { text: string }).text).join(''))
      .toBe('Пшеница желтеет. Причин несколько.');
  });

  it('survives a chunk boundary inside a multi-byte character', async () => {
    const wire = [meta(), token('小麦发黄的原因'), done(true)].map(encodeFrame).join('');
    const bytes = new TextEncoder().encode(wire);
    const decoder = new TextDecoder('utf-8');
    // Slice on a raw byte index that is not a character boundary.
    const cut = bytes.length - 40;
    serve([decoder.decode(bytes.slice(0, cut), { stream: true } as never), decoder.decode(bytes.slice(cut))]);

    const events = await collect();

    expect(events.some((event) => event.kind === 'token' && (event as { text: string }).text.includes('小麦发黄')))
      .toBe(true);
  });

  it('stops at the first terminal frame and never emits two', async () => {
    serve([
      encodeFrame(meta()),
      encodeFrame(token('Ответ.')),
      encodeFrame(done(true)),
      encodeFrame(token('после конца')),
      encodeFrame(done(true)),
    ]);

    const events = await collect();

    expect(events.filter((event) => event.kind === 'terminal')).toHaveLength(1);
    expect(events.filter((event) => event.kind === 'token')).toHaveLength(1);
  });

  it('reports an upstream error as a refusal rather than an answer', async () => {
    serve([encodeFrame(meta()), encodeFrame(token('нача')), encodeFrame(failure())]);

    const events = await collect();

    expect(events.at(-1)).toEqual({ kind: 'terminal', complete: false, refusal: 'UPSTREAM_ERROR' });
  });

  it('treats a body that simply ended as an unfinished answer', async () => {
    serve([encodeFrame(meta()), encodeFrame(token('половина'))]);

    const events = await collect();

    expect(events.at(-1)).toEqual({ kind: 'terminal', complete: false, refusal: 'UPSTREAM_ERROR' });
  });

  it('refuses a stream whose model identity is not the admitted one', async () => {
    serve([encodeFrame(meta('some-other-model')), encodeFrame(token('x')), encodeFrame(done(true))]);

    await expect(collect()).rejects.toThrow(/identity_mismatch/u);
  });

  it('refuses a token that arrives before the model was announced', async () => {
    serve([encodeFrame(token('x')), encodeFrame(done(true))]);

    await expect(collect()).rejects.toThrow(/token_before_meta/u);
  });

  it('refuses a frame the contract rejects, even though the API sent it', async () => {
    const hostile = 'event: token\ndata: {"event":"token","streamId":"stream-abcdef12","text":"ок","tenantId":"t-1"}\n\n';
    serve([encodeFrame(meta()), hostile]);

    await expect(collect()).rejects.toThrow(/frame_rejected/u);
  });

  it('refuses a non-200 upstream instead of relaying nothing as success', async () => {
    serve([], { status: 503 });

    await expect(collect()).rejects.toThrow(/http_503/u);
  });

  it('aborts the upstream request when the reader cancels', async () => {
    const state = serve(
      [encodeFrame(meta()), encodeFrame(token('один. ')), encodeFrame(token('два. ')), encodeFrame(done(true))],
      { gapMs: 15 },
    );
    const reader = new AbortController();

    await expect((async () => {
      for await (const event of streamInternalModel(config, { question: 'тест' }, reader.signal)) {
        if (event.kind === 'token') reader.abort();
      }
    })()).rejects.toThrow();

    expect(state.aborted).toBe(true);
  });

  it('refuses immediately when the reader has already gone', async () => {
    serve([encodeFrame(meta()), encodeFrame(done(true))]);
    const reader = new AbortController();
    reader.abort();

    await expect(collect(reader.signal)).rejects.toThrow();
  });
});
