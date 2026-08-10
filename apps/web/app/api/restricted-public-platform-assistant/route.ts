
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
  history: readonly HistoryTurn[];
}>;

const SENSITIVE_INPUT_PATTERNS = [
  /\b(?:пароль|password|api[\s_-]?key|ключ\s+api|токен|token|secret)\s*[:=]\s*\S{6,}/iu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/iu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
] as const;

const EXPLICIT_PLATFORM_PATTERNS = [
  /(?:прозрачн\w*\s+цен\w*|transparent\s+price|透明价格)/iu,
  /(?:эта|данная|ваша|наша)\s+(?:платформа|система)|(?:платформа|система)\s+(?:прозрачн\w*\s+цен\w*)/iu,
  /(?:как\s+работает|как\s+устроен\w*|что\s+такое|для\s+чего|зачем|чем\s+помогает|опиши(?:те)?|расскажи(?:те)?)\s+(?:(?:эта|данная|ваша|наша)\s+)?платформ\w*/iu,
  /(?:как\s+(?:работает|устроен[ао]?|функционирует)\s+систем\w*|систем\w*\s+как\s+(?:работает|устроен[ао]?|функционирует))/iu,
  /(?:how\s+does\s+(?:the\s+)?(?:platform|system)\s+work|how\s+is\s+(?:the\s+)?(?:platform|system)\s+(?:structured|organized))/iu,
  /(?:(?:平台|系统).{0,4}(?:如何|怎么).{0,4}(?:运作|运行|工作)|(?:如何|怎么).{0,4}(?:运作|运行|工作).{0,4}(?:平台|系统))/u,
  /(?:личн\w*\s+кабинет|зарегистрир\w*|регистрац\w*|подключить\s+организац\w*|стоимост\w*\s+(?:доступа|внедрения)|тариф\w*)/iu,
  /(?:что\s+(?:ты|вы)\s+уме\w*|возможност\w*\s+(?:ии|помощника)|ваш\w*\s+ии|функционал\w*\s+(?:платформы|системы)?)/iu,
  /(?:your\s+platform|this\s+platform|the\s+platform|workspace|sign\s*up|register|platform\s+capabilit)/iu,
  /(?:你们的平台|本平台|平台中|注册|客服)/u,
] as const;

const PLATFORM_WORKFLOW_PATTERNS = [
  /(?:сделк\w*|аукцион\w*|допуск\w*|при[её]мк\w*|лаборатор\w*|документ\w*|выплат\w*|спор\w*|доказательств\w*|роль\w*)/iu,
  /(?:фгис\s*[«"']?зерно|интеграц\w*|эдо|1с|tms|erp|api-интеграц\w*)/iu,
  /(?:как\s+работает\s+логистик\w*|логистик\w*\s+(?:в|на)\s+(?:платформе|системе)|выгруз\w*\s+парти\w*)/iu,
  /(?:deal|auction|acceptance|laboratory|documents?|payment|dispute|evidence|integration)/iu,
  /(?:交易|竞价|验收|实验室|文件|付款|争议|集成)/u,
] as const;

const GENERAL_AGRO_DEPTH_PATTERNS = [
  /(?:почв\w*|удобрени\w*|семен\w*|сорт\w*|гибрид\w*|вредител\w*|болезн\w*|севооборот\w*|урожайн\w*|агроном\w*)/iu,
  /(?:трактор\w*|комбайн\w*|опрыскивател\w*|посев\w*|уборк\w*|влажност\w*|протеин\w*|клейковин\w*)/iu,
  /(?:soil|fertili[sz]er|seed|crop|yield|agronom|tractor|combine|harvest)/iu,
  /(?:土壤|肥料|种子|作物|产量|农艺|拖拉机|收获)/u,
] as const;

const CURRENT_EVIDENCE_PATTERNS = [
  /(?:сегодня|сейчас|на\s+данный\s+момент|последн\w*|свеж\w*|актуальн\w*|текущ\w*)/iu,
  /(?:новост\w*|погод\w*|курс\w*|пошлин\w*|ставк\w*|котировк\w*|индекс\w*|статистик\w*)/iu,
  /(?:цена|стоимост\w*)\s+(?:сегодня|сейчас|на\s+сегодня|в\s+регионе)/iu,
  /(?:today|current|latest|recent|news|weather|exchange\s+rate|tariff|duty|statistics)/iu,
  /(?:今天|当前|最新|新闻|天气|汇率|关税|统计)/u,
] as const;

export async function GET(request: NextRequest) {
  return knowledgeGet(request);
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('stream') !== '1') return knowledgePost(request);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return knowledgePost(request);

  const rawBody = await request.text();
  const envelope = readPublicEnvelope(rawBody);
  // Role and page are resolved from the request, not from the envelope: the
  // exact cabinet role reaches the model unchanged, while organization, tenant
  // and object identifiers never enter the payload at all.
  const routingContext = await buildAssistantRoutingContext(request, {
    locale: envelope.locale,
    recentMessages: envelope.history,
    previousTopic: resolvePreviousTopic(envelope.history),
    hasAttachment: false,
    semanticHint: null,
  });
  const groundingResponse = await knowledgePost(rebuildRequestWithoutStream(request, rawBody));
  if (!groundingResponse.ok) return groundingResponse;

  let grounding: PublicKnowledgeAnswer;
  try {
    grounding = await groundingResponse.json() as PublicKnowledgeAnswer;
  } catch {
    return NextResponse.json(
      { code: 'PUBLIC_ASSISTANT_GROUNDING_INVALID', message: 'Verified public grounding is unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return streamRestrictedAnswer(request, grounding, envelope, routingContext);
}

function streamRestrictedAnswer(
  request: NextRequest,
  grounding: PublicKnowledgeAnswer,
  envelope: PublicEnvelope,
  routingContext: AssistantRoutingContext,
) {
  const encoder = new TextEncoder();
  const streamId = crypto.randomUUID();
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
        const routedQuestion = grounding.understanding?.normalizedQuestion || envelope.question;
        const outcome = routeAssistantQuestion(routedQuestion, { ...routingContext, locale });
        // The router sees the page, the exact role and the conversation, so a
        // short follow-up keeps its platform subject instead of falling back to
        // general agriculture once the reader stops repeating the noun.
        const answerMode: PublicAnswerMode = outcome.section
          ? 'verified_platform'
          : classifyAnswerMode(routedQuestion, envelope.context, envelope.history);
        const currentDataRequired = answerMode === 'general_agro' && requiresCurrentEvidence(envelope.question);

        if (containsSensitiveInput(envelope.question, envelope.history)) {
          emitDirectAnswer(writer, sensitiveInputCopy(locale), {
            source: 'policy', answerMode, currentDataRequired, modelIdentity: null,
            truncated: false, safetyFlags: ['SENSITIVE_INPUT_BLOCKED'],
          });
          return;
        }

        if (grounding.resolution === 'refused') {
          writer.fail(
            'ABSTAINED_NO_DATA',
            grounding.answer || 'The requested private or write capability is unavailable in public mode.',
          );
          return;
        }

        // A redirected question is served verbatim from verified knowledge: the
        // text already says what this assistant covers, and sending it through
        // the model would only invite it to improvise a topic it does not have.
        if (grounding.resolution === 'redirected') {
          emitDirectAnswer(writer, grounding.answer, {
            source: 'verified_knowledge', answerMode, currentDataRequired: false,
            modelIdentity: null, truncated: false, safetyFlags: [],
          });
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
          history: envelope.history,
          // The exact cabinet role, never folded into a coarse class: twelve
          // cabinets collapsed into a handful of buckets is what made
          // role-specific answers disappear before the model ever saw them.
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

        if (answerMode === 'verified_platform') emitSources(writer, grounding.sources);

        let relayed = 0;
        let identity: string | null = null;
        let upstream: Record<string, unknown> | null = null;
        let terminal: { complete: boolean; refusal: GatewayRefusal | null } | null = null;

        try {
          for await (const event of streamInternalModel(
            {
              endpoint: runtimeConfig.endpoint,
              secret: runtimeConfig.secret,
              identity: runtimeConfig.identity,
              timeoutMs: runtimeConfig.timeoutMs,
            },
            payload,
            request.signal,
          )) {
            if (event.kind === 'meta') {
              identity = event.modelIdentity;
              continue;
            }
            if (event.kind === 'token') {
              relayed += 1;
              if (!writer.emit({ event: 'token', text: event.text })) return;
              continue;
            }
            if (event.kind === 'assessment') {
              upstream = readUpstreamAssessment(event.summary);
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

        // Once text has reached the reader there is no clean way back to a
        // different answer, so the fallback is only available before that.
        if (!terminal || !terminal.complete || relayed === 0) {
          if (relayed === 0 && answerMode === 'verified_platform') {
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
            modelIdentity: identity,
            finishReason: upstream?.finishReason ?? 'stop',
            truncated: upstream?.truncated === true,
            safetyFlags: upstream?.safetyFlags ?? [],
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
  if (answerMode === 'verified_platform') emitSources(writer, grounding.sources);
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

function readPublicEnvelope(rawBody: string): PublicEnvelope {
  try {
    const row = asRecord(JSON.parse(rawBody));
    if (!row) return emptyEnvelope();
    const question = typeof row.message === 'string' ? row.message.trim().slice(0, 1_200) : '';
    const locale: PublicLocale = row.locale === 'en' || row.locale === 'zh' ? row.locale : 'ru';
    const context = typeof row.context === 'string' ? row.context.trim().slice(0, 120) : 'platform';
    return Object.freeze({ question, locale, context, history: normalizeHistory(row.history) });
  } catch {
    return emptyEnvelope();
  }
}

function emptyEnvelope(): PublicEnvelope {
  return Object.freeze({ question: '', locale: 'ru', context: 'platform', history: [] });
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

function classifyAnswerMode(question: string, context: string, history: readonly HistoryTurn[]): PublicAnswerMode {
  const normalized = normalizeIntent(question);
  if (EXPLICIT_PLATFORM_PATTERNS.some((pattern) => pattern.test(normalized))) return 'verified_platform';
  const workflow = PLATFORM_WORKFLOW_PATTERNS.some((pattern) => pattern.test(normalized));
  const deepAgro = GENERAL_AGRO_DEPTH_PATTERNS.some((pattern) => pattern.test(normalized));
  if (workflow && !deepAgro) return 'verified_platform';

  const compactFollowUp = normalized.split(' ').filter(Boolean).length <= 7
    && /^(?:а|и|но|тогда|для|это|подробнее|почему|как|сколько)\b/iu.test(normalized);
  if (compactFollowUp) {
    const prior = history.slice(-6).map((turn) => normalizeIntent(turn.text)).join(' ');
    if (
      EXPLICIT_PLATFORM_PATTERNS.some((pattern) => pattern.test(prior))
      || PLATFORM_WORKFLOW_PATTERNS.some((pattern) => pattern.test(prior))
    ) return 'verified_platform';
  }
  if (context !== 'platform' && /(?:платформ|сделк|аукцион|кабинет|фгис|интеграц)/iu.test(context)) {
    return 'verified_platform';
  }
  return 'general_agro';
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
  if (locale === 'en') return 'The local agricultural AI did not finish the answer. Retry the request.';
  if (locale === 'zh') return '本地农业人工智能未能完成回答。请重试该问题。';
  return 'Локальный ИИ для агробизнеса не завершил ответ. Повтори запрос.';
}

function sensitiveInputCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'Do not send passwords, API keys, tokens, banking credentials or personal data in this public chat. Remove the sensitive value and ask the question again.';
  if (locale === 'zh') return '请勿在公共聊天中发送密码、API 密钥、令牌、银行凭据或个人数据。删除敏感值后重新提问。';
  return 'Не отправляй в публичный чат пароли, API-ключи, токены, банковские реквизиты и персональные данные. Удали секретное значение и задай вопрос повторно.';
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

/**
 * The upstream assessment, reduced to the fields the public contour may repeat.
 * Parsed and re-projected rather than forwarded, so a field added upstream does
 * not reach a public reader because nobody remembered this relay existed.
 */
function readUpstreamAssessment(summary: string): Record<string, unknown> | null {
  try {
    const row = JSON.parse(summary) as Record<string, unknown>;
    return {
      finishReason: typeof row.finishReason === 'string' ? row.finishReason : 'stop',
      truncated: row.truncated === true,
      safetyFlags: Array.isArray(row.safetyFlags)
        ? row.safetyFlags.filter((flag) => typeof flag === 'string').slice(0, 12)
        : [],
    };
  } catch {
    return null;
  }
}
