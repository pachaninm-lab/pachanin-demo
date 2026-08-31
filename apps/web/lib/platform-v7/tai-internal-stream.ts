/**
 * The boundary's side of the internal TAI stream.
 *
 * The public routes used to ask the API for a finished answer and then hand it
 * to the browser in slices. That looked like streaming and was not: the reader
 * waited for the last token before seeing the first word, and the slicing only
 * hid the wait. This module replaces that with a relay — frames are forwarded as
 * the API produces them, and nothing here ever holds a whole answer.
 *
 * It validates every frame with the same `validateFrame` the API emitted it
 * through. A boundary that trusts its upstream is a boundary that forwards
 * whatever the upstream was tricked into saying.
 */
import { createHash, createHmac } from 'node:crypto';
import {
  isRejection,
  validateFrame,
  type GatewayRefusal,
} from '@pc/ai-assistant-stream-contract';

export const SIGNATURE_VERSION = 'tai-public-qwen.v1';
export const INTERNAL_STREAM_PATH = '/internal/tai/public-generate-stream';

/**
 * The address this relay talks to, derived from the path it signs.
 *
 * These two were allowed to drift apart once and it cost a production outage
 * that looked like a model failure: the routes kept building a URL for the
 * buffered `public-generate` endpoint while the signer had already moved to
 * `public-generate-stream`. The request then arrived at the buffered controller
 * carrying a signature over a different canonical path, verification failed in
 * milliseconds, and the relay reported a generic `UPSTREAM_ERROR` — the same
 * shape a dead model produces. Deriving the URL from the signed constant makes
 * that class of mismatch unrepresentable.
 *
 * The leading slash is stripped deliberately. The production base carries a path
 * prefix (`http://api:3001/api/`), and an absolute-path argument to `new URL`
 * would discard it and address `/internal/...` on the origin instead.
 */
export function resolveInternalStreamEndpoint(base: URL): URL {
  return new URL(INTERNAL_STREAM_PATH.replace(/^\/+/u, ''), base);
}

/** Largest unfinished SSE record the relay will hold before refusing. */
const MAX_PENDING_RECORD_CHARS = 64 * 1024;
/** Ceiling on one relayed answer. Bounded so a runaway upstream cannot exhaust us. */
const MAX_STREAM_BYTES = 1_048_576;

const DETAILED_RESPONSE_PATTERNS = [
  /(?:подробн|детальн|разв[её]рнут|пошагов)/iu,
  /(?:in\s+detail|detailed|comprehensive|step[-\s]?by[-\s]?step)/iu,
  /(?:详细|详尽|全面|一步一步)/u,
] as const;

export interface InternalStreamConfig {
  readonly endpoint: URL;
  readonly secret: string;
  readonly identity: string;
  readonly timeoutMs: number;
}

export type InternalStreamEvent =
  | Readonly<{ kind: 'meta'; modelIdentity: string | null }>
  | Readonly<{ kind: 'token'; text: string }>
  | Readonly<{ kind: 'assessment'; summary: string }>
  | Readonly<{ kind: 'terminal'; complete: boolean; refusal: GatewayRefusal | null }>;

/** Sign one internal request body for the streaming path. */
export function signInternalStreamRequest(
  secret: string,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): Readonly<{ timestamp: string; signature: string }> {
  const timestamp = String(nowSeconds);
  const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
  const signature = createHmac('sha256', secret)
    .update([SIGNATURE_VERSION, 'POST', INTERNAL_STREAM_PATH, timestamp, bodyHash].join('\n'), 'utf8')
    .digest('hex');
  return Object.freeze({ timestamp, signature });
}

/**
 * Add a typed, signed completion profile to model-backed general-agro requests.
 *
 * This does not mutate the user's question, originalQuestion or ConversationState.
 * The API is the authority that converts the profile into hard provider token
 * ceilings. Verified-platform payloads are returned byte-for-byte unchanged.
 */
export function applyGeneralAgroResponseBudget(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return payload;
  const row = payload as Record<string, unknown>;
  if (row.answerMode !== 'general_agro') return payload;
  const question = typeof row.originalQuestion === 'string'
    ? row.originalQuestion.trim()
    : typeof row.question === 'string'
      ? row.question.trim()
      : '';
  if (!question) return payload;
  const profile = DETAILED_RESPONSE_PATTERNS.some((pattern) => pattern.test(question))
    ? 'detailed'
    : 'concise';
  return Object.freeze({
    ...row,
    responseBudget: Object.freeze({ profile }),
  });
}

/**
 * Relay one internal answer.
 *
 * Cancellation is wired in both directions: the reader's signal aborts the
 * upstream request, and leaving the generator early cancels the body reader, so
 * a browser that navigates away stops a model that is still generating rather
 * than merely stopping being listened to.
 */
export async function* streamInternalModel(
  config: InternalStreamConfig,
  payload: unknown,
  readerSignal: AbortSignal,
): AsyncGenerator<InternalStreamEvent, void, undefined> {
  const body = canonicalJson(applyGeneralAgroResponseBudget(payload));
  const signed = signInternalStreamRequest(config.secret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const onReaderAbort = () => controller.abort();
  if (readerSignal.aborted) controller.abort();
  readerSignal.addEventListener('abort', onReaderAbort, { once: true });

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json; charset=utf-8',
        'X-TAI-Signature-Version': SIGNATURE_VERSION,
        'X-TAI-Timestamp': signed.timestamp,
        'X-TAI-Signature': signed.signature,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`restricted_runtime_http_${response.status}`);
    if (!response.body) throw new Error('restricted_runtime_missing_stream');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let bytes = 0;
    let identityChecked = false;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        bytes += value.byteLength;
        if (bytes > MAX_STREAM_BYTES) throw new Error('restricted_runtime_stream_too_large');

        // Kept in streaming mode deliberately: an HTTP chunk boundary lands
        // wherever the network puts it, routinely mid-character in Russian or
        // Chinese output, and a per-chunk decode would corrupt those answers.
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        if (buffer.length > MAX_PENDING_RECORD_CHARS) throw new Error('restricted_runtime_record_too_large');

        for (const record of parts) {
          const payloadLine = record.split('\n').find((line) => line.startsWith('data:'));
          if (!payloadLine) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(payloadLine.slice('data:'.length).trim());
          } catch {
            throw new Error('restricted_runtime_frame_invalid');
          }

          const verdict = validateFrame(parsed, 'public');
          if (isRejection(verdict)) throw new Error('restricted_runtime_frame_rejected');
          const frame = verdict.frame;

          if (frame.event === 'meta') {
            // The admitted model is asserted once, at the top of the stream. A
            // stream from an identity this deployment did not admit is refused
            // rather than relayed under the admitted one's name.
            if (frame.modelIdentity !== null && frame.modelIdentity !== config.identity) {
              throw new Error('restricted_runtime_identity_mismatch');
            }
            identityChecked = true;
            yield { kind: 'meta', modelIdentity: frame.modelIdentity };
            continue;
          }
          if (frame.event === 'token') {
            if (!identityChecked) throw new Error('restricted_runtime_token_before_meta');
            yield { kind: 'token', text: frame.text };
            continue;
          }
          if (frame.event === 'assessment') {
            yield { kind: 'assessment', summary: frame.summary };
            continue;
          }
          if (frame.event === 'error') {
            yield { kind: 'terminal', complete: false, refusal: frame.refusal };
            return;
          }
          if (frame.event === 'done') {
            yield { kind: 'terminal', complete: frame.complete, refusal: null };
            return;
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    // A body that ended without a terminal frame did not finish an answer.
    yield { kind: 'terminal', complete: false, refusal: 'UPSTREAM_ERROR' };
  } finally {
    clearTimeout(timeout);
    readerSignal.removeEventListener('abort', onReaderAbort);
    controller.abort();
  }
}

/** Stable key order, so the signature covers exactly the bytes that are sent. */
export function canonicalJson(value: unknown): string {
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
