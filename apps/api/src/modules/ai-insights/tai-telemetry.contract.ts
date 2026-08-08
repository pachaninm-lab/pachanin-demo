/**
 * Telemetry contract for the TAI assistant chain.
 *
 * One request crosses four boundaries — browser, Next.js BFF, NestJS API, model
 * adapter — and a latency number is only actionable if all four agree on which
 * request it belongs to. That is what `traceId` is for, and why it is minted at
 * the outermost boundary rather than at each hop.
 *
 * The second purpose is negative: this module defines what may *not* be
 * measured. A latency record is a closed shape of numbers and bounded
 * identifiers. There is deliberately no field that can hold a prompt, an answer,
 * a document fragment, a tenant identifier or a credential — not "a field we
 * remember not to fill", but no field at all. Free text cannot be logged by
 * accident because the contract cannot describe it, and `assertEmittable`
 * refuses anything that tries.
 *
 * Dependency-free on purpose: the BFF and the API both validate against exactly
 * this file, so the two contours cannot drift into two similar-but-different
 * notions of what a safe telemetry event is.
 */

/** Header carrying the correlation id across the chain. */
export const TAI_TRACE_HEADER = 'x-tai-trace-id';

/** 128-bit lowercase hex, W3C-trace-id shaped. */
export const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/u;

/** A trace id of all zeroes is the W3C "invalid" value and is never accepted. */
const NULL_TRACE_ID = '0'.repeat(32);

/**
 * Phases of a single assistant request.
 *
 * `modelTtft` is time to the first token the provider emitted.
 * `firstUsefulText` is time to the first token that survived safety filtering
 * and reached the client. They are separate because the gap between them is the
 * cost of the safety buffer, and collapsing them would hide it.
 */
export const TAI_LATENCY_PHASES = [
  'queueWait',
  'routing',
  'grounding',
  'promptAssembly',
  'prefill',
  'modelTtft',
  'firstUsefulText',
  'generation',
  'postProcessing',
  'total',
] as const;

export type TaiLatencyPhase = (typeof TAI_LATENCY_PHASES)[number];

/** Token counters. Counts only — never the tokens themselves. */
export const TAI_TOKEN_COUNTERS = ['promptTokens', 'completionTokens', 'contextTokens'] as const;

export type TaiTokenCounter = (typeof TAI_TOKEN_COUNTERS)[number];

/** Which deadline fired, if any. */
export const TAI_TIMEOUT_CLASSES = ['none', 'provider', 'gateway', 'client'] as const;

export type TaiTimeoutClass = (typeof TAI_TIMEOUT_CLASSES)[number];

/**
 * Why a request ended badly. Deliberately coarse: a finer taxonomy tempts
 * callers to smuggle provider error text into the label.
 */
export const TAI_ERROR_CLASSES = [
  'none',
  'provider_http',
  'provider_transport',
  'provider_contract',
  'validation',
  'safety_refusal',
  'cancelled',
  'internal',
] as const;

export type TaiErrorClass = (typeof TAI_ERROR_CLASSES)[number];

export const TAI_CONTOURS = ['public', 'private'] as const;

export type TaiContour = (typeof TAI_CONTOURS)[number];

export const TAI_LOCALES = ['ru', 'en', 'zh'] as const;

export type TaiLocale = (typeof TAI_LOCALES)[number];

export const TAI_ANSWER_MODES = ['verified_platform', 'general_agro'] as const;

export type TaiAnswerMode = (typeof TAI_ANSWER_MODES)[number];

/** Bounded identifiers: short, no whitespace, no separators that hide payloads. */
const BOUNDED_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/u;

/**
 * A completed request's telemetry. Every field is a number, a boolean, or a
 * value drawn from a closed set. Nothing here can carry user or tenant content.
 */
export interface TaiLatencyRecord {
  readonly schemaVersion: 'tai.latency.v1';
  readonly traceId: string;
  readonly contour: TaiContour;
  readonly locale: TaiLocale;
  readonly answerMode: TaiAnswerMode;
  /** Admitted model identity, or null when nothing was admitted. */
  readonly modelIdentity: string | null;
  /** Knowledge/index generation the grounding came from, or null. */
  readonly retrievalVersion: string | null;
  readonly streaming: boolean;
  readonly cancelled: boolean;
  readonly fallbackUsed: boolean;
  readonly timeoutClass: TaiTimeoutClass;
  readonly errorClass: TaiErrorClass;
  readonly phases: Readonly<Record<TaiLatencyPhase, number | null>>;
  readonly tokens: Readonly<Record<TaiTokenCounter, number | null>>;
  /** contextTokens / promptTokens, rounded to 4 dp; null when not computable. */
  readonly compressionRatio: number | null;
  readonly historyTurnsSupplied: number;
  readonly historyTurnsCarried: number;
}

/**
 * Keys that must never appear anywhere in a telemetry payload. Checked as data
 * rather than as types, because the realistic failure is a hand-built object
 * spread from a request, which no compile-time type constrains at runtime.
 */
export const FORBIDDEN_TELEMETRY_KEYS = [
  'prompt', 'prompts', 'question', 'originalQuestion', 'answer', 'text', 'content',
  'message', 'messages', 'history', 'grounding', 'facts', 'sources', 'document',
  'documents', 'chunk', 'excerpt', 'body',
  'tenantId', 'tenantIds', 'subjectId', 'roleId', 'dealId', 'organizationId',
  'membershipId', 'userId', 'email', 'phone',
  'apiKey', 'authorization', 'secret', 'token', 'password', 'credential',
  'cookie', 'session', 'signature', 'hmac',
] as const;

const FORBIDDEN_KEY_SET: ReadonlySet<string> = new Set(
  FORBIDDEN_TELEMETRY_KEYS.map((key) => key.toLowerCase()),
);

/**
 * Structural measurement keys, which are allowed to exist but only ever as
 * numbers.
 *
 * `grounding` is both the name of a phase and the name of the content that
 * phase retrieves, so a blanket key ban would forbid measuring it while a
 * blanket exemption would let the retrieved text through under the same name.
 * The resolution is the value type: a structural key holding a number is a
 * duration, and a structural key holding anything else is content wearing a
 * metric's name, which is refused.
 */
const STRUCTURAL_NUMERIC_KEYS: ReadonlySet<string> = new Set<string>([
  ...TAI_LATENCY_PHASES,
  ...TAI_TOKEN_COUNTERS,
]);

/**
 * Secret-like literals. Mirrors the answer-path detector so a credential cannot
 * reach a log line by a route the answer path already refuses.
 */
const SECRET_LITERAL_PATTERN =
  /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b|\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b[A-Fa-f0-9]{64}\b)/u;

/**
 * Longest string any telemetry value may hold. Well above every bounded
 * identifier and far below anything that could carry a sentence of user text.
 */
export const MAX_TELEMETRY_STRING_CHARS = 128;

export type TelemetryRejection = Readonly<{ ok: false; reason: string }>;
export type TelemetryAcceptance = Readonly<{ ok: true; record: TaiLatencyRecord }>;
export type TelemetryVerdict = TelemetryAcceptance | TelemetryRejection;

export function isTelemetryRejection(verdict: TelemetryVerdict): verdict is TelemetryRejection {
  return verdict.ok === false;
}

/** Mint a fresh correlation id. */
export function createTraceId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Accept an inbound trace id only if it is well formed.
 *
 * A client-supplied id is a convenience for correlation, never an authority: it
 * names nothing and grants nothing. It is still validated, because an
 * unvalidated header is a free-text field with extra steps — exactly the thing
 * this contract exists to prevent.
 */
export function normalizeTraceId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  if (!TRACE_ID_PATTERN.test(candidate)) return null;
  if (candidate === NULL_TRACE_ID) return null;
  return candidate;
}

/** Inbound trace id if usable, otherwise a fresh one. */
export function resolveTraceId(value: unknown): string {
  return normalizeTraceId(value) ?? createTraceId();
}

/**
 * Refuse any structure carrying a forbidden key, a secret-like literal or free
 * text. Applied to the record before it is encoded, so an emitter cannot log
 * something the contract did not intend even if it built the object by spread.
 */
export function assertEmittable(value: unknown, path: readonly string[] = [], depth = 0): void {
  if (depth > 8) throw new Error('tai_telemetry_too_deep');
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertEmittable(item, [...path, String(index)], depth + 1));
    return;
  }

  if (typeof value === 'string') {
    if (value.length > MAX_TELEMETRY_STRING_CHARS) {
      throw new Error(`tai_telemetry_string_too_long:${path.join('.') || 'root'}`);
    }
    if (SECRET_LITERAL_PATTERN.test(value)) {
      throw new Error(`tai_telemetry_secret_like:${path.join('.') || 'root'}`);
    }
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return;

  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (STRUCTURAL_NUMERIC_KEYS.has(key)) {
        if (nested !== null && nested !== undefined && typeof nested !== 'number') {
          throw new Error(`tai_telemetry_structural_key_not_numeric:${[...path, key].join('.')}`);
        }
        continue;
      }
      if (FORBIDDEN_KEY_SET.has(key.toLowerCase())) {
        throw new Error(`tai_telemetry_forbidden_key:${[...path, key].join('.')}`);
      }
      assertEmittable(nested, [...path, key], depth + 1);
    }
    return;
  }

  throw new Error(`tai_telemetry_unsupported_type:${path.join('.') || 'root'}`);
}

function finiteNonNegativeOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function boundedIdentifierOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!BOUNDED_IDENTIFIER_PATTERN.test(candidate)) return null;
  return candidate;
}

/**
 * Validate a candidate record. Returns a rejection rather than throwing so a
 * telemetry problem can never take down the request it is describing.
 */
export function validateLatencyRecord(value: unknown): TelemetryVerdict {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, reason: 'record_not_an_object' };
  }
  const row = value as Record<string, unknown>;

  if (row.schemaVersion !== 'tai.latency.v1') return { ok: false, reason: 'schema_version_invalid' };

  const traceId = normalizeTraceId(row.traceId);
  if (!traceId) return { ok: false, reason: 'trace_id_invalid' };

  if (!TAI_CONTOURS.includes(row.contour as TaiContour)) return { ok: false, reason: 'contour_invalid' };
  if (!TAI_LOCALES.includes(row.locale as TaiLocale)) return { ok: false, reason: 'locale_invalid' };
  if (!TAI_ANSWER_MODES.includes(row.answerMode as TaiAnswerMode)) return { ok: false, reason: 'answer_mode_invalid' };
  if (!TAI_TIMEOUT_CLASSES.includes(row.timeoutClass as TaiTimeoutClass)) return { ok: false, reason: 'timeout_class_invalid' };
  if (!TAI_ERROR_CLASSES.includes(row.errorClass as TaiErrorClass)) return { ok: false, reason: 'error_class_invalid' };

  for (const flag of ['streaming', 'cancelled', 'fallbackUsed'] as const) {
    if (typeof row[flag] !== 'boolean') return { ok: false, reason: `${flag}_invalid` };
  }

  const modelIdentity = row.modelIdentity === null || row.modelIdentity === undefined
    ? null
    : boundedIdentifierOrNull(row.modelIdentity);
  if (row.modelIdentity !== null && row.modelIdentity !== undefined && modelIdentity === null) {
    return { ok: false, reason: 'model_identity_invalid' };
  }

  const retrievalVersion = row.retrievalVersion === null || row.retrievalVersion === undefined
    ? null
    : boundedIdentifierOrNull(row.retrievalVersion);
  if (row.retrievalVersion !== null && row.retrievalVersion !== undefined && retrievalVersion === null) {
    return { ok: false, reason: 'retrieval_version_invalid' };
  }

  const phasesRow = (typeof row.phases === 'object' && row.phases !== null ? row.phases : {}) as Record<string, unknown>;
  const phases = {} as Record<TaiLatencyPhase, number | null>;
  for (const phase of TAI_LATENCY_PHASES) phases[phase] = finiteNonNegativeOrNull(phasesRow[phase]);

  const tokensRow = (typeof row.tokens === 'object' && row.tokens !== null ? row.tokens : {}) as Record<string, unknown>;
  const tokens = {} as Record<TaiTokenCounter, number | null>;
  for (const counter of TAI_TOKEN_COUNTERS) tokens[counter] = finiteNonNegativeOrNull(tokensRow[counter]);

  // A first-useful-text that precedes the provider's first token would mean text
  // reached the client before the model produced any, which is either a broken
  // clock or a fabricated answer. Refuse rather than publish it.
  if (phases.modelTtft !== null && phases.firstUsefulText !== null && phases.firstUsefulText < phases.modelTtft) {
    return { ok: false, reason: 'first_useful_text_precedes_model_ttft' };
  }

  const record: TaiLatencyRecord = {
    schemaVersion: 'tai.latency.v1',
    traceId,
    contour: row.contour as TaiContour,
    locale: row.locale as TaiLocale,
    answerMode: row.answerMode as TaiAnswerMode,
    modelIdentity,
    retrievalVersion,
    streaming: row.streaming as boolean,
    cancelled: row.cancelled as boolean,
    fallbackUsed: row.fallbackUsed as boolean,
    timeoutClass: row.timeoutClass as TaiTimeoutClass,
    errorClass: row.errorClass as TaiErrorClass,
    phases: Object.freeze(phases),
    tokens: Object.freeze(tokens),
    compressionRatio: finiteNonNegativeOrNull(row.compressionRatio),
    historyTurnsSupplied: finiteNonNegativeOrNull(row.historyTurnsSupplied) ?? 0,
    historyTurnsCarried: finiteNonNegativeOrNull(row.historyTurnsCarried) ?? 0,
  };

  try {
    assertEmittable(record);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'not_emittable' };
  }

  return { ok: true, record: Object.freeze(record) };
}

/**
 * Encode a validated record as one structured log line.
 *
 * Single-line JSON by construction: `JSON.stringify` cannot emit a raw newline,
 * so a record can never split into two log entries or forge a second one.
 */
export function encodeTelemetryLog(record: TaiLatencyRecord): string {
  assertEmittable(record);
  return JSON.stringify(record);
}

/**
 * Monotonic stopwatch for one request.
 *
 * Uses `performance.now()` so a wall-clock adjustment mid-request cannot produce
 * a negative duration. Phases are recorded once; a second mark for the same
 * phase is ignored rather than overwriting, because the first occurrence is what
 * "time to first X" means.
 */
export interface TaiLatencyRecorder {
  readonly traceId: string;
  /** Record the elapsed time to this phase, if not already recorded. */
  mark(phase: TaiLatencyPhase): void;
  /** Record an explicit duration for a phase, overriding elapsed-time marking. */
  set(phase: TaiLatencyPhase, milliseconds: number): void;
  /** Elapsed milliseconds since the recorder started. */
  elapsed(): number;
  finish(outcome: TaiRecorderOutcome): TelemetryVerdict;
}

export interface TaiRecorderOutcome {
  readonly contour: TaiContour;
  readonly locale: TaiLocale;
  readonly answerMode: TaiAnswerMode;
  readonly modelIdentity?: string | null;
  readonly retrievalVersion?: string | null;
  readonly streaming: boolean;
  readonly cancelled?: boolean;
  readonly fallbackUsed?: boolean;
  readonly timeoutClass?: TaiTimeoutClass;
  readonly errorClass?: TaiErrorClass;
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly contextTokens?: number | null;
  readonly historyTurnsSupplied?: number;
  readonly historyTurnsCarried?: number;
}

export function createLatencyRecorder(
  traceId: string,
  now: () => number = () => performance.now(),
): TaiLatencyRecorder {
  const startedAt = now();
  const phases = new Map<TaiLatencyPhase, number>();

  return {
    traceId,
    mark(phase) {
      if (phases.has(phase)) return;
      phases.set(phase, Math.max(0, now() - startedAt));
    },
    set(phase, milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
      phases.set(phase, milliseconds);
    },
    elapsed() {
      return Math.max(0, now() - startedAt);
    },
    finish(outcome) {
      if (!phases.has('total')) phases.set('total', Math.max(0, now() - startedAt));

      const phaseRecord = {} as Record<TaiLatencyPhase, number | null>;
      for (const phase of TAI_LATENCY_PHASES) phaseRecord[phase] = phases.get(phase) ?? null;

      const promptTokens = outcome.promptTokens ?? null;
      const contextTokens = outcome.contextTokens ?? null;
      const compressionRatio = promptTokens !== null && contextTokens !== null && promptTokens > 0
        ? Math.round((contextTokens / promptTokens) * 10_000) / 10_000
        : null;

      return validateLatencyRecord({
        schemaVersion: 'tai.latency.v1',
        traceId,
        contour: outcome.contour,
        locale: outcome.locale,
        answerMode: outcome.answerMode,
        modelIdentity: outcome.modelIdentity ?? null,
        retrievalVersion: outcome.retrievalVersion ?? null,
        streaming: outcome.streaming,
        cancelled: outcome.cancelled ?? false,
        fallbackUsed: outcome.fallbackUsed ?? false,
        timeoutClass: outcome.timeoutClass ?? 'none',
        errorClass: outcome.errorClass ?? 'none',
        phases: phaseRecord,
        tokens: {
          promptTokens,
          completionTokens: outcome.completionTokens ?? null,
          contextTokens,
        },
        compressionRatio,
        historyTurnsSupplied: outcome.historyTurnsSupplied ?? 0,
        historyTurnsCarried: outcome.historyTurnsCarried ?? 0,
      });
    },
  };
}
