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

const ROLE_ONLY_WORDS = new Set([
  'банк', 'покупатель', 'продавец', 'фермер', 'трейдер', 'элеватор', 'логист', 'водитель',
  'bank', 'buyer', 'seller', 'farmer', 'trader', 'elevator', 'logistics', 'driver',
  '银行', '买方', '卖方', '农户', '贸易商', '粮库', '物流', '司机',
]);

const ACTION_OR_TOPIC_WORDS = [
  'как', 'что', 'почему', 'зачем', 'сколько', 'стоимость', 'цена', 'внедрение', 'сделк', 'аукцион',
  'логист', 'прием', 'приём', 'документ', 'деньг', 'выплат', 'спор', 'фгис', 'интеграц', 'безопас',
  'how', 'what', 'why', 'cost', 'price', 'implementation', 'deal', 'auction', 'payment', 'document',
  'dispute', 'integration', 'security', '如何', '什么', '为什么', '价格', '实施', '交易', '竞价', '付款', '文件', '争议', '集成', '安全',
] as const;

const FORBIDDEN_COMMAND_PATTERNS = [
  /(?:покажи|открой|удали|измени|переведи|выплати).{0,40}(?:чуж|все|любые).{0,30}(?:сделк|данн|деньг)/iu,
  /(?:show|open|delete|change|transfer|pay).{0,40}(?:other|all|any).{0,30}(?:deal|data|money)/iu,
  /(?:显示|打开|删除|修改|转账).{0,30}(?:他人|全部|任意).{0,20}(?:交易|数据|资金)/u,
];

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

function normalizeIntent(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function hasSubstantiveIntent(value: string): boolean {
  const normalized = normalizeIntent(value);
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.every((token) => ROLE_ONLY_WORDS.has(token))) return false;
  return ACTION_OR_TOPIC_WORDS.some((word) => normalized.includes(word));
}

function isForbiddenCommand(value: string): boolean {
  return FORBIDDEN_COMMAND_PATTERNS.some((pattern) => pattern.test(value));
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

function forbiddenCopy(locale: PublicAssistantLocale) {
  if (locale === 'en') return {
    title: 'Access denied',
    answer: 'I cannot show, modify or disclose other users’ Deals or account data. Public mode has no access to private workspaces, and private mode cannot expand the user’s server-authorized role or tenant scope.',
    maturity: 'Access is enforced by server-side authorization and is not controlled by the browser.',
    suggestions: ['How is Deal access protected?', 'How do roles work?', 'What can the public assistant see?'],
  };
  if (locale === 'zh') return {
    title: '拒绝访问',
    answer: '我不能显示、修改或披露其他用户的交易或账户数据。公共模式无法访问私人工作区，私人模式也不能扩大服务器授权的角色或租户范围。',
    maturity: '访问由服务器端授权强制执行，浏览器不能改变权限。',
    suggestions: ['交易访问如何保护？', '角色如何工作？', '公共助手能看到什么？'],
  };
  return {
    title: 'Доступ запрещён',
    answer: 'Я не могу показать, изменить или раскрыть чужие Сделки и данные личных кабинетов. Публичный режим не имеет доступа к приватным рабочим пространствам, а приватный помощник не расширяет серверные полномочия роли и организации.',
    maturity: 'Доступ определяется серверным RBAC и tenant-изоляцией, а не браузером.',
    suggestions: ['Как защищён доступ к Сделкам?', 'Как устроены роли?', 'Что видит публичный помощник?'],
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

  if (isForbiddenCommand(correctedQuestion)) {
    const denied = forbiddenCopy(locale);
    return json({
      requestId, generatedAt, dataMode: 'public_knowledge', mode: 'read_only', resolution: 'refused',
      knowledgeVersion: publicAssistantCatalog(locale).knowledgeVersion,
      topic: 'security', title: denied.title, answer: denied.answer, facts: [], maturity: denied.maturity,
      confidence: 'high', actionAllowed: false,
      sources: localizedSources([{ label: '', href: '/platform-v7/privacy' }], locale),
      suggestions: denied.suggestions,
      understanding: { normalizedQuestion: correctedQuestion, corrections: understanding.corrections, detectedLocale: understanding.detectedLocale },
      limitations: limitations(locale),
    });
  }

  const prospectAnswer = hasSubstantiveIntent(correctedQuestion) ? answerProspectQuestion(correctedQuestion, locale) : null;
  const platformAnswer = answerPublicPlatformQuestion(correctedQuestion, locale);
  const answer = prospectAnswer ?? platformAnswer;
  const unresolved = understanding.ambiguous
    || !hasSubstantiveIntent(correctedQuestion)
    || (!prospectAnswer && platformAnswer.confidence === 'medium' && understanding.corrections.length === 0);

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
