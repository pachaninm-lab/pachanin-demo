import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  GatewayStreamWriter,
  absoluteCitationUri,
  chunkAnswer,
  resolveAdmission,
} from '@pc/ai-assistant-stream-contract';
import {
  PUBLIC_ADMISSION_SOURCE,
  readAdmissionManifest,
} from '@pc/ai-assistant-admission-manifest';
import {
  answerPublicPlatformQuestion,
  publicAssistantCatalog,
  type PublicAssistantLocale,
} from '@/lib/platform-v7/public-assistant-knowledge';
import { understandAssistantQuestion } from '@/lib/platform-v7/assistant-question-understanding';
import { answerProspectQuestion, prospectTopics } from '@/lib/platform-v7/prospect-assistant-knowledge';
import {
  resolvePreviousTopic,
  routeAssistantQuestion,
  type AssistantConversationTurn,
  type AssistantRelevanceOutcome,
  type AssistantRoutingContext,
} from '@/lib/platform-v7/assistant-relevance-router';
import { buildAssistantRoutingContext } from '@/lib/platform-v7/assistant-server-context';
import {
  composePlatformSectionAnswer,
  composeRedirectAnswer,
  composeSafetyAnswer,
  type ComposedAssistantAnswer,
} from '@/lib/platform-v7/assistant-answer-composer';
import { PLATFORM_KNOWLEDGE_VERSION } from '@/lib/platform-v7/platform-knowledge-sections';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 1_200;
const MAX_BODY_BYTES = 20_480;
const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TURN_CHARS = 2_000;
const MAX_HISTORY_TOTAL_CHARS = 12_000;

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

function isForbiddenCommand(value: string): boolean {
  return FORBIDDEN_COMMAND_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Reads the conversation the client sent.
 *
 * History is the reader's own words and carries no authority: it shapes what the
 * question means, never what the reader is allowed to see. Bounds are the same
 * ones the streaming contour applies, so both paths read one envelope shape.
 */
function readHistory(value: unknown): readonly AssistantConversationTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: AssistantConversationTurn[] = [];
  let total = 0;
  // Keep the newest valid turns when the bounded envelope is full. A long
  // older turn must never evict the latest subject that a short follow-up
  // depends on.
  for (const item of [...value.slice(-MAX_HISTORY_TURNS)].reverse()) {
    const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : null;
    const role = row?.role === 'assistant' ? 'assistant' : row?.role === 'user' ? 'user' : null;
    const text = typeof row?.text === 'string'
      ? row.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ').trim().slice(0, MAX_HISTORY_TURN_CHARS)
      : '';
    if (!role || !text) continue;
    if (total + text.length > MAX_HISTORY_TOTAL_CHARS) continue;
    turns.unshift({ role, text });
    total += text.length;
  }
  return turns;
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

type ResolvedAnswer = Readonly<{
  resolution: 'answered' | 'redirected' | 'refused';
  knowledgeVersion: string;
  topic: string;
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  confidence: 'high' | 'medium';
  actionAllowed: false;
  sources: readonly Readonly<{ label: string; href: string }>[];
  suggestions: readonly string[];
}>;

/**
 * Turns a routing decision into the answer both contours serve.
 *
 * The old gate lived here as a single boolean: anything that did not match a
 * narrow topic became a refusal, which is how a question the platform itself
 * suggests — "Как защищаются данные?" — came back as "I could not map the
 * question". Admission is now the router's decision, and this function only
 * chooses which body of knowledge answers it.
 *
 * A clarifying question never replaces an answer. When the question genuinely
 * has two readings, the useful general part is served first and the narrowing
 * question follows it.
 */
function resolveAnswer(
  question: string,
  locale: PublicAssistantLocale,
  outcome: AssistantRelevanceOutcome,
  role: string | null,
): ResolvedAnswer {
  if (outcome.decision === 'BLOCK_SAFETY' && outcome.safetyReason) {
    return fromComposed(composeSafetyAnswer(locale, outcome.safetyReason), 'refused', 'security', locale, 'high');
  }

  if (outcome.decision === 'REDIRECT_UNRELATED') {
    return fromComposed(composeRedirectAnswer(locale), 'redirected', 'overview', locale, 'high');
  }

  const clarify = outcome.decision === 'CLARIFY_WITH_PARTIAL_ANSWER';
  const section = outcome.section ?? (clarify ? outcome.clarifySection : null);
  if (section) {
    const composed = composePlatformSectionAnswer(section, locale, { clarify, role });
    if (composed) return fromComposed(composed, 'answered', section, locale, clarify ? 'medium' : 'high');
  }

  // No platform section owns the question: the prospect and public knowledge
  // bases answer it, exactly as they did before — but now they are reached
  // instead of being skipped in favour of a refusal.
  const prospectAnswer = answerProspectQuestion(question, locale);
  const platformAnswer = answerPublicPlatformQuestion(question, locale);
  const answer = prospectAnswer ?? platformAnswer;
  const trailing = clarify && outcome.clarifySection
    ? composePlatformSectionAnswer(outcome.clarifySection, locale, { clarify: true })
    : null;

  return Object.freeze({
    resolution: 'answered',
    knowledgeVersion: answer.knowledgeVersion,
    topic: answer.topic,
    title: answer.title,
    answer: trailing ? `${answer.answer}\n\n${trailing.answer}` : answer.answer,
    facts: answer.facts,
    maturity: answer.maturity,
    confidence: outcome.decision === 'ALLOW_DIRECT' ? answer.confidence : 'medium',
    actionAllowed: false,
    sources: localizedSources(answer.sources, locale),
    suggestions: answer.suggestions,
  });
}

function fromComposed(
  composed: ComposedAssistantAnswer,
  resolution: ResolvedAnswer['resolution'],
  topic: string,
  locale: PublicAssistantLocale,
  confidence: 'high' | 'medium',
): ResolvedAnswer {
  return Object.freeze({
    resolution,
    knowledgeVersion: PLATFORM_KNOWLEDGE_VERSION,
    topic,
    title: composed.title,
    answer: composed.answer,
    facts: composed.facts,
    maturity: composed.maturity,
    confidence,
    actionAllowed: false,
    sources: localizedSources(composed.sources, locale),
    suggestions: composed.suggestions,
  });
}

/**
 * Whether this deployment may generate a public answer, and with which model.
 *
 * Read per request, never cached: admission is withdrawn by unsetting it, and a
 * cached "admitted" would keep the boundary generating after the withdrawal.
 *
 * Not exported: a Next route module may only export route fields, and anything
 * else fails the build. It is covered through `POST` instead, which is the only
 * way it is ever reached in production anyway.
 */
function readPublicAdmission(env: NodeJS.ProcessEnv = process.env) {
  // Admission is the verified C.04 decision document, not a word in the
  // environment: the digest it carries covers the benchmarks, the bundle
  // manifests and the authority the decision was made against, so a fabricated
  // admission has to fabricate those too.
  const verdict = readAdmissionManifest(env, PUBLIC_ADMISSION_SOURCE);
  return {
    identity: verdict.modelIdentity,
    ...resolveAdmission({
      featureEnabled: (env.TAI_GATEWAY_PUBLIC_STREAM_ENABLED || '').trim() === 'true',
      modelIdentity: verdict.modelIdentity,
      admissionStatus: verdict.admitted ? 'ADMITTED' : null,
    }),
  };
}

function sse(body: ReadableStream<Uint8Array>) {
  return new NextResponse(body, {
    // The refusal travels inside the stream, not as an HTTP error: a non-200
    // would leave the client showing a transport failure instead of the reason
    // the assistant declined, which is the one thing the reader needs.
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform, max-age=0',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * The public read-only stream.
 *
 * The boundary validates through the same contract module the API produces
 * frames with, so the public contour cannot acquire an event, a write verb or a
 * server identity field that the private one does not have — and cannot lose a
 * check by drifting away from it. Public mode additionally means every frame is
 * checked against `'public'`, so a private identity key is refused here even if
 * something upstream ever put one in.
 */
function streamPublicAnswer(
  request: NextRequest,
  message: string,
  requestedLocale: PublicAssistantLocale,
  context: AssistantRoutingContext,
) {
  const streamId = randomUUID();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };
      const stream = new GatewayStreamWriter(write, 'public', streamId);
      const admission = readPublicAdmission();

      // A reader who navigates away mid-answer must not leave tokens that look
      // like a finished answer to anything reading the stream afterwards.
      const onAbort = () => {
        stream.fail('CANCELLED', 'The reader cancelled the answer.');
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const finish = () => {
        request.signal.removeEventListener('abort', onAbort);
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      // An already-aborted signal never fires the event, so the check has to
      // happen here too; otherwise a cancelled request would still be answered.
      if (request.signal.aborted) {
        stream.fail('CANCELLED', 'The reader cancelled the answer.');
        finish();
        return;
      }
      request.signal.addEventListener('abort', onAbort, { once: true });

      stream.emit({ event: 'meta', mode: 'public', modelIdentity: admission.allowed ? admission.identity : null });

      if (!admission.allowed) {
        stream.fail(
          admission.refusal ?? 'UPSTREAM_ERROR',
          admission.refusal === 'FEATURE_DISABLED'
            ? 'The public assistant stream is not enabled in this deployment.'
            : 'No admitted model is bound to this deployment, so nothing is generated.',
        );
        finish();
        return;
      }

      const understanding = understandAssistantQuestion(message, requestedLocale);
      const locale = understanding.detectedLocale;
      const correctedQuestion = understanding.corrected || message;
      const outcome = routeAssistantQuestion(correctedQuestion, { ...context, locale });

      if (isForbiddenCommand(correctedQuestion) || outcome.decision === 'BLOCK_SAFETY') {
        // The public contour holds no user, account or Deal data at all, so the
        // honest refusal is that there is nothing to answer from — not a denial
        // that would imply the data exists here and is merely withheld. The
        // stream carries no tokens here on purpose: a safety block must not
        // produce anything that reads like the beginning of an answer.
        stream.fail('ABSTAINED_NO_DATA', 'Public mode has no access to accounts, Deals or other users’ data.');
        finish();
        return;
      }

      // Everything else is answered. A question that only earned a redirect
      // still gets text a reader can use — what this assistant covers and how to
      // rephrase — instead of a refusal frame carrying nothing.
      const answer = resolveAnswer(correctedQuestion, locale, outcome, context.role);

      const base = (process.env.NEXT_PUBLIC_SITE_URL || '').trim() || null;
      for (const source of answer.sources) {
        const uri = absoluteCitationUri(source.href, base);
        if (!uri) continue;
        if (!stream.emit({ event: 'citation', sourceId: source.href, title: source.label || source.href, uri })) break;
      }

      for (const chunk of chunkAnswer(answer.answer)) {
        if (!stream.emit({ event: 'token', text: chunk })) break;
      }

      stream.emit({ event: 'assessment', summary: answer.maturity, operationalStatus: 'NOT_ATTESTED' });
      stream.complete();
      finish();
    },
  });

  return sse(body);
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

  const history = readHistory(body?.history);
  // Role and page come from the request itself — a signed session cookie and the
  // referrer. A body that claims a role is answered as an anonymous visitor.
  const context = await buildAssistantRoutingContext(request, {
    locale: requestedLocale,
    recentMessages: history,
    previousTopic: resolvePreviousTopic(history),
    hasAttachment: body?.attachment === true,
    semanticHint: null,
  });

  // Malformed requests are refused before the stream opens: once the response is
  // an event stream the only channel left is a frame, and a frame is a poor way
  // to say "your Content-Type was wrong".
  if (request.nextUrl.searchParams.get('stream') === '1') {
    return streamPublicAnswer(request, message, requestedLocale, context);
  }

  const generatedAt = new Date().toISOString();
  const requestId = randomUUID();
  const understanding = understandAssistantQuestion(message, requestedLocale);
  const locale = understanding.detectedLocale;
  const correctedQuestion = understanding.corrected || message;
  const outcome = routeAssistantQuestion(correctedQuestion, { ...context, locale });

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

  const answer = resolveAnswer(correctedQuestion, locale, outcome, context.role);

  // A redirected question is still a signal about what readers expect from this
  // assistant. It is recorded as a hash and a length, never as text, and never
  // shown back to the reader: a person who asked something off-topic needs a
  // useful direction, not a notice that their question was filed.
  if (answer.resolution === 'redirected') {
    console.warn(JSON.stringify({
      event: 'PUBLIC_ASSISTANT_REDIRECTED', requestId,
      questionHash: hashQuestion(message), messageLength: message.length,
      locale, detectedLocale: understanding.detectedLocale, generatedAt,
    }));
  }

  return json({
    requestId, generatedAt, dataMode: 'public_knowledge', mode: 'read_only',
    ...answer,
    understanding: { normalizedQuestion: correctedQuestion, corrections: understanding.corrections, detectedLocale: understanding.detectedLocale },
    limitations: limitations(locale),
  });
}
