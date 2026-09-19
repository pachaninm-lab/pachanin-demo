import { RestrictedPublicQwenService } from './restricted-public-qwen.service';

const IRRIGATION_REQUEST = {
  question: 'Как подобрать капельный полив для небольшого огорода?',
  originalQuestion: 'Как подобрать капельный полив для небольшого огорода?',
  locale: 'ru',
  answerMode: 'general_agro',
  currentDataRequired: false,
  history: [],
  grounding: {
    knowledgeVersion: 'public-kb-2026-08-03',
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

describe('RestrictedPublicQwenService general-agro completeness contract', () => {
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

  it('requires concrete irrigation design factors before clarification', async () => {
    const answer = [
      'Для небольшого огорода сначала определи требуемый расход воды и доступное рабочее давление.',
      'Затем подбери фильтрацию, разделение на зоны и допустимую длину капельных линий.',
      'Для точного расчёта нужны источник воды, площадь, культуры, схема грядок, почва и перепад высот.',
    ].join(' ');
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(answer));
    global.fetch = fetchMock as typeof fetch;

    const result = await new RestrictedPublicQwenService().generate(IRRIGATION_REQUEST);

    expect(result.answer).toBe(answer);
    expect(result).toMatchObject({
      modelIdentity: 'tai-qwen3-8b-q4km',
      answerMode: 'general_agro',
      mode: 'read_only',
      truncated: false,
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const systemPrompt = String(body.messages[0].content);
    const userPrompt = String(body.messages.at(-1).content);

    expect(systemPrompt).toContain('explicitly name at least two applicable observable or measurable decision factors');
    expect(systemPrompt).toContain('water source or available debit');
    expect(systemPrompt).toContain('required flow');
    expect(systemPrompt).toContain('operating pressure');
    expect(systemPrompt).toContain('filtration');
    expect(systemPrompt).toContain('zoning');
    expect(systemPrompt).toContain('line or tape length');
    expect(systemPrompt).toContain('emitter spacing');
    expect(systemPrompt).toContain('crop water demand');
    expect(systemPrompt).toContain('soil and relief');
    expect(userPrompt).toContain('MINIMUM_ANSWER_QUALITY:');
    expect(userPrompt).toContain('at least two concrete applicable factors');
    expect(userPrompt).toContain(IRRIGATION_REQUEST.question);
  });

  it('uses one reusable completeness frame across the main agro domains', async () => {
    const fetchMock = jest.fn().mockResolvedValue(providerResponse(
      'Для диагностики назови фактическую нагрузку, условия работы и наблюдаемые симптомы.',
    ));
    global.fetch = fetchMock as typeof fetch;

    await new RestrictedPublicQwenService().generate({
      ...IRRIGATION_REQUEST,
      question: 'Почему трактор перегревается под нагрузкой?',
      originalQuestion: 'Почему трактор перегревается под нагрузкой?',
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    const systemPrompt = String(body.messages[0].content);
    expect(systemPrompt).toContain('For crop production');
    expect(systemPrompt).toContain('For livestock');
    expect(systemPrompt).toContain('For machinery');
    expect(systemPrompt).toContain('For storage, infrastructure, farm economics and farm IT');
    expect(systemPrompt).toContain('Do not invent agronomic norms, product doses, medicines or veterinary diagnoses');
    expect(systemPrompt).toContain('Do not invent machinery specifications, diagnostic codes or compatibility');
  });
});
