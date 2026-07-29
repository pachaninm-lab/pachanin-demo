import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RestrictedPublicQwenService } from './restricted-public-qwen.service';

const VALID_REQUEST = {
  question: 'Как работает аукцион?',
  locale: 'ru',
  answerMode: 'verified_platform',
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
  locale: 'ru',
  answerMode: 'general_agro',
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
      AI_ASSISTANT_TIMEOUT_MS: '120000',
      AI_ASSISTANT_MAX_TOKENS: '500',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends only verified public grounding through the private Bearer transport', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Аукцион исполняется по опубликованным условиям.' } }],
      usage: { prompt_tokens: 120, completion_tokens: 18 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
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

  it('answers greetings and broad agriculture questions in friendly general-agro mode', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Привет! Я помогу с вопросами по сельскому хозяйству, агробизнесу и платформе.' } }],
      usage: { prompt_tokens: 140, completion_tokens: 22 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
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

  it('instructs the model to redirect unrelated requests without becoming a scripted refusal bot', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Я специализируюсь на агробизнесе и платформе. Для легкового автомобиля лучше воспользоваться поиском; если речь о технике или транспорте для хозяйства, помогу подобрать критерии.' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    global.fetch = fetchMock as typeof fetch;

    await new RestrictedPublicQwenService().generate({
      ...GENERAL_AGRO_REQUEST,
      question: 'Где купить машину?',
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const prompt = String(body.messages[0].content);
    expect(prompt).toContain('PATH 4 — outside the domain');
    expect(prompt).toContain('do not solve the unrelated request in substance');
    expect(prompt).toContain('tractor, combine, farm truck, commercial fleet or agricultural logistics vehicle');
    expect(prompt).toContain('Never shame the user and never sound like a refusal template');
  });

  it('uses only a relevant and truthful soft platform conversion', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Для контроля исполнения сделки можно использовать подтверждённые возможности платформы и при необходимости обратиться в поддержку.' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    global.fetch = fetchMock as typeof fetch;

    await new RestrictedPublicQwenService().generate(VALID_REQUEST);

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const prompt = String(body.messages[0].content);
    expect(prompt).toContain('naturally explain how Transparent Price can help');
    expect(prompt).toContain('End with at most one soft next step');
    expect(prompt).toContain('Do not turn every answer into an advertisement');
    expect(prompt).toContain('distinguish verified current capability from roadmap or unknown status');
  });

  it('describes a missing function as in development only when verified roadmap context confirms it', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Эта функция находится в процессе реализации командой разработки.' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    global.fetch = fetchMock as typeof fetch;

    await new RestrictedPublicQwenService().generate({
      ...VALID_REQUEST,
      question: 'Есть ли автоматическая проверка субсидий?',
      grounding: {
        ...VALID_REQUEST.grounding,
        title: 'Проверка субсидий',
        answer: 'Функция включена в подтверждённую дорожную карту и находится в процессе реализации.',
        maturity: 'Функция ещё не доступна пользователям.',
      },
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const prompt = String(body.messages[0].content);
    expect(prompt).toContain('If, and only if, the supplied verified public platform context explicitly says');
    expect(prompt).toContain('the development team is currently implementing it');
    expect(prompt).toContain('must not imply that it is already available');
    expect(prompt).toContain('or infer development status merely because the function is absent');
    expect(prompt).toContain('cannot confirm the function\'s current status');
  });

  it('rejects private fields before any model call', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(new RestrictedPublicQwenService().generate({
      ...VALID_REQUEST,
      dealId: 'DEAL-SECRET',
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

  it('refuses a model answer that claims it performed a write', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Я изменил сделку и выпустил деньги.' } }],
    }), { status: 200 })) as typeof fetch;

    await expect(new RestrictedPublicQwenService().generate(VALID_REQUEST))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
