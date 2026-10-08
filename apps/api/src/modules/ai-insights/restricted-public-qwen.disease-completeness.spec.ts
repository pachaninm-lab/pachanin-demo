import { RestrictedPublicQwenService } from './restricted-public-qwen.service';

const REQUEST = {
  question: 'Как снизить риск парши в яблоневом саду?',
  originalQuestion: 'Как снизить риск парши в яблоневом саду?',
  locale: 'ru',
  answerMode: 'general_agro',
  currentDataRequired: false,
  history: [],
  grounding: {
    knowledgeVersion: 'public-kb-2026-08-05',
    topic: 'general-agro',
    title: 'Сельское хозяйство и практическая помощь',
    answer: 'Используй устойчивые общие знания и уточняй недостающие исходные данные.',
    facts: [],
    maturity: 'Общий информационный режим без исполнения операций.',
    confidence: 'medium',
    sources: [{ label: 'Главная платформы', href: '/platform-v7' }],
  },
} as const;

function providerResponse(content: string) {
  return new Response(JSON.stringify({
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 160, completion_tokens: 80 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('RestrictedPublicQwenService plant disease prevention completeness', () => {
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
      AI_ASSISTANT_MAX_TOKENS: '900',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('adds a bounded prevention floor when the model omits the disease cycle', async () => {
    const weakAnswer = 'Риск парши повышается при высокой влажности, поэтому контролируйте полив и состояние корней.';
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(weakAnswer));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(REQUEST);

    expect(result.answer).toContain(weakAnswer);
    expect(result.answer).toContain('санитарная уборка');
    expect(result.answer).toContain('прореживание кроны');
    expect(result.answer).toContain('фунгицидная обработка');
    expect(result.answer).toContain('строго по этикетке');
    expect(result.safetyFlags).toContain('GENERAL_AGRO_DISEASE_COMPLETENESS_FLOOR');

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const systemPrompt = String(body.messages[0].content);
    expect(systemPrompt).toContain('For plant disease prevention');
    expect(systemPrompt).toContain('reducing inoculum through sanitation');
    expect(systemPrompt).toContain('shortens leaf-wetness duration');
    expect(systemPrompt).toContain('label-compliant crop protection');
  });

  it('keeps a substantive prevention answer unchanged', async () => {
    const answer = 'Проведите санитарную уборку заражённых опавших листьев и проредите крону, чтобы листва быстрее высыхала после дождя.';
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(answer));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(REQUEST);

    expect(result.answer).toBe(answer);
    expect(result.safetyFlags).not.toContain('GENERAL_AGRO_DISEASE_COMPLETENESS_FLOOR');
  });

  it('removes an ungrounded active-ingredient prescription from the screenshot scenario', async () => {
    const answer = 'Применяйте препараты на основе манкозеба или металаксила. Проводите санитарную уборку заражённых листьев и прореживайте крону после дождей.';
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(answer));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(REQUEST);

    expect(result.answer).not.toContain('манкозеба');
    expect(result.answer).not.toContain('металаксила');
    expect(result.answer).toContain('санитарную уборку');
    expect(result.safetyFlags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const systemPrompt = String(body.messages[0].content);
    expect(systemPrompt).toContain('never prescribe or recommend a concrete product, active ingredient, dose or interval');
    expect(systemPrompt).toContain('Do not diagnose a plant disease as certain');
    expect(systemPrompt).toContain('pathogen-resistance terminology');
  });

  it('falls back to the bounded disease-prevention floor when the entire model answer is an ungrounded chemical prescription', async () => {
    global.fetch = jest.fn().mockResolvedValue(providerResponse(
      'Применяйте препараты на основе манкозеба или металаксила.',
    )) as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(REQUEST);

    expect(result.answer).not.toContain('манкозеба');
    expect(result.answer).not.toContain('металаксила');
    expect(result.answer).toContain('санитарная уборка');
    expect(result.answer).toContain('зарегистрированный для культуры и региона препарат');
    expect(result.safetyFlags).toContain('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
    expect(result.safetyFlags).toContain('GENERAL_AGRO_DISEASE_COMPLETENESS_FLOOR');
  });

  it('does not alter unrelated general-agro answers', async () => {
    const answer = 'Для трактора проверьте фактическую нагрузку, температуру охлаждающей жидкости и чистоту радиатора.';
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(answer));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate({
      ...REQUEST,
      question: 'Почему трактор перегревается под нагрузкой?',
      originalQuestion: 'Почему трактор перегревается под нагрузкой?',
    });

    expect(result.answer).toBe(answer);
    expect(result.safetyFlags).not.toContain('GENERAL_AGRO_DISEASE_COMPLETENESS_FLOOR');
  });
});
