import { createHash, createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  GatewayStreamWriter,
  chunkAnswer,
} from '@pc/ai-assistant-stream-contract';
import {
  GET as verifiedGet,
  POST as verifiedPost,
} from '../restricted-public-platform-assistant/route';
import {
  isVerifiedPlatformQuestion,
  selectAgroChatHistory,
  type AgroChatHistoryTurn,
} from '@/lib/platform-v7/agro-chat-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SIGNATURE_VERSION = 'tai-public-qwen.v1';
const INTERNAL_PATH = '/internal/tai/public-generate';
const MAX_BODY_BYTES = 20_480;
const MAX_MESSAGE_LENGTH = 1_200;
const MAX_API_RESPONSE_BYTES = 1_048_576;
const DEFAULT_TIMEOUT_MS = 130_000;

type PublicLocale = 'ru' | 'en' | 'zh';
type Envelope = Readonly<{
  question: string;
  locale: PublicLocale;
  context: string;
  history: readonly AgroChatHistoryTurn[];
}>;
type RuntimeConfig = Readonly<{
  enabled: boolean;
  endpoint: URL | null;
  secret: string;
  identity: string;
  timeoutMs: number;
}>;
type ModelResponse = Readonly<{
  answer: string;
  provider: 'openai-compatible';
  modelIdentity: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  operationalStatus: 'NOT_ATTESTED';
  mode: 'read_only';
  answerMode: 'general_agro';
  finishReason: 'stop' | 'length' | 'other';
  truncated: boolean;
  safetyFlags: readonly string[];
}>;

const CURRENT_EVIDENCE_PATTERNS = [
  /(?:сегодня|сейчас|на\s+данный\s+момент|последн\w*|свеж\w*|актуальн\w*|текущ\w*)/iu,
  /(?:новост\w*|погод\w*|курс\w*|пошлин\w*|ставк\w*|котировк\w*|индекс\w*|статистик\w*)/iu,
  /(?:today|current|latest|recent|news|weather|exchange\s+rate|tariff|duty|statistics)/iu,
  /(?:今天|当前|最新|新闻|天气|汇率|关税|统计)/u,
] as const;

const SENSITIVE_INPUT_PATTERNS = [
  /\b(?:пароль|password|api[\s_-]?key|ключ\s+api|токен|token|secret)\s*[:=]\s*\S{6,}/iu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/u,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/iu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
] as const;

export async function GET(request: NextRequest) {
  return verifiedGet(request);
}

export async function POST(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ code: 'PUBLIC_ASSISTANT_CROSS_SITE_DENIED', message: 'Cross-site requests are not accepted.' }, 403);
  }
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ code: 'PUBLIC_ASSISTANT_JSON_REQUIRED', message: 'Content-Type application/json is required.' }, 415);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json({ code: 'PUBLIC_ASSISTANT_BODY_TOO_LARGE', message: 'Request body is too large.' }, 413);
  }

  let row: Record<string, unknown>;
  try {
    const decoded = JSON.parse(rawBody) as unknown;
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('invalid_shape');
    row = decoded as Record<string, unknown>;
  } catch {
    return json({ code: 'PUBLIC_ASSISTANT_INVALID_JSON', message: 'Invalid JSON body.' }, 400);
  }

  const question = typeof row.message === 'string'
    ? row.message.replace(/\s+/gu, ' ').trim().slice(0, MAX_MESSAGE_LENGTH)
    : '';
  if (!question) return json({ code: 'PUBLIC_ASSISTANT_MESSAGE_REQUIRED', message: 'Message is required.' }, 400);
  if (typeof row.message === 'string' && row.message.trim().length > MAX_MESSAGE_LENGTH) {
    return json({ code: 'PUBLIC_ASSISTANT_MESSAGE_TOO_LONG', message: `Maximum length is ${MAX_MESSAGE_LENGTH} characters.` }, 400);
  }

  const locale: PublicLocale = row.locale === 'en' || row.locale === 'zh' ? row.locale : 'ru';
  const context = typeof row.context === 'string' ? row.context.trim().slice(0, 120) : 'platform';
  const history = selectAgroChatHistory(question, row.history);
  const envelope: Envelope = Object.freeze({ question, locale, context, history });
  const normalizedBody = JSON.stringify({ ...row, message: question, locale, context, history });

  if (isVerifiedPlatformQuestion(question)) {
    return verifiedPost(rebuildRequest(request, normalizedBody));
  }

  if (containsSensitiveInput(envelope)) {
    const answer = sensitiveInputCopy(locale);
    return request.nextUrl.searchParams.get('stream') === '1'
      ? directTextStream(answer, locale, 'policy')
      : jsonAnswer(answer, envelope, 'policy');
  }

  if (request.nextUrl.searchParams.get('stream') === '1') {
    return streamAgroAnswer(request, envelope);
  }

  try {
    const answer = await generateAgroAnswer(envelope, request.signal);
    return jsonAnswer(answer.answer, envelope, 'local_qwen', answer);
  } catch {
    return json({
      code: 'PUBLIC_AGRO_MODEL_UNAVAILABLE',
      message: modelUnavailableCopy(locale),
    }, 503);
  }
}

function streamAgroAnswer(request: NextRequest, envelope: Envelope) {
  const encoder = new TextEncoder();
  const streamId = randomUUID();
  const config = readRuntimeConfig();

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
      writer.emit({ event: 'meta', mode: 'public', modelIdentity: config.enabled ? config.identity : null });

      void generateAgroAnswer(envelope, request.signal, config)
        .then((answer) => {
          for (const chunk of chunkAnswer(answer.answer)) {
            if (!writer.emit({ event: 'token', text: chunk })) return;
          }
          writer.emit({
            event: 'assessment',
            summary: JSON.stringify({
              source: 'local_qwen',
              answerMode: 'general_agro',
              currentDataRequired: requiresCurrentEvidence(envelope.question),
              modelIdentity: answer.modelIdentity,
              latencyMs: answer.latencyMs,
              truncated: answer.truncated,
              finishReason: answer.finishReason,
              safetyFlags: answer.safetyFlags,
              currentTurnBound: true,
              historyCarried: envelope.history.length > 0,
            }),
            operationalStatus: 'NOT_ATTESTED',
          });
          writer.complete();
        })
        .catch(() => {
          if (!request.signal.aborted) writer.fail('UPSTREAM_ERROR', modelUnavailableCopy(envelope.locale));
        })
        .finally(() => {
          request.signal.removeEventListener('abort', cancel);
          finish();
        });
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: streamHeaders(),
  });
}

function directTextStream(answer: string, locale: PublicLocale, source: 'policy') {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = new GatewayStreamWriter(
        (chunk) => controller.enqueue(encoder.encode(chunk)),
        'public',
        randomUUID(),
      );
      writer.emit({ event: 'meta', mode: 'public', modelIdentity: null });
      for (const chunk of chunkAnswer(answer)) writer.emit({ event: 'token', text: chunk });
      writer.emit({
        event: 'assessment',
        summary: JSON.stringify({ source, answerMode: 'general_agro', locale, currentTurnBound: true }),
        operationalStatus: 'NOT_ATTESTED',
      });
      writer.complete();
      controller.close();
    },
  });
  return new NextResponse(body, { status: 200, headers: streamHeaders() });
}

async function generateAgroAnswer(
  envelope: Envelope,
  signal: AbortSignal,
  suppliedConfig?: RuntimeConfig,
): Promise<ModelResponse> {
  const config = suppliedConfig ?? readRuntimeConfig();
  if (!config.enabled || !config.endpoint) throw new Error('agro_runtime_unavailable');

  const payload = {
    question: envelope.question,
    originalQuestion: envelope.question,
    locale: envelope.locale,
    answerMode: 'general_agro',
    currentDataRequired: requiresCurrentEvidence(envelope.question),
    history: envelope.history,
    grounding: {
      knowledgeVersion: 'tai-agro-chat.v1',
      topic: 'general_agro',
      title: 'Agricultural and agribusiness expert dialogue',
      answer: 'Answer the current agricultural or agribusiness question directly. Previous turns are context only and must never replace the current question.',
      facts: [],
      maturity: 'General expert information. Critical agronomic, veterinary, legal, financial and machinery decisions require verified local inputs and qualified specialist confirmation.',
      confidence: 'medium',
      sources: [],
    },
  };

  return callInternalModel(config, payload, signal);
}

async function callInternalModel(
  config: RuntimeConfig,
  payload: unknown,
  readerSignal: AbortSignal,
): Promise<ModelResponse> {
  if (!config.endpoint) throw new Error('restricted_runtime_endpoint_missing');
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const body = canonicalJson(payload);
  const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
  const signature = createHmac('sha256', config.secret)
    .update([SIGNATURE_VERSION, 'POST', INTERNAL_PATH, timestamp, bodyHash].join('\n'), 'utf8')
    .digest('hex');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const onReaderAbort = () => controller.abort();
  readerSignal.addEventListener('abort', onReaderAbort, { once: true });

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'X-TAI-Signature-Version': SIGNATURE_VERSION,
        'X-TAI-Timestamp': timestamp,
        'X-TAI-Signature': signature,
      },
      body,
      signal: controller.signal,
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_API_RESPONSE_BYTES) throw new Error('restricted_runtime_response_too_large');
    if (!response.ok) throw new Error(`restricted_runtime_http_${response.status}`);
    const decoded = JSON.parse(raw) as Partial<ModelResponse>;
    if (
      decoded.provider !== 'openai-compatible'
      || decoded.mode !== 'read_only'
      || decoded.operationalStatus !== 'NOT_ATTESTED'
      || decoded.answerMode !== 'general_agro'
      || typeof decoded.answer !== 'string'
      || !decoded.answer.trim()
      || typeof decoded.modelIdentity !== 'string'
      || decoded.modelIdentity.trim() !== config.identity
    ) throw new Error('restricted_runtime_contract_invalid');
    return decoded as ModelResponse;
  } finally {
    clearTimeout(timeout);
    readerSignal.removeEventListener('abort', onReaderAbort);
  }
}

function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const enabled = (environment.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED || '').trim() === 'true';
  const secret = (environment.TAI_PUBLIC_GATEWAY_HMAC_SECRET || '').trim();
  const identity = (environment.TAI_RESTRICTED_QWEN_MODEL_IDENTITY || '').trim();
  const rawBase = (environment.TAI_INTERNAL_API_BASE_URL || environment.NEXT_PUBLIC_API_URL || '').trim();
  const timeoutMs = boundedInteger(environment.TAI_PUBLIC_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 150_000);
  if (!enabled || secret.length < 32 || !identity || !rawBase) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }

  let base: URL;
  try {
    base = new URL(rawBase.endsWith('/') ? rawBase : `${rawBase}/`);
  } catch {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  const allowedHosts = (environment.TAI_INTERNAL_API_ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedHosts.includes(base.hostname.toLowerCase())) {
    return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  }
  return Object.freeze({
    enabled: true,
    endpoint: new URL('internal/tai/public-generate', base),
    secret,
    identity,
    timeoutMs,
  });
}

function jsonAnswer(
  answer: string,
  envelope: Envelope,
  source: 'local_qwen' | 'policy',
  model?: ModelResponse,
) {
  return json({
    requestId: randomUUID(),
    generatedAt: new Date().toISOString(),
    knowledgeVersion: 'tai-agro-chat.v1',
    dataMode: 'public_knowledge',
    mode: 'read_only',
    resolution: 'answered',
    topic: 'general_agro',
    title: envelope.locale === 'en'
      ? 'Agricultural expert answer'
      : envelope.locale === 'zh'
        ? '农业专家回答'
        : 'Ответ аграрного эксперта',
    answer,
    facts: [],
    maturity: 'General expert information; critical decisions require verified local inputs.',
    confidence: 'medium',
    actionAllowed: false,
    sources: [],
    suggestions: [],
    limitations: [],
    assessment: {
      source,
      currentTurnBound: true,
      historyCarried: envelope.history.length > 0,
      modelIdentity: model?.modelIdentity ?? null,
      latencyMs: model?.latencyMs ?? null,
    },
  });
}

function containsSensitiveInput(envelope: Envelope): boolean {
  const wire = [envelope.question, ...envelope.history.map((turn) => turn.text)].join('\n');
  return SENSITIVE_INPUT_PATTERNS.some((pattern) => pattern.test(wire));
}

function requiresCurrentEvidence(question: string): boolean {
  const normalized = question.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е');
  return CURRENT_EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function rebuildRequest(request: NextRequest, rawBody: string): NextRequest {
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return new NextRequest(request.url, {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

function streamHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform, max-age=0',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  };
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

function sensitiveInputCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'Do not send passwords, API keys, tokens, banking credentials or personal data in this public chat. Remove the sensitive value and ask again.';
  if (locale === 'zh') return '请勿在公共聊天中发送密码、API 密钥、令牌、银行凭据或个人数据。删除敏感内容后重新提问。';
  return 'Не отправляй в публичный чат пароли, API-ключи, токены, банковские реквизиты и персональные данные. Удали чувствительное значение и задай вопрос повторно.';
}

function modelUnavailableCopy(locale: PublicLocale): string {
  if (locale === 'en') return 'The agricultural AI did not complete the current answer. Retry the request.';
  if (locale === 'zh') return '农业人工智能未能完成当前回答。请重试该问题。';
  return 'ИИ для агробизнеса не завершил ответ на текущий вопрос. Повтори запрос.';
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non_finite_number');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (typeof value !== 'object') throw new Error('unsupported_signed_value');
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
