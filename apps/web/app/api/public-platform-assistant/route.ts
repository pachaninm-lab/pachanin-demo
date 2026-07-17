import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  answerPublicPlatformQuestion,
  publicAssistantCatalog,
  type PublicAssistantLocale,
} from '@/lib/platform-v7/public-assistant-knowledge';
import { understandAssistantQuestion } from '@/lib/platform-v7/assistant-question-understanding';
import { answerProspectQuestion, prospectTopics } from '@/lib/platform-v7/prospect-assistant-knowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 1_200;
const MAX_BODY_BYTES = 8_192;

const SOURCE_LABELS: Readonly<Record<PublicAssistantLocale, Readonly<Record<string, string>>>> = {
  ru: {
    '/platform-v7': 'Главная платформы',
    '/platform-v7/how-it-works': 'Как работает сделка',
    '/platform-v7/secure-grain-deal': 'Безопасная зерновая сделка',
    '/platform-v7/fgis-zerno': 'ФГИС «Зерно»',
    '/platform-v7/privacy': 'Конфиденциальность',
    '/platform-v7/contact': 'Связаться с проектом',
  },
  en: {
    '/platform-v7': 'Platform home',
    '/platform-v7/how-it-works': 'How the Deal works',
    '/platform-v7/secure-grain-deal': 'Secure grain Deal',
    '/platform-v7/fgis-zerno': 'FGIS Grain',
    '/platform-v7/privacy': 'Privacy',
    '/platform-v7/contact': 'Contact the project',
  },
  zh: {
    '/platform-v7': '平台主页',
    '/platform-v7/how-it-works': '交易如何运作',
    '/platform-v7/secure-grain-deal': '安全粮食交易',
    '/platform-v7/fgis-zerno': '粮食政府信息系统',
    '/platform-v7/privacy': '隐私',
    '/platform-v7/contact': '联系项目',
  },
};

function localeFrom(value: unknown): PublicAssistantLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function localizedSources(sources: readonly Readonly<{ label: string; href: string }>[], locale: PublicAssistantLocale) {
  return sources.map((source) => ({ ...source, label: SOURCE_LABELS[locale][source.href] ?? source.label }));
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isCrossSite(request: NextRequest): boolean {
  return request.headers.get('sec-fetch-site') === 'cross-site';
}

function hashQuestion(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fallbackCopy(locale: PublicAssistantLocale) {
  if (locale === 'en') return {
    title: 'I need one clarification',
    answer: 'I could not map the question to a verified platform or agribusiness topic with sufficient confidence. Rephrase it in a few words or choose one of the suggested areas. The question has been registered as a knowledge gap without storing its full text.',
    maturity: 'I will not invent an answer when the verified knowledge base has no basis.',
    suggestions: ['How does a Deal work?', 'What does a bank gain?', 'How much does implementation cost?'],
  };
  if (locale === 'zh') return {
    title: '需要进一步说明',
    answer: '我无法以足够置信度将问题映射到已验证的平台或农业业务主题。请简要改写或选择建议主题。系统已登记知识缺口，但不会保存完整问题文本。',
    maturity: '没有可靠依据时，助手不会编造答案。',
    suggestions: ['交易如何运作？', '银行能获得什么？', '实施成本是多少？'],
  };
  return {
    title: 'Нужно одно уточнение',
    answer: 'Я не смог с достаточной уверенностью связать вопрос с подтверждённой темой платформы или агробизнеса. Сформулируйте его ещё раз в нескольких словах или выберите направление ниже. Вопрос зарегистрирован как пробел знаний без сохранения полного текста.',
    maturity: 'Если подтверждённого основания нет, помощник не придумывает ответ.',
    suggestions: ['Как работает Сделка?', 'Что получит банк?', 'Сколько стоит внедрение?'],
  };
}

function limitations(locale: PublicAssistantLocale) {
  if (locale === 'en') return [
    'No user, account or Deal data is available in public mode.',
    'Legal, tax, credit and commercial answers are general information, not an individual decision.',
    'The assistant cannot execute actions or confirm unconnected integrations.',
  ];
  if (locale === 'zh') return [
    '公共模式无法访问用户、账户或交易数据。',
    '法律、税务、信贷和商业回答仅为一般信息，不是个别决定。',
    '助手不能执行操作，也不能确认尚未连接的集成。',
  ];
  return [
    'В публичном режиме нет доступа к пользователям, кабинетам и Сделкам.',
    'Юридические, налоговые, кредитные и коммерческие ответы носят общий информационный характер.',
    'Помощник не выполняет действия и не подтверждает неподключённые интеграции.',
  ];
}

export async function GET(request: NextRequest) {
  const locale = localeFrom(request.nextUrl.searchParams.get('locale'));
  const catalog = publicAssistantCatalog(locale);
  return json({ ...catalog, prospectTopics: prospectTopics(locale) });
}

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return json({ code: 'PUBLIC_ASSISTANT_CROSS_SITE_DENIED', message: 'Cross-site requests are not accepted.' }, 403);
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json({ code: 'PUBLIC_ASSISTANT_JSON_REQUIRED', message: 'Content-Type application/json is required.' }, 415);
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ code: 'PUBLIC_ASSISTANT_BODY_TOO_LARGE', message: 'Request body is too large.' }, 413);

  let payload: unknown;
  try { payload = await request.json(); } catch { return json({ code: 'PUBLIC_ASSISTANT_INVALID_JSON', message: 'Invalid JSON body.' }, 400); }
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const requestedLocale = localeFrom(body?.locale);
  if (!message) return json({ code: 'PUBLIC_ASSISTANT_MESSAGE_REQUIRED', message: 'Message is required.' }, 400);
  if (message.length > MAX_MESSAGE_LENGTH) return json({ code: 'PUBLIC_ASSISTANT_MESSAGE_TOO_LONG', message: `Maximum length is ${MAX_MESSAGE_LENGTH} characters.` }, 400);

  const generatedAt = new Date().toISOString();
  const requestId = randomUUID();
  const understanding = understandAssistantQuestion(message, requestedLocale);
  const locale = understanding.detectedLocale;
  const correctedQuestion = understanding.corrected || message;
  const prospectAnswer = answerProspectQuestion(correctedQuestion, locale);
  const platformAnswer = answerPublicPlatformQuestion(correctedQuestion, locale);
  const answer = prospectAnswer ?? platformAnswer;
  const unresolved = understanding.ambiguous || (!prospectAnswer && platformAnswer.confidence === 'medium' && understanding.corrections.length === 0);

  if (unresolved) {
    const fallback = fallbackCopy(locale);
    const escalationId = `UK-${requestId.slice(0, 8).toUpperCase()}`;
    console.warn(JSON.stringify({
      event: 'PUBLIC_ASSISTANT_UNANSWERED', requestId, escalationId,
      questionHash: hashQuestion(message), messageLength: message.length,
      locale, detectedLocale: understanding.detectedLocale,
      correctionCount: understanding.corrections.length, generatedAt,
    }));
    return json({
      requestId, escalationId, generatedAt, dataMode: 'public_knowledge', mode: 'read_only',
      resolution: 'clarification_required', knowledgeVersion: answer.knowledgeVersion,
      topic: 'overview', title: fallback.title, answer: fallback.answer, facts: [],
      maturity: fallback.maturity, confidence: 'medium', actionAllowed: false,
      sources: localizedSources([{ label: '', href: '/platform-v7/contact' }], locale),
      suggestions: fallback.suggestions,
      understanding: { normalizedQuestion: correctedQuestion, corrections: understanding.corrections, detectedLocale: understanding.detectedLocale },
      limitations: limitations(locale),
    });
  }

  return json({
    requestId, generatedAt, dataMode: 'public_knowledge', mode: 'read_only', resolution: 'answered',
    ...answer, sources: localizedSources(answer.sources, locale),
    understanding: { normalizedQuestion: correctedQuestion, corrections: understanding.corrections, detectedLocale: understanding.detectedLocale },
    limitations: limitations(locale),
  });
}
