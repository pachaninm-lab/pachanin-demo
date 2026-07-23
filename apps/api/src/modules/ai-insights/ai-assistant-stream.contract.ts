import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  AssistantChatResponse,
  AssistantCitation,
  AssistantDecision,
} from './ai-assistant.service';

export const ASSISTANT_STREAM_SCHEMA = 'tai.ai-assistant.stream.v1' as const;
export const RUNTIME_READINESS_SCHEMA = 'tai.read-only-runtime-readiness.v1' as const;

const DEFAULT_READINESS_TIMEOUT_MS = 3_000;
const DEFAULT_MAX_READINESS_AGE_SECONDS = 30;
const SAFE_HEX_64 = /^[a-f0-9]{64}$/u;
const LOCAL_RUNTIME_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export type ReadOnlyRuntimeReadiness = Readonly<{
  schema: typeof RUNTIME_READINESS_SCHEMA;
  status: 'READY';
  mode: 'read_only';
  actionAllowed: false;
  checkedAt: string;
  expiresAt: string;
  model: Readonly<{
    id: string;
    artifactSha256: string;
  }>;
  runtime: Readonly<{
    id: string;
    imageDigest: string;
  }>;
  admission: Readonly<{
    status: 'READ_ONLY_ADMITTED';
    evidenceSha256: string;
  }>;
}>;

export type AssistantStreamEvent =
  | Readonly<{
    schema: typeof ASSISTANT_STREAM_SCHEMA;
    type: 'meta';
    sequence: number;
    requestId: string;
    correlationId: string;
    generatedAt: string;
    mode: 'read_only';
    actionAllowed: false;
    provider: AssistantChatResponse['provider'];
    runtime: ReadOnlyRuntimeReadiness | null;
  }>
  | Readonly<{
    schema: typeof ASSISTANT_STREAM_SCHEMA;
    type: 'token';
    sequence: number;
    requestId: string;
    correlationId: string;
    delta: string;
  }>
  | Readonly<{
    schema: typeof ASSISTANT_STREAM_SCHEMA;
    type: 'citations';
    sequence: number;
    requestId: string;
    correlationId: string;
    citations: readonly AssistantCitation[];
  }>
  | Readonly<{
    schema: typeof ASSISTANT_STREAM_SCHEMA;
    type: 'decision';
    sequence: number;
    requestId: string;
    correlationId: string;
    decision: AssistantDecision;
  }>
  | Readonly<{
    schema: typeof ASSISTANT_STREAM_SCHEMA;
    type: 'done';
    sequence: number;
    requestId: string;
    correlationId: string;
    response: AssistantChatResponse;
  }>
  | Readonly<{
    schema: typeof ASSISTANT_STREAM_SCHEMA;
    type: 'error';
    sequence: number;
    requestId: string;
    correlationId: string;
    code: string;
    retryable: boolean;
  }>;

export function admittedRuntimeRequired(): boolean {
  return (process.env.AI_ASSISTANT_RUNTIME_MODE || '').trim().toLowerCase() === 'admitted-read-only';
}

export async function resolveAdmittedRuntimeReadiness(): Promise<ReadOnlyRuntimeReadiness | null> {
  if (!admittedRuntimeRequired()) return null;

  const rawUrl = requiredEnv('AI_ASSISTANT_READINESS_URL');
  const url = validateReadinessUrl(rawUrl);
  const timeoutMs = boundedInteger(process.env.AI_ASSISTANT_READINESS_TIMEOUT_MS, DEFAULT_READINESS_TIMEOUT_MS, 500, 10_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = process.env.AI_ASSISTANT_READINESS_TOKEN?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `readiness_http_${response.status}`);
    }

    const raw = await response.json() as unknown;
    return validateReadinessPayload(raw);
  } catch (error) {
    if (error instanceof ServiceUnavailableException) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', reason === 'This operation was aborted' ? 'readiness_timeout' : reason);
  } finally {
    clearTimeout(timeout);
  }
}

export function assertAssistantResponseContract(
  response: AssistantChatResponse,
  readiness: ReadOnlyRuntimeReadiness | null,
): AssistantChatResponse {
  if (response.mode !== 'read_only' || response.dataMode !== 'authoritative') {
    throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'mode_or_data_mode_mismatch');
  }
  if (!response.requestId || !response.generatedAt || !response.answer.trim()) {
    throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'required_response_fields_missing');
  }
  if (!response.decision || response.decision.actionAllowed !== false || response.decision.actionKind !== 'NONE') {
    throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'write_capability_detected');
  }
  if (!Array.isArray(response.citations) || response.citations.length === 0) {
    throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'grounded_citations_missing');
  }
  for (const citation of response.citations) validateCitation(citation);
  validateFreshness(response.generatedAt, response.decision.dataFreshnessAt);

  if (readiness) {
    if (response.provider !== 'openai-compatible') {
      throw unavailable('AI_ASSISTANT_RUNTIME_FALLBACK_FORBIDDEN', 'production_runtime_response_not_used');
    }
    if (!admittedRuntimeRequired()) {
      throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'unexpected_runtime_readiness');
    }
  }

  return response;
}

export function buildAssistantStreamEvents(
  response: AssistantChatResponse,
  readiness: ReadOnlyRuntimeReadiness | null,
): readonly AssistantStreamEvent[] {
  const safe = assertAssistantResponseContract(response, readiness);
  const correlationId = createHash('sha256')
    .update(`${safe.requestId}:${safe.generatedAt}:${safe.role}:${safe.dealId ?? 'public'}`)
    .digest('hex')
    .slice(0, 32);
  const events: AssistantStreamEvent[] = [];
  let sequence = 1;

  events.push(Object.freeze({
    schema: ASSISTANT_STREAM_SCHEMA,
    type: 'meta',
    sequence: sequence++,
    requestId: safe.requestId,
    correlationId,
    generatedAt: safe.generatedAt,
    mode: 'read_only',
    actionAllowed: false,
    provider: safe.provider,
    runtime: readiness,
  }));

  for (const delta of chunkAnswer(safe.answer)) {
    events.push(Object.freeze({
      schema: ASSISTANT_STREAM_SCHEMA,
      type: 'token',
      sequence: sequence++,
      requestId: safe.requestId,
      correlationId,
      delta,
    }));
  }

  events.push(Object.freeze({
    schema: ASSISTANT_STREAM_SCHEMA,
    type: 'citations',
    sequence: sequence++,
    requestId: safe.requestId,
    correlationId,
    citations: safe.citations,
  }));
  events.push(Object.freeze({
    schema: ASSISTANT_STREAM_SCHEMA,
    type: 'decision',
    sequence: sequence++,
    requestId: safe.requestId,
    correlationId,
    decision: safe.decision,
  }));
  events.push(Object.freeze({
    schema: ASSISTANT_STREAM_SCHEMA,
    type: 'done',
    sequence,
    requestId: safe.requestId,
    correlationId,
    response: safe,
  }));

  return Object.freeze(events);
}

export function encodeAssistantStreamEvent(event: AssistantStreamEvent): string {
  return `id: ${event.requestId}:${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function validateReadinessPayload(raw: unknown): ReadOnlyRuntimeReadiness {
  const root = strictObject(raw, [
    'schema', 'status', 'mode', 'actionAllowed', 'checkedAt', 'expiresAt', 'model', 'runtime', 'admission',
  ], 'readiness');
  const model = strictObject(root.model, ['id', 'artifactSha256'], 'readiness.model');
  const runtime = strictObject(root.runtime, ['id', 'imageDigest'], 'readiness.runtime');
  const admission = strictObject(root.admission, ['status', 'evidenceSha256'], 'readiness.admission');

  if (root.schema !== RUNTIME_READINESS_SCHEMA || root.status !== 'READY' || root.mode !== 'read_only' || root.actionAllowed !== false) {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', 'readiness_state_mismatch');
  }
  if (admission.status !== 'READ_ONLY_ADMITTED') {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', 'read_only_admission_missing');
  }

  const checkedAt = timestamp(root.checkedAt, 'checkedAt');
  const expiresAt = timestamp(root.expiresAt, 'expiresAt');
  const now = Date.now();
  const maxAgeMs = boundedInteger(
    process.env.AI_ASSISTANT_READINESS_MAX_AGE_SECONDS,
    DEFAULT_MAX_READINESS_AGE_SECONDS,
    1,
    300,
  ) * 1_000;
  if (checkedAt > now + 5_000 || now - checkedAt > maxAgeMs || expiresAt <= now || expiresAt <= checkedAt) {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', 'readiness_freshness_rejected');
  }

  const value: ReadOnlyRuntimeReadiness = Object.freeze({
    schema: RUNTIME_READINESS_SCHEMA,
    status: 'READY',
    mode: 'read_only',
    actionAllowed: false,
    checkedAt: String(root.checkedAt),
    expiresAt: String(root.expiresAt),
    model: Object.freeze({
      id: boundedString(model.id, 200, 'model.id'),
      artifactSha256: digest(model.artifactSha256, 'model.artifactSha256'),
    }),
    runtime: Object.freeze({
      id: boundedString(runtime.id, 200, 'runtime.id'),
      imageDigest: digest(runtime.imageDigest, 'runtime.imageDigest'),
    }),
    admission: Object.freeze({
      status: 'READ_ONLY_ADMITTED',
      evidenceSha256: digest(admission.evidenceSha256, 'admission.evidenceSha256'),
    }),
  });

  exactExpected('AI_ASSISTANT_EXPECTED_MODEL_ID', value.model.id);
  exactExpected('AI_ASSISTANT_EXPECTED_MODEL_SHA256', value.model.artifactSha256);
  exactExpected('AI_ASSISTANT_EXPECTED_RUNTIME_ID', value.runtime.id);
  exactExpected('AI_ASSISTANT_EXPECTED_RUNTIME_DIGEST', value.runtime.imageDigest);
  exactExpected('AI_ASSISTANT_EXPECTED_ADMISSION_SHA256', value.admission.evidenceSha256);
  return value;
}

function validateReadinessUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', 'readiness_url_invalid');
  }
  const allowed = (process.env.AI_ASSISTANT_ALLOWED_HOSTS || '127.0.0.1,localhost')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(url.hostname.toLowerCase())) {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', 'readiness_host_not_allowlisted');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', 'readiness_protocol_forbidden');
  }
  if (!LOCAL_RUNTIME_HOSTS.has(url.hostname.toLowerCase()) && url.protocol !== 'https:') {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', 'non_local_readiness_requires_https');
  }
  return url.toString();
}

function validateCitation(citation: AssistantCitation): void {
  if (!['platform', 'deal_registry', 'deal_workspace'].includes(citation.source)) {
    throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'citation_source_unknown');
  }
  boundedString(citation.label, 500, 'citation.label');
  timestamp(citation.asOf, 'citation.asOf');
  if (citation.href !== null && !/^\/platform-v7(?:\/[^\u0000-\u001F\u007F]*)?$/u.test(citation.href)) {
    throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'citation_href_forbidden');
  }
}

function validateFreshness(generatedAt: string, freshnessAt: string): void {
  const generated = timestamp(generatedAt, 'generatedAt');
  const freshness = timestamp(freshnessAt, 'dataFreshnessAt');
  if (freshness > generated + 5_000) {
    throw unavailable('AI_ASSISTANT_RESPONSE_CONTRACT_REJECTED', 'freshness_in_future');
  }
}

function chunkAnswer(answer: string): readonly string[] {
  const chunks: string[] = [];
  let pending = '';
  for (const part of answer.split(/(\s+)/u)) {
    if (!part) continue;
    if (pending && pending.length + part.length > 96) {
      chunks.push(pending);
      pending = part;
    } else {
      pending += part;
    }
  }
  if (pending) chunks.push(pending);
  return Object.freeze(chunks);
}

function strictObject(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `${label}_must_be_object`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `${label}_fields_rejected`);
  }
  return record;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `${name.toLowerCase()}_missing`);
  return value;
}

function exactExpected(name: string, actual: string): void {
  const expected = requiredEnv(name);
  if (expected !== actual) throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `${name.toLowerCase()}_mismatch`);
}

function digest(value: unknown, label: string): string {
  const result = boundedString(value, 64, label).toLowerCase();
  if (!SAFE_HEX_64.test(result)) throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `${label}_invalid`);
  return result;
}

function boundedString(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `${label}_invalid`);
  }
  return value.trim();
}

function timestamp(value: unknown, label: string): number {
  const text = boundedString(value, 80, label);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw unavailable('AI_ASSISTANT_RUNTIME_NOT_READY', `${label}_invalid`);
  return parsed;
}

function boundedInteger(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function unavailable(code: string, reason: string): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code,
    message: 'AI read-only runtime is unavailable.',
    reason,
    retryable: true,
    mode: 'read_only',
    actionAllowed: false,
  });
}
