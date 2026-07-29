import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { RestrictedPublicQwenService } from './restricted-public-qwen.service';

const VALID_REQUEST = {
  question: 'Как работает аукцион?',
  locale: 'ru',
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
    const wire = JSON.stringify(body);
    for (const privateKey of ['tenantId', 'orgId', 'userId', 'dealId', 'membershipId']) {
      expect(wire).not.toContain(privateKey);
    }
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
