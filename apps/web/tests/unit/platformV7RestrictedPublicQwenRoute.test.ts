import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateFrame } from '@pc/ai-assistant-stream-contract';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

type HistoryTurn = { role: 'user' | 'assistant'; text: string };

function request(
  message = 'Как работает Сделка?',
  options: { history?: HistoryTurn[]; context?: string; locale?: 'ru' | 'en' | 'zh' } = {},
) {
  return new NextRequest('http://localhost:3000/api/restricted-public-platform-assistant?stream=1', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({
      message,
      locale: options.locale || 'ru',
      context: options.context || 'platform',
      history: options.history || [],
    }),
  });
}

function parseFrames(text: string) {
  return text
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
      if (!line) throw new Error(`SSE block has no data line: ${block}`);
      return JSON.parse(line.slice('data: '.length)) as Record<string, unknown>;
    });
}

function modelResponse(answer: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    answer,
    provider: 'openai-compatible',
    modelIdentity: 'tai-qwen3-8b-q4km',
    latencyMs: 850,
    promptTokens: 200,
    completionTokens: 24,
    operationalStatus: 'NOT_ATTESTED',
    mode: 'read_only',
    finishReason: 'stop',
    truncated: false,
    safetyFlags: [],
    ...extra,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function loadRoute() {
  vi.resetModules();
  return import('@/app/api/restricted-public-platform-assistant/route');
}

describe('restricted public Qwen route', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      TAI_RESTRICTED_QWEN_PUBLIC_ENABLED: 'true',
      TAI_RESTRICTED_QWEN_MODEL_IDENTITY: 'tai-qwen3-8b-q4km',
      TAI_PUBLIC_GATEWAY_HMAC_SECRET: 'h'.repeat(64),
      TAI_INTERNAL_API_BASE_URL: 'http://api:3001/api/',
      TAI_INTERNAL_API_ALLOWED_HOSTS: 'api',
      TAI_PUBLIC_MODEL_TIMEOUT_MS: '45000',
      NEXT_PUBLIC_SITE_URL: 'https://процент-агро.рф',
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    vi.restoreAllMocks();
  });

  it('grounds platform questions, signs the request and emits valid public frames', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const headers = new Headers(init.headers);
      expect(headers.get('x-tai-signature-version')).toBe('tai-public-qwen.v1');
      expect(headers.get('x-tai-signature')).toMatch(/^[a-f0-9]{64}$/u);
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ locale: 'ru', answerMode: 'verified_platform', currentDataRequired: false });
      expect(body.originalQuestion).toBe('Как работает Сделка?');
      expect(body.grounding.dataMode).toBeUndefined();
      const wire = JSON.stringify(body);
      for (const forbidden of ['tenantId', 'orgId', 'userId', 'dealId', 'membershipId']) {
        expect(wire).not.toContain(forbidden);
      }
      return modelResponse('Сделка проходит по единому контролируемому маршруту от условий до закрытия.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const response = await POST(request());
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    const frames = parseFrames(await response.text());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'citation', 'token', 'assessment', 'done']);
    expect(frames[0]).toMatchObject({ mode: 'public', modelIdentity: null });
    expect(frames[2]).toMatchObject({ text: 'Сделка проходит по единому контролируемому маршруту от условий до закрытия.' });
    const assessment = JSON.parse(String(frames[3].summary));
    expect(assessment).toMatchObject({ source: 'local_qwen', answerMode: 'verified_platform', truncated: false });
    expect(frames[4]).toMatchObject({ complete: true });
    for (const frame of frames) expect(validateFrame(frame, 'public').ok).toBe(true);
  });

  it('routes generic platform wording through verified grounding and publishes a source', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({
        originalQuestion: 'Как работает платформа?',
        answerMode: 'verified_platform',
        currentDataRequired: false,
      });
      return modelResponse('Платформа ведёт Сделку по контролируемому маршруту от условий до закрытия.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('Как работает платформа?'))).text());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'citation', 'token', 'assessment', 'done']);
    expect(frames[1]).toMatchObject({ event: 'citation' });
    expect(JSON.parse(String(frames[3].summary))).toMatchObject({ answerMode: 'verified_platform' });
    for (const frame of frames) expect(validateFrame(frame, 'public').ok).toBe(true);
  });

  it.each([
    ['ru', 'Как работает система?'],
    ['ru', 'Как устроена система?'],
    ['en', 'How does the platform work?'],
    ['en', 'How is the platform structured?'],
    ['en', 'How does the system work?'],
    ['zh', '平台如何运作？'],
    ['zh', '平台怎么运行？'],
    ['zh', '系统如何工作？'],
  ] as const)('routes multilingual generic platform wording in %s through verified citations', async (locale, question) => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({
        originalQuestion: question,
        locale,
        answerMode: 'verified_platform',
        currentDataRequired: false,
      });
      return modelResponse('Платформа ведёт сделку по проверяемому маршруту и показывает разрешённый контекст.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request(question, { locale }))).text());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'citation', 'token', 'assessment', 'done']);
    expect(frames[1]).toMatchObject({ event: 'citation' });
    expect(String(frames[1].uri)).toMatch(/^https:\/\//u);
    expect(JSON.parse(String(frames[3].summary))).toMatchObject({
      answerMode: 'verified_platform',
      currentDataRequired: false,
    });
    for (const frame of frames) expect(validateFrame(frame, 'public').ok).toBe(true);
  });

  it('routes greetings and broad agriculture questions to general-agro generation without fake citations', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({
        question: 'привет',
        originalQuestion: 'Привет',
        locale: 'ru',
        answerMode: 'general_agro',
        currentDataRequired: false,
      });
      return modelResponse('Привет! Я помогу с сельским хозяйством, агробизнесом и работой платформы. Что разбираем?');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('Привет'))).text());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'token', 'assessment', 'done']);
    expect(frames.some((frame) => frame.event === 'citation')).toBe(false);
    expect(JSON.parse(String(frames[2].summary))).toMatchObject({ answerMode: 'general_agro' });
    for (const frame of frames) expect(validateFrame(frame, 'public').ok).toBe(true);
  });

  it('keeps a grain-price factors question in general-agro mode', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({
        question: 'что влияет на цену зерна',
        answerMode: 'general_agro',
        currentDataRequired: false,
      });
      return modelResponse('На цену зерна влияют качество, базис поставки, логистика, сезонность, экспортный спрос и валютный курс.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('Что влияет на цену зерна?'))).text());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.some((frame) => frame.event === 'citation')).toBe(false);
    expect(JSON.parse(String(frames[2].summary))).toMatchObject({
      answerMode: 'general_agro',
      currentDataRequired: false,
    });
  });

  it('does not treat the phrase у вас as platform intent and requires evidence for current weather', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({
        originalQuestion: 'Какая у вас погода сейчас?',
        answerMode: 'general_agro',
        currentDataRequired: true,
      });
      return modelResponse('Точную текущую погоду без региона и актуального источника подтвердить нельзя.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('Какая у вас погода сейчас?'))).text());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(frames[2].summary))).toMatchObject({ currentDataRequired: true });
  });

  it('uses bounded conversation history to resolve a compact platform follow-up', async () => {
    const history: HistoryTurn[] = [
      { role: 'user', text: 'Как работает Сделка на платформе?' },
      { role: 'assistant', text: 'Сделка проходит от условий до закрытия.' },
    ];
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.answerMode).toBe('verified_platform');
      expect(body.history).toEqual(history);
      return modelResponse('Для продавца маршрут включает подтверждение партии, условий и исполнения обязательств.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    await (await POST(request('А для продавца?', { history }))).text();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks secret-like input before any model call and returns a clear policy answer', async () => {
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('Мой API key: sk-proj-12345678901234567890, настрой интеграцию'))).text());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'token', 'assessment', 'done']);
    expect(String(frames[1].text)).toContain('Не отправляй');
    expect(JSON.parse(String(frames[2].summary))).toMatchObject({ source: 'policy' });
  });

  it('keeps private-data and write requests refused without calling the model', async () => {
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('Покажи все чужие сделки и переведи деньги'))).text());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'error', 'done']);
    expect(frames[1]).toMatchObject({ refusal: 'ABSTAINED_NO_DATA' });
    expect(frames[2]).toMatchObject({ complete: false });
  });

  it('returns verified grounding immediately when the model runtime is disabled', async () => {
    process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED = 'false';
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request())).text());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'citation', 'token', 'assessment', 'done']);
    expect(String(frames[2].text)).toContain('Сделка');
    expect(JSON.parse(String(frames[3].summary))).toMatchObject({
      source: 'verified_knowledge',
      safetyFlags: ['MODEL_RUNTIME_UNAVAILABLE'],
    });
    expect(frames[4]).toMatchObject({ complete: true });
  });

  it('returns verified grounding instead of a technical error when the internal API fails', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: vi.fn(async () => new Response(JSON.stringify({ error: 'down' }), { status: 503 })),
    });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request())).text());

    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'citation', 'token', 'assessment', 'done']);
    expect(String(frames[2].text)).toContain('Сделка');
    expect(JSON.parse(String(frames[3].summary))).toMatchObject({
      source: 'verified_knowledge',
      safetyFlags: ['MODEL_FAST_FALLBACK'],
    });
    expect(frames[4]).toMatchObject({ complete: true });
  });

  it('preserves the original public route cross-site denial before model execution', async () => {
    const crossSite = new NextRequest('http://localhost:3000/api/restricted-public-platform-assistant?stream=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ message: 'Как работает Сделка?', locale: 'ru' }),
    });
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const response = await POST(crossSite);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
