import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  GatewayStreamWriter,
  absoluteCitationUri,
  frameText,
  type GatewayRefusal,
} from '@pc/ai-assistant-stream-contract';
import {
  GET as knowledgeGet,
  POST as knowledgePost,
} from '../public-platform-assistant/route';
import {
  resolvePreviousTopic,
  routeAssistantQuestion,
  type AssistantRoutingContext,
} from '@/lib/platform-v7/assistant-relevance-router';
import { buildAssistantRoutingContext } from '@/lib/platform-v7/assistant-server-context';
import { resolveInternalStreamEndpoint, streamInternalModel } from '@/lib/platform-v7/tai-internal-stream';
import {
  renderStateForPrompt,
  type ConversationLanguage,
  type ConversationState,
} from '@/lib/platform-v7/tai-conversation-state';
import { conversationIdFrom, replayConversationState } from '@/lib/platform-v7/tai-conversation-session';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import {
  GEKTA_ANONYMOUS_COOKIE,
  GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  admitReservedAnswer,
  parseAnonymousSession,
  serializeAnonymousSession,
  type GektaAnonymousSession,
} from '@/lib/gekta/anonymous-session';
import { resolveAnonymousEntitlement } from '@/lib/gekta/entitlement';
import {
  GEKTA_AUTH_TIMEOUT_MS,
  gektaApiBase,
  gektaForwardHeaders,
  registrationDeliveryKey,
} from '@/lib/server/gekta-auth-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TIMEOUT_MS = 130_000;
const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TURN_CHARS = 2_000;
const MAX_HISTORY_TOTAL_CHARS = 12_000;

type PublicLocale = 'ru' | 'en' | 'zh';
type PublicAnswerMode = 'verified_platform' | 'general_agro';
type HistoryTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;

type PublicKnowledgeAnswer = Readonly<{
  requestId: string;
  generatedAt: string;
  knowledgeVersion: string;
  dataMode: 'public_knowledge';
  mode: 'read_only';
  resolution: 'answered' | 'refused' | 'redirected';
  topic: string;
  title: string;
  answer: string;
  facts: readonly string[];
  maturity: string;
  confidence: 'high' | 'medium';
  actionAllowed: false;
  sources: readonly Readonly<{ label: string; href: string }>[];
  understanding?: Readonly<{ normalizedQuestion?: string; detectedLocale?: string }>;
}>;

type RuntimeConfig = Readonly<{
  enabled: boolean;
  endpoint: URL | null;
  secret: string;
  identity: string;
  timeoutMs: number;
}>;

type PublicEnvelope = Readonly<{
  question: string;
  locale: PublicLocale;
  context: string;
  conversationId: string;
  history: readonly HistoryTurn[];
}>;

const SENSITIVE_INPUT_PATTERNS = [
  /\b(?:пароль|password|api[\s_-]?key|ключ\s+api|токен|token|secret)\s*[:=]\s*\S{6,}/iu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/iu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
] as const;

const GREETING_PATTERNS = [
  /^(?:привет|здравствуй(?:те)?|доброе\s+(?:утро|день|вечер)|как\s+дела|спасибо|благодарю)[!.?\s]*$/iu,
  /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|thanks?|thank\s+you)[!.?\s]*$/iu,
  /^(?:你好|您好|早上好|下午好|晚上好|谢谢)[！。？\s]*$/u,
] as const;

const EXPLICIT_PLATFORM_PATTERNS = [
  /(?:прозрачн\w*\s+цен\w*|transparent\s+price|透明价格)/iu,
  /(?:эта|данная|ваша|наша)\s+(?:платформа|система)|(?:на|в)\s+(?:этой|вашей|нашей)\s+(?:платформе|системе)/iu,
  /(?:личн\w*\s+кабинет|зарегистрир\w*|регистрац\w*|подключить\s+организац\w*|роль\w*\s+на\s+платформе)/iu,
  /(?:как\s+работает\s+(?:сделка|аукцион|приемка|приёмка)\s+(?:на|в)\s+(?:платформе|системе))/iu,
  /(?:your\s+platform|this\s+platform|the\s+platform|workspace|sign\s*up|register|platform\s+capabilit)/iu,
  /(?:你们的平台|本平台|平台中|注册|工作台)/u,
] as const;

const CURRENT_EVIDENCE_PATTERNS = [
  /(?:сегодня|сейчас|на\s+данный\s+момент|последн\w*|свеж\w*|актуальн\w*|текущ\w*)/iu,
  /(?:новост\w*|погод\w*|курс\w*|пошлин\w*|ставк\w*|котировк\w*|индекс\w*|статистик\w*)/iu,
  /(?:цена|стоимост\w*)\s+(?:сегодня|сейчас|на\s+сегодня|в\s+регионе)/iu,
  /(?:today|current|latest|recent|news|weather|exchange\s+rate|tariff|duty|statistics)/iu,
  /(?:今天|当前|最新|新闻|天气|汇率|关税|统计)/u,
] as const;

// A correction is an authority boundary for raw chat history. The derived
// ConversationState already applies "newest explicit statement wins"; sending
// contradictory turns from before the correction alongside that state gives a
// small local model two competing subjects and can make stale history win again.
const CORRECTION_HISTORY_PATTERNS = [
  /(?:^|\s)нет[,;.\s]/iu,
  /(?:не\s+\w+,?\s*а\s)|(?:речь\s+(?:идёт|идет|про|о))|(?:я\s+имел\s+в\s+виду)|(?:на\s+самом\s+деле)|(?:ошиб(?:ся|лась|лись))/iu,
  /(?:^|\s)no[,;.\s]|(?:i\s+meant)|(?:actually)|(?:rather\s+than)|(?:not\s+\w+\s+but)|(?:i\s+was\s+wrong)/iu,
  /(?:不是)|(?:我是说)|(?:其实)|(?:应该是)|(?:我错了)/u,
] as const;

export async function GET(request: NextRequest) {
  return knowledgeGet(request);
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('stream') !== '1') return knowledgePost(request);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return knowledgePost(request);

  const rawBody = await request.text();
  const envelope = readPublicEnvelope(rawBody);
  if (!envelope.question) return knowledgePost(rebuildRequestWithoutStream(request, rawBody));

  const admission = envelope.context === 'gekta-standalone'
    ? await authorizeGektaAnswer(request)
    : { response: null, anonymousSession: null };
  if (admission.response) return admission.response;
  const admitted = (response: NextResponse) => applyGektaAdmission(response, admission.anonymousSession);

  const routingContext = await buildAssistantRoutingContext(request, {
    locale: envelope.locale,
    recentMessages: envelope.history,
    previousTopic: resolvePreviousTopic(envelope.history),
    hasAttachment: false,
    semanticHint: null,
  });
  const routedQuestion = envelope.question;
  const outcome = routeAssistantQuestion(routedQuestion, routingContext);
  let answerMode = resolveAnswerMode(routedQuestion, envelope.history, outcome, routingContext);
  const locale = envelope.locale;

  if (containsSensitiveInput(envelope.question, envelope.history)) {
    return admitted(streamDirectAnswer(sensitiveInputCopy(locale), {
      source: 'policy',
      answerMode,
      currentDataRequired: false,
      modelIdentity: null,
      truncated: false,
      safetyFlags: ['SENSITIVE_INPUT_BLOCKED'],
    }));
  }

  if (outcome.decision === 'BLOCK_SAFETY') {
    return admitted(streamDirectAnswer(safetyBoundaryCopy(locale), {
      source: 'policy',
      answerMode,
      currentDataRequired: false,
      modelIdentity: null,
      truncated: false,
      safetyFlags: ['SAFETY_BOUNDARY_BLOCKED'],
    }));
  }

  let grounding: PublicKnowledgeAnswer;
  if (answerMode === 'verified_platform') {
    const groundingResponse = await knowledgePost(rebuildRequestWithoutStream(request, rawBody));
    if (!groundingResponse.ok) return admitted(groundingResponse);
    try {
      grounding = await groundingResponse.json() as PublicKnowledgeAnswer;
    } catch {
      return admitted(NextResponse.json(
        { code: 'PUBLIC_ASSISTANT_GROUNDING_INVALID', message: 'Verified public grounding is unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      ));
    }
    if (grounding.resolution === 'redirected') {
      answerMode = 'general_agro';
      grounding = generalAgroGrounding(locale);
    }
  } else {
    grounding = generalAgroGrounding(locale);
  }

  return admitted(streamModelFirstAnswer(request, grounding, envelope, routingContext, answerMode));
}

async function authorizeGektaAnswer(request: NextRequest): Promise<{
  response: NextResponse | null;
  anonymousSession: GektaAnonymousSession | null;
}> {
  const ticket = String(request.headers.get('x-gekta-answer-ticket') || '').trim();
  if (!ticket || ticket.length > 256) {
    return {
      response: NextResponse.json(
        { code: 'GEKTA_ANSWER_RESERVATION_REQUIRED' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }

  if (ticket === 'account') {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
    const upstream = gektaApiBase();
    if (!accessToken || !upstream) {
      return {
        response: NextResponse.json(
          { code: accessToken ? 'GEKTA_SERVICE_UNAVAILABLE' : 'GEKTA_ACCOUNT_SESSION_REQUIRED' },
          { status: accessToken ? 503 : 401, headers: { 'Cache-Control': 'no-store' } },
        ),
        anonymousSession: null,
      };
    }
    try {
      const entitlement = await fetch(`${upstream}/gekta/entitlement`, {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
      });
      const payload = await entitlement.json().catch(() => null) as { entitlement?: { canAsk?: boolean } } | null;
      if (!entitlement.ok || payload?.entitlement?.canAsk !== true) {
        const status = entitlement.status === 401 || entitlement.status === 403
          ? entitlement.status
          : entitlement.ok ? 403 : 503;
        return {
          response: NextResponse.json(
            { code: status === 503 ? 'GEKTA_SERVICE_UNAVAILABLE' : 'GEKTA_ACCESS_DENIED' },
            { status, headers: { 'Cache-Control': 'no-store' } },
          ),
          anonymousSession: null,
        };
      }
      return { response: null, anonymousSession: null };
    } catch {
      return {
        response: NextResponse.json(
          { code: 'GEKTA_SERVICE_UNAVAILABLE' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        ),
        anonymousSession: null,
      };
    }
  }

  const current = parseAnonymousSession(request.cookies.get(GEKTA_ANONYMOUS_COOKIE)?.value);
  if (!current || !resolveAnonymousEntitlement({ used: current.used }, new Date()).canAsk) {
    return {
      response: NextResponse.json(
        { code: 'GEKTA_ACCESS_DENIED' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }
  const consumed = admitReservedAnswer(current, ticket);
  if (!consumed) {
    return {
      response: NextResponse.json(
        { code: 'GEKTA_ANSWER_RESERVATION_INVALID' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }

  const durableAdmission = await consumeAnonymousReservation(request, current.sid, ticket);
  if (durableAdmission !== 'allowed') {
    const unavailable = durableAdmission === 'unavailable';
    return {
      response: NextResponse.json(
        { code: unavailable ? 'GEKTA_SERVICE_UNAVAILABLE' : 'GEKTA_ANSWER_RESERVATION_INVALID' },
        { status: unavailable ? 503 : 409, headers: { 'Cache-Control': 'no-store' } },
      ),
      anonymousSession: null,
    };
  }
  return { response: null, anonymousSession: consumed };
}

async function consumeAnonymousReservation(
  request: NextRequest,
  sid: string,
  ticket: string,
): Promise<'allowed' | 'denied' | 'unavailable'> {
  const upstream = gektaApiBase();
  const deliveryKey = registrationDeliveryKey();
  if (!upstream || deliveryKey.length < 32) return 'unavailable';

  const correlationId = request.headers.get('x-correlation-id') || randomUUID();
  try {
    const response = await fetch(`${upstream}/gekta/internal/anonymous-answer/admit`, {
      method: 'POST',
      headers: gektaForwardHeaders(request, correlationId, { deliveryKey }),
      body: JSON.stringify({ sid, ticket }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(GEKTA_AUTH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) return 'unavailable';
    if (!response.ok) return 'unavailable';
    const payload = await response.json().catch(() => null) as { allowed?: boolean } | null;
    return payload?.allowed === true ? 'allowed' : 'denied';
  } catch {
    return 'unavailable';
  }
}

function applyGektaAdmission(
  response: NextResponse,
  anonymousSession: GektaAnonymousSession | null,
): NextResponse {
  if (!anonymousSession) return response;
  response.cookies.set(GEKTA_ANONYMOUS_COOKIE, serializeAnonymousSession(anonymousSession), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

function resolveAnswerMode(
  question: string,
  history: readonly HistoryTurn[],
  outcome: ReturnType<typeof routeAssistantQuestion>,
  context: AssistantRoutingContext,
): PublicAnswerMode {
  const normalized = normalizeIntent(question);
  if (GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) return 'general_agro';
  if (outcome.section || outcome.signals.includes('platform_term')) return 'verified_platform';
  if (EXPLICIT_PLATFORM_PATTERNS.some((pattern) => pattern.test(normalized))) return 'verified_platform';

  // A self-contained agricultural subject is not a platform follow-up merely
  // because it is short or because an older platform topic exists in history.
  // This protects questions such as "Как хранить зерно после уборки?" from
  // being answered with stale Transparent Price copy.
  if (outcome.signals.includes('agro_term')) return 'general_agro';

  const compactFollowUp = normalized.split(' ').filter(Boolean).length <= 7;
  if (compactFollowUp && context.previousTopic) return 'verified_platform';
  if (compactFollowUp) {
    const prior = normalizeIntent(history.slice(-6).map((turn) => turn.text).join(' '));
    if (EXPLICIT_PLATFORM_PATTERNS.some((pattern) => pattern.test(prior))) return 'verified_platform';
  }

  // Model-first boundary: everything not explicitly identified as a platform
  // fact is sent to the model. The model system prompt handles greetings,
  // agriculture, agribusiness, adjacent operations and concise safe general help.
  // A lexical miss must never prevent a legitimate domain question from inference.
  return 'general_agro';
}

function streamModelFirstAnswer(
  request: NextRequest,
  grounding: PublicKnowledgeAnswer,
  envelope: PublicEnvelope,
  routingContext: AssistantRoutingContext,
  answerMode: PublicAnswerMode,
) {
  const encoder = new TextEncoder();
  const streamId = randomUUID();
  const runtimeConfig = readRuntimeConfig();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const writer = new GatewayStreamWriter(
        (chunk) => { if (!closed) controller.enqueue(encoder.encode(chunk)); },
        'public',
        streamId,
      );
      const finish = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      const cancel = () => {
        writer.fail('CANCELLED', 'The reader cancelled the answer.');
        finish();
      };

      if (request.signal.aborted) {
        cancel();
        return;
      }
      request.signal.addEventListener('abort', cancel, { once: true });
      writer.emit({ event: 'meta', mode: 'public', modelIdentity: null });

      const run = async () => {
        const locale = resolveLocale(grounding, envelope.locale);
        const currentDataRequired = answerMode === 'general_agro' && requiresCurrentEvidence(envelope.question);

        // Rebuilt from this request's own history every time. A short follow-up
        // resolves against the subject this state carries instead of being sent
        // to the model as a bare "а если весной?" with twelve raw turns behind
        // it and no statement of what the conversation is actually about.
        const conversationState: ConversationState = replayConversationState({
          conversationId: envelope.conversationId,
          history: envelope.history,
          message: envelope.question,
          requestedLanguage: locale as ConversationLanguage,
          dealContext: null,
        });

        if (grounding.resolution === 'refused') {
          writer.fail(
            'ABSTAINED_NO_DATA',
            grounding.answer || 'The requested private or write capability is unavailable in public mode.',
          );
          return;
        }

        if (!runtimeConfig.enabled || !runtimeConfig.endpoint) {
          if (answerMode === 'verified_platform') {
            emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_RUNTIME_UNAVAILABLE');
          } else {
            writer.fail('UPSTREAM_ERROR', modelUnavailableCopy(locale));
          }
          return;
        }

        const payload = {
          question: grounding.understanding?.normalizedQuestion || envelope.question || grounding.title,
          originalQuestion: envelope.question,
          locale,
          answerMode,
          currentDataRequired,
          // Raw turns before the newest explicit correction are retired from the
          // model prompt. They remain available to state replay above, where the
          // newest statement deterministically overwrites stale subject facts.
          history: historyAfterLatestCorrection(envelope.history),
          // Public contour: no deal, tenant, organization or role context is
          // ever derived into this state, so none can travel with it.
          conversationState: renderStateForPrompt(conversationState),
          cabinetRole: routingContext.role,
          page: routingContext.page,
          selectedObject: routingContext.selectedObject,
          grounding: {
            knowledgeVersion: grounding.knowledgeVersion,
            topic: grounding.topic,
            title: grounding.title,
            answer: grounding.answer,
            facts: grounding.facts,
            maturity: grounding.maturity,
            confidence: grounding.confidence,
            sources: grounding.sources,
          },
        };

        // Sources first, so a reader has the citation list while the answer is
        // still arriving rather than only once it has finished.
        if (answerMode === 'verified_platform') emitSources(writer, grounding.sources);

        let relayed = 0;
        let assessment: string | null = null;
        let terminal: { complete: boolean; refusal: GatewayRefusal | null } | null = null;

        try {
          for await (const event of streamInternalModel(
            { endpoint: runtimeConfig.endpoint, secret: runtimeConfig.secret, identity: runtimeConfig.identity, timeoutMs: runtimeConfig.timeoutMs },
            payload,
            request.signal,
          )) {
            if (event.kind === 'token') {
              // Forwarded the moment it arrives. Nothing accumulates here: the
              // whole point of this path is that the reader sees the model's
              // first sentence while the model is still writing the rest.
              relayed += 1;
              if (!writer.emit({ event: 'token', text: event.text })) return;
              continue;
            }
            if (event.kind === 'assessment') {
              assessment = event.summary;
              continue;
            }
            if (event.kind === 'terminal') {
              terminal = { complete: event.complete, refusal: event.refusal };
              break;
            }
          }
        } catch {
          if (request.signal.aborted) return;
          terminal = { complete: false, refusal: 'UPSTREAM_ERROR' };
        }

        if (request.signal.aborted) return;

        // Falling back after tokens have already been relayed would splice a
        // second, unrelated answer onto a partial one, so the fallback is only
        // available while nothing has reached the reader.
        if (!terminal || !terminal.complete || relayed === 0) {
          if (relayed > 0) {
            writer.fail(terminal?.refusal ?? 'UPSTREAM_ERROR', modelUnavailableCopy(locale));
            return;
          }
          if (answerMode === 'verified_platform') {
            emitGroundedFallback(writer, grounding, answerMode, currentDataRequired, 'MODEL_RUNTIME_FALLBACK');
          } else {
            writer.fail(terminal?.refusal ?? 'UPSTREAM_ERROR', modelUnavailableCopy(locale));
          }
          return;
        }

        writer.emit({
          event: 'assessment',
          summary: JSON.stringify({
            source: 'local_qwen',
            answerMode,
            currentDataRequired,
            streaming: 'incremental',
            upstream: assessment ? safeAssessment(assessment) : null,
          }),
          operationalStatus: 'NOT_ATTESTED',
        });
        writer.complete();
      };

      void run()
        .catch(() => {
          if (!request.signal.aborted) writer.fail('UPSTREAM_ERROR', 'The public assistant could not complete the answer.');
        })
        .finally(() => {
          request.signal.removeEventListener('abort', cancel);
          finish();
        });
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform, max-age=0',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function streamDirectAnswer(answer: string, assessment: Readonly<Record<string, unknown>>) {
  const encoder = new TextEncoder();
  const writerId = randomUUID();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = new GatewayStreamWriter((chunk) => controller.enqueue(encoder.encode(chunk)), 'public', writerId);
      writer.emit({ event: 'meta', mode: 'public', modelIdentity: null });
      emitDirectAnswer(writer, answer, assessment);
      controller.close();
    },
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform, max-age=0',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function emitSources(
  writer: GatewayStreamWriter,
  sources: readonly Readonly<{ label: string; href: string }>[],
): void {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').trim() || null;
  for (const source of sources) {
    const uri = absoluteCitationUri(source.href, base);
    if (!uri) continue;
    if (!writer.emit({ event: 'citation', sourceId: source.href, title: source.label || source.href, uri })) return;
  }
}

function emitDirectAnswer(
  writer: GatewayStreamWriter,
  answer: string,
  assessment: Readonly<Record<string, unknown>>,
): void {
  for (const chunk of frameText(answer)) {
    if (!writer.emit({ event: 'token', text: chunk })) return;
  }
  writer.emit({ event: 'assessment', summary: JSON.stringify(assessment), operationalStatus: 'NOT_ATTESTED' });
  writer.complete();
}

function emitGroundedFallback(
  writer: GatewayStreamWriter,
  grounding: PublicKnowledgeAnswer,
  answerMode: PublicAnswerMode,
  currentDataRequired: boolean,
  safetyFlag: string,
): void {
  emitSources(writer, grounding.sources);
  emitDirectAnswer(writer, grounding.answer, {
    source: 'verified_knowledge',
    answerMode,
    currentDataRequired,
    modelIdentity: null,
    truncated: false,
    safetyFlags: [safetyFlag],
  });
}

function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const enabled = (environment.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED || '').trim() === 'true';
  const secret = (environment.TAI_PUBLIC_GATEWAY_HMAC_SECRET || '').trim();
  const identity = (environment.TAI_RESTRICTED_QWEN_MODEL_IDENTITY || '').trim();
  const rawBase = (environment.TAI_INTERNAL_API_BASE_URL || environment.NEXT_PUBLIC_API_URL || '').trim();
  const timeoutMs = boundedInteger(environment.TAI_PUBLIC_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 150_000);
  if (!enabled) return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  if (secret.length < 32 || !identity || !rawBase) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }

  let base: URL;
  try { base = new URL(rawBase.endsWith('/') ? rawBase : `${rawBase}/`); } catch {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  const allowedHosts = (environment.TAI_INTERNAL_API_ALLOWED_HOSTS || '')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!allowedHosts.includes(base.hostname.toLowerCase())) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  return Object.freeze({
    enabled: true,
    endpoint: resolveInternalStreamEndpoint(base),
    secret,
    identity,
    timeoutMs,
  });
}

function generalAgroGrounding(locale: PublicLocale): PublicKnowledgeAnswer {
  const copy = locale === 'en'
    ? {
        title: 'Agriculture, agribusiness and practical assistance',
        answer: 'Prioritize agriculture and agribusiness, but answer safe general questions normally and concisely. Use stable knowledge, identify missing inputs and do not invent current facts.',
        maturity: 'General read-only assistance. Critical agronomic, veterinary, machinery, legal and financial decisions require confirmed inputs and the appropriate qualified review.',
      }
    : locale === 'zh'
      ? {
          title: '农业、农业商业与实用协助',
          answer: '优先处理农业和农业商业问题，同时正常、简洁地回答安全的一般问题。使用稳定知识，指出缺失信息，不得编造当前事实。',
          maturity: '通用只读协助。关键农艺、兽医、机械、法律和财务决策需要确认输入并由相应的合格专业人员复核。',
        }
      : {
          title: 'Сельское хозяйство, агробизнес и практическая помощь',
          answer: 'Приоритет — сельское хозяйство и агробизнес, но на безопасные общие вопросы отвечай нормально и кратко. Используй устойчивые знания, обозначай недостающие исходные данные и не выдумывай актуальные факты.',
          maturity: 'Общая помощь в режиме только чтения. Критические агрономические, ветеринарные, технические, юридические и финансовые решения требуют подтверждённых исходных данных и профильной проверки.',
        };
  return Object.freeze({
    requestId: `general-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    knowledgeVersion: 'tai-agro-general-model-first.v2',
    dataMode: 'public_knowledge',
    mode: 'read_only',
    resolution: 'answered',
    topic: 'general_agro',
    title: copy.title,
    answer: copy.answer,
    facts: Object.freeze([]),
    maturity: copy.maturity,
    confidence: 'medium',
    actionAllowed: false,
    sources: Object.freeze([]),
  });
}

function readPublicEnvelope(rawBody: string): PublicEnvelope {
  try {
    const row = asRecord(JSON.parse(rawBody));
    if (!row) return emptyEnvelope();
    const question = typeof row.message === 'string' ? row.message.trim().slice(0, 1_200) : '';
    const locale: PublicLocale = row.locale === 'en' || row.locale === 'zh' ? row.locale : 'ru';
    const context = typeof row.context === 'string' ? row.context.trim().slice(0, 120) : 'platform';
    const history = normalizeHistory(row.history);
    return Object.freeze({
      question,
      locale,
      context,
      // A label only: nothing is looked up by it, so a forged value reaches no
      // context beyond the history this same request already carried.
      conversationId: conversationIdFrom(row.conversationId, `${context}-${locale}-${history.length}`),
      history,
    });
  } catch {
    return emptyEnvelope();
  }
}

function emptyEnvelope(): PublicEnvelope {
  return Object.freeze({
    question: '',
    locale: 'ru',
    context: 'platform',
    conversationId: conversationIdFrom(null, 'empty-envelope'),
    history: [],
  });
}

/**
 * The upstream assessment, reduced to what the public contour may repeat.
 *
 * It is model-adjacent operational metadata, so it is parsed and re-projected
 * rather than forwarded verbatim: a field added upstream should not reach a
 * public reader because nobody remembered this relay existed.
 */
function safeAssessment(summary: string): Record<string, unknown> | null {
  try {
    const row = JSON.parse(summary) as Record<string, unknown>;
    return {
      finishReason: typeof row.finishReason === 'string' ? row.finishReason : 'other',
      truncated: row.truncated === true,
      safetyFlags: Array.isArray(row.safetyFlags) ? row.safetyFlags.filter((flag) => typeof flag === 'string').slice(0, 12) : [],
    };
  } catch {
    return null;
  }
}

function normalizeHistory(value: unknown): readonly HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: HistoryTurn[] = [];
  let total = 0;
  for (const item of value.slice(-MAX_HISTORY_TURNS)) {
    const row = asRecord(item);
    const role = row?.role === 'assistant' ? 'assistant' : row?.role === 'user' ? 'user' : null;
    const text = typeof row?.text === 'string'
      ? row.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' ').trim().slice(0, MAX_HISTORY_TURN_CHARS)
      : '';
    if (!role || !text) continue;
    if (total + text.length > MAX_HISTORY_TOTAL_CHARS) break;
    turns.push(Object.freeze({ role, text }));
    total += text.length;
  }
  return Object.freeze(turns);
}

function historyAfterLatestCorrection(history: readonly HistoryTurn[]): readonly HistoryTurn[] {
  let correctionIndex = -1;
  for (let index = 0; index < history.length; index += 1) {
    const turn = history[index];
    if (turn.role !== 'user') continue;
    if (CORRECTION_HISTORY_PATTERNS.some((pattern) => pattern.test(turn.text))) correctionIndex = index;
  }
  return correctionIndex >= 0 ? Object.freeze(history.slice(correctionIndex)) : history;
}

function requiresCurrentEvidence(question: string): boolean {
  const normalized = normalizeIntent(question);
  return CURRENT_EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function containsSensitiveInput(question: string, history: readonly HistoryTurn[]): boolean {
  const wire = [question, ...history.map((turn) => turn.text)].join('\n');
  return SENSITIVE_INPUT_PATTERNS.some((pattern) => pattern.test(wire));
}

function resolveLocale(grounding: PublicKnowledgeAnswer, requested: PublicLocale): PublicLocale {
  const detected = grounding.understanding?.detectedLocale;
  return detected === 'en' || detected === 'zh' ? detected : requested;
}

function modelUnavailableCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'The agricultural AI did not finish the answer. Retry the request.';
  if (locale === 'zh') return '农业人工智能未能完成回答。请重试该问题。';
  return 'ИИ для сельского хозяйства не завершил ответ. Повтори запрос.';
}

function sensitiveInputCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'Do not send passwords, API keys, tokens, banking credentials or personal data in this public chat. Remove the sensitive value and ask the question again.';
  if (locale === 'zh') return '请勿在公共聊天中发送密码、API 密钥、令牌、银行凭据或个人数据。删除敏感值后重新提问。';
  return 'Не отправляй в публичный чат пароли, API-ключи, токены, банковские реквизиты и персональные данные. Удали секретное значение и задай вопрос повторно.';
}

function safetyBoundaryCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'I cannot help bypass protection, access another party’s data, escalate privileges or perform an unauthorized action. I can explain the authorized process, safe diagnostics or the requirements for approved access.';
  if (locale === 'zh') return '我不能协助绕过保护、访问他方数据、提升权限或执行未经授权的操作。我可以说明合规流程、安全诊断方法或获得授权访问所需的条件。';
  return 'Не могу помогать обходить защиту, получать чужие данные, повышать права или выполнять действие без полномочий. Могу объяснить штатный порядок, безопасную диагностику или требования к разрешённому доступу.';
}

function normalizeIntent(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}\s«»"'-]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function rebuildRequestWithoutStream(request: NextRequest, rawBody: string): NextRequest {
  const url = new URL(request.url);
  url.searchParams.delete('stream');
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return new NextRequest(url, { method: 'POST', headers, body: rawBody });
}


function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
