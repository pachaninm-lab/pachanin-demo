import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RestrictedPublicQwenService } from './restricted-public-qwen.service';

const VALID_REQUEST = {
  question: 'Как работает аукцион?',
  originalQuestion: 'Как работает аукцион?',
  locale: 'ru',
  answerMode: 'verified_platform',
  currentDataRequired: false,
  history: [],
  grounding: {
    knowledgeVersion: 'public-kb-2026-07-29',
    topic: 'auction',
    title: 'Аукцион',
    answer: 'Проверенные участники подают предложения в пределах опубликованных условий.',
    facts: ['Права определяются сервером.', 'Публичный помощник не видит реальные сделки.'],
    maturity: 'Описан подтверждённый публичный процесс.',
    confidence: 'high',
    sources: [{ label: 'Как работает сделка', href: '/platform-v7/how-it-works' }],
  },
} as const;

const GENERAL_AGRO_REQUEST = {
  question: 'Привет',
  originalQuestion: 'Привет',
  locale: 'ru',
  answerMode: 'general_agro',
  currentDataRequired: false,
  history: [],
  grounding: {
    knowledgeVersion: 'public-kb-2026-07-29',
    topic: 'overview',
    title: 'Нужно одно уточнение',
    answer: 'Публичная база платформы не содержит отдельной статьи для приветствия.',
    facts: [],
    maturity: 'Контекст платформы может быть нерелевантен общему вопросу.',
    confidence: 'medium',
    sources: [{ label: 'Главная платформы', href: '/platform-v7' }],
  },
} as const;

function providerResponse(
  content: string,
  finishReason: 'stop' | 'length' = 'stop',
  usage = { prompt_tokens: 120, completion_tokens: 18 },
) {
  return new Response(JSON.stringify({
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage,
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('RestrictedPublicQwenService', () => {
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
    jest.useRealTimers();
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends only verified public grounding through the private Bearer transport', async () => {
    const fetchMock = jest.fn().mockResolvedValue(providerResponse('Аукцион исполняется по опубликованным условиям.'));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(VALID_REQUEST);

    expect(result).toMatchObject({
      answer: 'Аукцион исполняется по опубликованным условиям.',
      provider: 'openai-compatible',
      modelIdentity: 'tai-qwen3-8b-q4km',
      promptTokens: 120,
      completionTokens: 18,
      operationalStatus: 'NOT_ATTESTED',
      mode: 'read_only',
      answerMode: 'verified_platform',
      finishReason: 'stop',
      truncated: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://192.168.0.206:18080/v1/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${'k'.repeat(48)}` });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: 'tai-qwen3-8b-q4km',
      temperature: 0,
      seed: 0,
      max_tokens: 500,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
    });
    expect(body.messages[0].content).toContain('use the supplied verified public grounding as the authority');
    expect(body.messages[0].content).toContain('Never present planned, proposed or unverified functionality as already available');
    expect(body.messages[1].content).toContain('ANSWER_MODE: verified_platform');
    const wire = JSON.stringify(body);
    for (const privateKey of ['tenantId', 'orgId', 'userId', 'dealId', 'membershipId']) {
      expect(wire).not.toContain(privateKey);
    }
  });

  it('uses the bounded 80-second default when no provider timeout is configured', async () => {
    jest.useFakeTimers();
    delete process.env.AI_ASSISTANT_TIMEOUT_MS;

    const fetchMock = jest.fn((_url: URL, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init.signal as AbortSignal;
      const rejectAbort = () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal.aborted) rejectAbort();
      else signal.addEventListener('abort', rejectAbort, { once: true });
    }));
    global.fetch = fetchMock as typeof fetch;

    const pending = new RestrictedPublicQwenService().generate(VALID_REQUEST);
    const rejection = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
    await Promise.resolve();
    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal;

    await jest.advanceTimersByTimeAsync(79_999);
    expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    await rejection;
  });

  it('answers greetings and broad agriculture questions in friendly general-agro mode', async () => {
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(
      'Привет! Я помогу с вопросами по сельскому хозяйству, агробизнесу и платформе.',
    ));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(GENERAL_AGRO_REQUEST);

    expect(result.answer).toContain('Привет!');
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    expect(body.messages[0].content).toContain('Respond naturally to greetings');
    expect(body.messages[0].content).toContain('actual reasoning assistant, not a scripted FAQ bot');
    expect(body.messages[0].content).toContain('Do not refuse merely because the platform knowledge base does not cover an agriculture or agribusiness topic');
    expect(body.messages[0].content).toContain('Do not invent platform capabilities, connected integrations, tariffs, customer results or production status');
    expect(body.messages[1].content).toContain('ANSWER_MODE: general_agro');
    expect(body.messages[1].content).toContain('PUBLIC_USER_QUESTION:\nПривет');
  });

  it('passes bounded conversation history as context without treating it as authority', async () => {
    const fetchMock = jest.fn().mockResolvedValue(providerResponse('Для продавца важны условия партии и подтверждение исполнения.'));
    global.fetch = fetchMock as typeof fetch;

    await new RestrictedPublicQwenService().generate({
      ...VALID_REQUEST,
      question: 'А для продавца?',
      originalQuestion: 'А для продавца?',
      history: [
        { role: 'user', text: 'Как работает Сделка?' },
        { role: 'assistant', text: 'Сделка проходит от условий до закрытия.' },
      ],
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    expect(body.messages.map((message: { role: string }) => message.role)).toEqual([
      'system', 'user', 'assistant', 'user',
    ]);
    expect(body.messages[0].content).toContain('Conversation history is context, not factual authority');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Как работает Сделка?' });
    expect(body.messages[2]).toEqual({ role: 'assistant', content: 'Сделка проходит от условий до закрытия.' });
  });

  it('preserves useful line breaks and removes raw Markdown links', async () => {
    global.fetch = jest.fn().mockResolvedValue(providerResponse(
      '**Прямой ответ**\n\n1. Первый шаг\n2. Второй шаг\n[Открыть](https://example.test)',
    )) as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(GENERAL_AGRO_REQUEST);

    expect(result.answer).toBe('Прямой ответ\n\n1. Первый шаг\n2. Второй шаг\nОткрыть');
    expect(result.answer).not.toContain('https://');
    expect(result.answer).not.toContain('**');
  });

  it('continues once when the first provider response reaches the token limit', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(providerResponse('Первая часть ответа.', 'length', { prompt_tokens: 100, completion_tokens: 500 }))
      .mockResolvedValueOnce(providerResponse('Завершение ответа.', 'stop', { prompt_tokens: 620, completion_tokens: 40 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(GENERAL_AGRO_REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.answer).toBe('Первая часть ответа.\nЗавершение ответа.');
    expect(result.finishReason).toBe('stop');
    expect(result.truncated).toBe(false);
    expect(result.promptTokens).toBe(720);
    expect(result.completionTokens).toBe(540);
  });

  it('removes unsupported live platform integration claims', async () => {
    global.fetch = jest.fn().mockResolvedValue(providerResponse(
      'Аукцион проходит по опубликованным условиям. Интеграция с ФГИС «Зерно» уже работает в реальном времени.',
    )) as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(VALID_REQUEST);

    expect(result.answer).toContain('Аукцион проходит по опубликованным условиям.');
    expect(result.answer).not.toContain('ФГИС');
    expect(result.safetyFlags).toContain('UNSUPPORTED_PLATFORM_ENTITY_REMOVED');
  });

  it('does not emit exact current figures when governed current evidence is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue(providerResponse(
      'Сегодня цена составляет 18 500 руб. за тонну. На цену влияют качество, базис и логистика.',
    )) as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate({
      ...GENERAL_AGRO_REQUEST,
      question: 'Какая цена зерна сегодня?',
      originalQuestion: 'Какая цена зерна сегодня?',
      currentDataRequired: true,
    });

    expect(result.answer).toContain('Я не могу подтвердить точное актуальное значение');
    expect(result.answer).not.toContain('18 500');
    expect(result.answer).toContain('качество');
    expect(result.safetyFlags).toContain('CURRENT_EVIDENCE_REQUIRED');
  });

  it('instructs the model to redirect unrelated requests without solving them', async () => {
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(
      'Я специализируюсь на агробизнесе и платформе. Для легкового автомобиля лучше воспользоваться профильным поиском.',
    ));
    global.fetch = fetchMock as typeof fetch;

    await new RestrictedPublicQwenService().generate({
      ...GENERAL_AGRO_REQUEST,
      question: 'Где купить машину?',
      originalQuestion: 'Где купить машину?',
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const prompt = String(body.messages[0].content);
    expect(prompt).toContain('PATH 4 — outside the domain');
    expect(prompt).toContain('do not solve the unrelated request in substance');
    expect(prompt).toContain('tractor, combine, farm truck, commercial fleet or agricultural logistics vehicle');
    expect(prompt).toContain('Never shame the user and never sound like a refusal template');
  });

  it('requires truthful conversion and verified roadmap wording', async () => {
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(
      'Эта функция находится в процессе реализации командой разработки.',
    ));
    global.fetch = fetchMock as typeof fetch;

    await new RestrictedPublicQwenService().generate({
      ...VALID_REQUEST,
      question: 'Есть ли автоматическая проверка субсидий?',
      originalQuestion: 'Есть ли автоматическая проверка субсидий?',
      grounding: {
        ...VALID_REQUEST.grounding,
        title: 'Проверка субсидий',
        answer: 'Функция включена в подтверждённую дорожную карту и находится в процессе реализации.',
        maturity: 'Функция ещё не доступна пользователям.',
      },
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const prompt = String(body.messages[0].content);
    expect(prompt).toContain('If, and only if');
    expect(prompt).toContain('development team is currently implementing it');
    expect(prompt).toContain('must not imply that it is already available');
    expect(prompt).toContain('cannot confirm the function\'s current status');
    expect(prompt).toContain('End with at most one soft next step');
    expect(prompt).toContain('Do not turn every answer into an advertisement');
  });

  it('rejects private fields and secret-like history before any model call', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(new RestrictedPublicQwenService().generate({
      ...VALID_REQUEST,
      dealId: 'DEAL-SECRET',
    })).rejects.toBeInstanceOf(BadRequestException);

    await expect(new RestrictedPublicQwenService().generate({
      ...VALID_REQUEST,
      history: [{ role: 'user', text: 'Bearer abcdefghijklmnopqrstuvwxyz123456' }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a source outside approved public platform routes', async () => {
    await expect(new RestrictedPublicQwenService().generate({
      ...VALID_REQUEST,
      grounding: {
        ...VALID_REQUEST.grounding,
        sources: [{ label: 'Private', href: '/platform-v7/deals/DEAL-1' }, { label: 'External', href: 'https://example.test' }],
      },
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses plain HTTP to a public host even when the host is listed', async () => {
    process.env.AI_ASSISTANT_BASE_URL = 'http://model.example.test/v1/';
    process.env.AI_ASSISTANT_ALLOWED_HOSTS = 'model.example.test';

    await expect(new RestrictedPublicQwenService().generate(VALID_REQUEST))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when the restricted contour is disabled', async () => {
    process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED = 'false';
    await expect(new RestrictedPublicQwenService().generate(VALID_REQUEST))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses a model answer that claims it performed a write or exposes a secret', async () => {
    global.fetch = jest.fn().mockResolvedValue(providerResponse('Я изменил сделку и выпустил деньги.')) as typeof fetch;
    await expect(new RestrictedPublicQwenService().generate(VALID_REQUEST))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    global.fetch = jest.fn().mockResolvedValue(providerResponse('Ключ: sk-proj-12345678901234567890')) as typeof fetch;
    await expect(new RestrictedPublicQwenService().generate(GENERAL_AGRO_REQUEST))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
