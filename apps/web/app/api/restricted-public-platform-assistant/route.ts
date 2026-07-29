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

type ModelResponse = Readonly<{
  answer: string;
  provider: 'openai-compatible';
  modelIdentity: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  operationalStatus: 'NOT_ATTESTED';
  mode: 'read_only';
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

  const rawBody = await request.text();
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

  return streamRestrictedAnswer(request, grounding);
}

function streamRestrictedAnswer(request: NextRequest, grounding: PublicKnowledgeAnswer) {
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

      // The restricted contour is intentionally not represented as permanent
      // admission. The exact identity is audited server-side; null prevents the
      // existing UI from labelling it as an admitted AP-13D model.
      writer.emit({ event: 'meta', mode: 'public', modelIdentity: null });

      const run = async () => {
        if (!runtimeConfig.enabled || !runtimeConfig.endpoint) {
          writer.fail('FEATURE_DISABLED', 'The restricted public model runtime is not enabled in this deployment.');
          return;
        }
        if (grounding.resolution !== 'answered') {
          writer.fail('ABSTAINED_NO_DATA', grounding.answer || 'Verified public grounding is insufficient.');
          return;
        }

        const locale = grounding.understanding?.detectedLocale === 'en'
          || grounding.understanding?.detectedLocale === 'zh'
          ? grounding.understanding.detectedLocale
          : 'ru';
        const payload = {
          question: grounding.understanding?.normalizedQuestion || grounding.title,
          locale,
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
        const base = (process.env.NEXT_PUBLIC_SITE_URL || '').trim() || null;
        for (const source of grounding.sources) {
          const uri = absoluteCitationUri(source.href, base);
          if (!uri) continue;
          if (!writer.emit({ event: 'citation', sourceId: source.href, title: source.label || source.href, uri })) return;
        }
        for (const chunk of chunkAnswer(answer.answer)) {
          if (!writer.emit({ event: 'token', text: chunk })) return;
        }
        writer.emit({
          event: 'assessment',
          summary: `Restricted local read-only runtime; ${answer.modelIdentity}; permanent admission remains NOT_ATTESTED.`,
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
    ) {
      throw new Error('restricted_runtime_contract_invalid');
    }
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

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
