import { createHash, createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  GatewayStreamWriter,
  absoluteCitationUri,
  chunkAnswer,
} from '@pc/ai-assistant-stream-contract';
import {
  GET as knowledgeGet,
  POST as knowledgePost,
} from '../public-platform-assistant/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SIGNATURE_VERSION = 'tai-public-qwen.v1';
const INTERNAL_PATH = '/internal/tai/public-generate';
const MAX_API_RESPONSE_BYTES = 1_048_576;
const DEFAULT_TIMEOUT_MS = 130_000;
const OFFICIAL_EVIDENCE_HOSTS = new Set([
  'specagro.ru',
  'www.specagro.ru',
  'rosstat.gov.ru',
  'www.rosstat.gov.ru',
  'meteoinfo.ru',
  'www.meteoinfo.ru',
  'mpr.meteoinfo.ru',
  'pogoda.meteoinfo.ru',
  'publication.pravo.gov.ru',
  'www.cbr.ru',
  'cbr.ru',
  'mintrans.gov.ru',
  'www.mintrans.gov.ru',
  'eec.eaeunion.org',
  'rosselhoscenter.ru',
  'www.rosselhoscenter.ru',
]);

const PLATFORM_INTENT_PATTERNS = [
  /(?:прозрачн(?:ая|ой|ую|ые|ых)?\s+цен(?:а|ы|е|у|ой)?|платформ(?:а|ы|е|у|ой)|личн(?:ый|ого|ом)\s+кабинет|зарегистрир|служб(?:а|у|е)\s+поддержк|у\s+вас)/iu,
  /(?:transparent\s+price|your\s+platform|the\s+platform|this\s+platform|workspace|sign\s*up|register|support)/iu,
  /(?:透明价格|你们的平台|本平台|平台中|注册|客服)/u,
] as const;

const EVIDENCE_STATUSES = new Set(['not_requested', 'available', 'partial', 'unavailable']);

type PublicKnowledgeAnswer = Readonly<{
  requestId: string;
  generatedAt: string;
  knowledgeVersion: string;
  dataMode: 'public_knowledge';
  mode: 'read_only';
  resolution: 'answered' | 'refused' | 'clarification_required';
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

type OfficialEvidenceCitation = Readonly<{
  sourceId: string;
  title: string;
  owner: string;
  uri: string;
  geography: string;
  publishedAt: string;
  retrievedAt: string;
  observationPeriod: Readonly<{
    start: string | null;
    end: string;
    precision: 'publication_date';
  }>;
  topics: readonly string[];
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
  evidenceStatus: 'not_requested' | 'available' | 'partial' | 'unavailable';
  evidenceSources: readonly OfficialEvidenceCitation[];
}>;

type RuntimeConfig = Readonly<{
  enabled: boolean;
  endpoint: URL | null;
  secret: string;
  identity: string;
  timeoutMs: number;
}>;

export async function GET(request: NextRequest) {
  return knowledgeGet(request);
}

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get('stream') !== '1') {
    return knowledgePost(request);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return knowledgePost(request);
  }

  const rawBody = await request.text();
  const publicQuestion = readPublicQuestion(rawBody);
  const groundingRequest = rebuildRequestWithoutStream(request, rawBody);
  const groundingResponse = await knowledgePost(groundingRequest);
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

  return streamRestrictedAnswer(request, grounding, publicQuestion);
}

function streamRestrictedAnswer(request: NextRequest, grounding: PublicKnowledgeAnswer, publicQuestion: string) {
  const encoder = new TextEncoder();
  const streamId = crypto.randomUUID();
  const runtimeConfig = readRuntimeConfig();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const writer = new GatewayStreamWriter(
        (chunk) => {
          if (!closed) controller.enqueue(encoder.encode(chunk));
        },
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
        if (!runtimeConfig.enabled || !runtimeConfig.endpoint) {
          writer.fail('FEATURE_DISABLED', 'The restricted public model runtime is not enabled in this deployment.');
          return;
        }
        if (grounding.resolution === 'refused') {
          writer.fail('ABSTAINED_NO_DATA', grounding.answer || 'The requested private or write capability is unavailable in public mode.');
          return;
        }

        const locale = grounding.understanding?.detectedLocale === 'en'
          || grounding.understanding?.detectedLocale === 'zh'
          ? grounding.understanding.detectedLocale
          : 'ru';
        const answerMode = hasExplicitPlatformIntent(publicQuestion) ? 'verified_platform' : 'general_agro';
        const payload = {
          question: grounding.understanding?.normalizedQuestion || publicQuestion || grounding.title,
          locale,
          answerMode,
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
        const answer = await callInternalModel(runtimeConfig, payload, request.signal);
        const emittedUris = new Set<string>();
        if (answerMode === 'verified_platform') {
          const base = (process.env.NEXT_PUBLIC_SITE_URL || '').trim() || null;
          for (const source of grounding.sources) {
            const uri = absoluteCitationUri(source.href, base);
            if (!uri || emittedUris.has(uri)) continue;
            emittedUris.add(uri);
            if (!writer.emit({ event: 'citation', sourceId: source.href, title: source.label || source.href, uri })) return;
          }
        }
        for (const source of answer.evidenceSources) {
          if (emittedUris.has(source.uri)) continue;
          emittedUris.add(source.uri);
          const date = source.publishedAt.slice(0, 10);
          const title = `${source.title} · ${date} · ${source.geography}`;
          if (!writer.emit({ event: 'citation', sourceId: source.sourceId, title, uri: source.uri })) return;
        }
        for (const chunk of chunkAnswer(answer.answer)) {
          if (!writer.emit({ event: 'token', text: chunk })) return;
        }
        writer.emit({
          event: 'assessment',
          summary: `${answerMode === 'verified_platform' ? 'Verified public platform context' : 'General agriculture and agribusiness guidance'}; official evidence ${answer.evidenceStatus}; restricted local read-only runtime; ${answer.modelIdentity}; permanent admission remains NOT_ATTESTED.`,
          operationalStatus: 'NOT_ATTESTED',
        });
        writer.complete();
      };

      void run()
        .catch(() => {
          if (!request.signal.aborted) {
            writer.fail('UPSTREAM_ERROR', 'The restricted public model could not complete the answer.');
          }
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

async function callInternalModel(
  config: RuntimeConfig,
  payload: unknown,
  readerSignal: AbortSignal,
): Promise<ModelResponse> {
  if (!config.endpoint) throw new Error('restricted_runtime_endpoint_missing');
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const body = canonicalJson(payload);
  const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
  const signed = [SIGNATURE_VERSION, 'POST', INTERNAL_PATH, timestamp, bodyHash].join('\n');
  const signature = createHmac('sha256', config.secret).update(signed, 'utf8').digest('hex');
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
      || typeof decoded.answer !== 'string'
      || !decoded.answer.trim()
      || typeof decoded.modelIdentity !== 'string'
      || !decoded.modelIdentity.trim()
      || typeof decoded.evidenceStatus !== 'string'
      || !EVIDENCE_STATUSES.has(decoded.evidenceStatus)
      || !Array.isArray(decoded.evidenceSources)
    ) {
      throw new Error('restricted_runtime_contract_invalid');
    }
    const evidenceSources = Object.freeze(decoded.evidenceSources.slice(0, 6).map(normalizeOfficialEvidenceCitation));
    return Object.freeze({
      answer: decoded.answer,
      provider: 'openai-compatible',
      modelIdentity: decoded.modelIdentity,
      latencyMs: nonNegativeInteger(decoded.latencyMs),
      promptTokens: nullableNonNegativeInteger(decoded.promptTokens),
      completionTokens: nullableNonNegativeInteger(decoded.completionTokens),
      operationalStatus: 'NOT_ATTESTED',
      mode: 'read_only',
      evidenceStatus: decoded.evidenceStatus as ModelResponse['evidenceStatus'],
      evidenceSources,
    });
  } finally {
    clearTimeout(timeout);
    readerSignal.removeEventListener('abort', onReaderAbort);
  }
}

function normalizeOfficialEvidenceCitation(value: unknown): OfficialEvidenceCitation {
  const row = asRecord(value);
  if (!row) throw new Error('restricted_runtime_evidence_source_invalid');
  const sourceId = boundedText(row.sourceId, 160);
  const title = boundedText(row.title, 500);
  const owner = boundedText(row.owner, 500);
  const geography = boundedText(row.geography, 500);
  const publishedAt = boundedDateTime(row.publishedAt);
  const retrievedAt = boundedDateTime(row.retrievedAt);
  const topics = Array.isArray(row.topics)
    ? row.topics.slice(0, 20).map((topic) => boundedText(topic, 120)).filter(Boolean)
    : [];
  const periodRow = asRecord(row.observationPeriod);
  const end = boundedDate(periodRow?.end);
  if (!sourceId.startsWith('official.') || !title || !owner || !geography || topics.length === 0 || !periodRow) {
    throw new Error('restricted_runtime_evidence_source_invalid');
  }
  if (periodRow.precision !== 'publication_date' || (periodRow.start !== null && periodRow.start !== undefined)) {
    throw new Error('restricted_runtime_evidence_period_invalid');
  }
  let uri: URL;
  try {
    uri = new URL(boundedText(row.uri, 2_000));
  } catch {
    throw new Error('restricted_runtime_evidence_uri_invalid');
  }
  if (
    uri.protocol !== 'https:'
    || uri.username
    || uri.password
    || uri.hash
    || !OFFICIAL_EVIDENCE_HOSTS.has(uri.hostname.toLowerCase())
  ) {
    throw new Error('restricted_runtime_evidence_uri_forbidden');
  }
  return Object.freeze({
    sourceId,
    title,
    owner,
    uri: uri.toString(),
    geography,
    publishedAt,
    retrievedAt,
    observationPeriod: Object.freeze({ start: null, end, precision: 'publication_date' }),
    topics: Object.freeze(topics),
  });
}

function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const enabled = (environment.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED || '').trim() === 'true';
  const secret = (environment.TAI_PUBLIC_GATEWAY_HMAC_SECRET || '').trim();
  const identity = (environment.TAI_RESTRICTED_QWEN_MODEL_IDENTITY || '').trim();
  const rawBase = (environment.TAI_INTERNAL_API_BASE_URL || environment.NEXT_PUBLIC_API_URL || '').trim();
  const timeoutMs = boundedInteger(environment.TAI_PUBLIC_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 300_000);
  if (!enabled) return Object.freeze({ enabled: false, endpoint: null, secret: '', identity: '', timeoutMs });
  if (secret.length < 32 || !identity || !rawBase) {
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
  const endpoint = new URL('internal/tai/public-generate', base);
  return Object.freeze({ enabled: true, endpoint, secret, identity, timeoutMs });
}

function readPublicQuestion(rawBody: string): string {
  try {
    const decoded = JSON.parse(rawBody) as unknown;
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return '';
    const message = (decoded as Record<string, unknown>).message;
    return typeof message === 'string' ? message.trim().slice(0, 1_200) : '';
  } catch {
    return '';
  }
}

function hasExplicitPlatformIntent(question: string): boolean {
  if (/\bСделк/u.test(question)) return true;
  const normalized = question.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  return PLATFORM_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function rebuildRequestWithoutStream(request: NextRequest, rawBody: string): NextRequest {
  const url = new URL(request.url);
  url.searchParams.delete('stream');
  return new NextRequest(url, {
    method: 'POST',
    headers: new Headers(request.headers),
    body: rawBody,
  });
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown, limit: number): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, limit)
    : '';
}

function boundedDateTime(value: unknown): string {
  const text = boundedText(value, 80);
  if (!text || !Number.isFinite(Date.parse(text))) throw new Error('restricted_runtime_evidence_datetime_invalid');
  return new Date(text).toISOString();
}

function boundedDate(value: unknown): string {
  const text = boundedText(value, 10);
  if (!/^20\d{2}-\d{2}-\d{2}$/u.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00.000Z`))) {
    throw new Error('restricted_runtime_evidence_date_invalid');
  }
  return text;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('restricted_runtime_integer_invalid');
  }
  return value;
}

function nullableNonNegativeInteger(value: unknown): number | null {
  return value === null ? null : nonNegativeInteger(value);
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
