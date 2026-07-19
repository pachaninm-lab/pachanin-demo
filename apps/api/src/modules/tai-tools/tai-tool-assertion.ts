import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type TaiToolMode = 'READ_ONLY' | 'DRAFT' | 'CONFIRMED_WRITE';

export const TAI_PLATFORM_TOOL_MODES = {
  getDealSummary: 'READ_ONLY',
  getRoleNextActions: 'READ_ONLY',
  prepareCommandDraft: 'DRAFT',
  assignLogistics: 'CONFIRMED_WRITE',
} as const satisfies Record<string, TaiToolMode>;

export type TaiPlatformToolName = keyof typeof TAI_PLATFORM_TOOL_MODES;

export type TaiDelegatedIdentity = {
  readonly userId: string;
  readonly tenantId: string | null;
  readonly sessionId: string;
  readonly traceId: string;
  readonly callId: string;
  readonly toolName: TaiPlatformToolName;
  readonly mode: TaiToolMode;
  readonly idempotencyKey: string;
};

type TaiToolAssertionPayload = {
  readonly audience: 'platform-api';
  readonly call_id: string;
  readonly expires_at: string;
  readonly idempotency_key: string;
  readonly issued_at: string;
  readonly mode: TaiToolMode;
  readonly request_sha256: string;
  readonly schema_version: 'tai.platform-tool.v1';
  readonly session_id: string;
  readonly tenant_id: string | null;
  readonly tool_name: TaiPlatformToolName;
  readonly trace_id: string;
  readonly user_id: string;
};

const EXPECTED_KEYS = new Set([
  'audience',
  'call_id',
  'expires_at',
  'idempotency_key',
  'issued_at',
  'mode',
  'request_sha256',
  'schema_version',
  'session_id',
  'tenant_id',
  'tool_name',
  'trace_id',
  'user_id',
]);
const PORTABLE = /^[A-Za-z0-9._:-]{1,160}$/;
const IDEMPOTENCY = /^[A-Za-z0-9._:-]{16,160}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const STANDARD_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ASSERTION_BYTES = 16_384;
const MAX_TTL_MS = 30_000;
const MAX_CLOCK_SKEW_MS = 5_000;

function stable(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('non-integer JSON number');
    return value;
  }
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  throw new TypeError('unsupported canonical JSON value');
}

export function canonicalTaiToolJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

export function canonicalTaiToolRequestSha256(input: {
  readonly method: string;
  readonly path: string;
  readonly payload: unknown;
  readonly idempotencyKey: string;
}): string {
  return createHash('sha256')
    .update(
      canonicalTaiToolJson({
        idempotency_key: input.idempotencyKey,
        method: input.method.trim().toUpperCase(),
        path: input.path,
        payload: input.payload,
      }),
    )
    .digest('hex');
}

function requiredString(payload: Record<string, unknown>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is invalid`);
  return value;
}

function parseDate(value: string, name: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${name} is invalid`);
  return parsed;
}

function isToolName(value: unknown): value is TaiPlatformToolName {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(TAI_PLATFORM_TOOL_MODES, value)
  );
}

function decodeAssertion(encoded: string): {
  readonly canonical: Buffer;
  readonly payload: TaiToolAssertionPayload;
} {
  if (
    !encoded ||
    encoded.length > MAX_ASSERTION_BYTES * 2 ||
    !BASE64URL.test(encoded)
  ) {
    throw new Error('assertion is invalid');
  }
  const canonical = Buffer.from(encoded, 'base64url');
  if (
    canonical.length === 0 ||
    canonical.length > MAX_ASSERTION_BYTES ||
    canonical.toString('base64url') !== encoded
  ) {
    throw new Error('assertion is invalid');
  }
  const decoded = JSON.parse(canonical.toString('utf8')) as unknown;
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('assertion shape is invalid');
  }
  const record = decoded as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== EXPECTED_KEYS.size || keys.some((key) => !EXPECTED_KEYS.has(key))) {
    throw new Error('assertion keys are invalid');
  }
  if (canonical.toString('utf8') !== canonicalTaiToolJson(record)) {
    throw new Error('assertion is not canonical');
  }
  return {
    canonical,
    payload: record as unknown as TaiToolAssertionPayload,
  };
}

function verifySignature(canonical: Buffer, signature: string, secret: Buffer): void {
  if (!SHA256.test(signature)) throw new Error('signature is invalid');
  const expected = createHmac('sha256', secret).update(canonical).digest();
  const provided = Buffer.from(signature, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error('signature is invalid');
  }
}

function secretFromEnvironment(): Buffer {
  const encoded = String(process.env.TAI_PLATFORM_TOOL_HMAC_SECRET_B64 ?? '').trim();
  if (!encoded || !STANDARD_BASE64.test(encoded)) {
    throw new Error('TAI platform tool authority is not configured');
  }
  const secret = Buffer.from(encoded, 'base64');
  if (secret.toString('base64') !== encoded || secret.length < 32) {
    throw new Error('TAI platform tool authority secret is invalid');
  }
  return secret;
}

@Injectable()
export class TaiToolAssertionVerifier {
  verify(input: {
    readonly assertion: string;
    readonly signature: string;
    readonly toolName: string;
    readonly method: string;
    readonly path: string;
    readonly body: unknown;
    readonly idempotencyKey: string;
    readonly now?: Date;
  }): TaiDelegatedIdentity {
    try {
      const secret = secretFromEnvironment();
      const { canonical, payload } = decodeAssertion(input.assertion);
      verifySignature(canonical, input.signature, secret);

      if (
        payload.schema_version !== 'tai.platform-tool.v1' ||
        payload.audience !== 'platform-api'
      ) {
        throw new Error('assertion authority is invalid');
      }
      if (!isToolName(payload.tool_name) || payload.tool_name !== input.toolName) {
        throw new Error('tool binding failed');
      }
      const expectedMode = TAI_PLATFORM_TOOL_MODES[payload.tool_name];
      if (payload.mode !== expectedMode) throw new Error('tool mode binding failed');
      if (!PORTABLE.test(payload.call_id) || !UUID.test(payload.trace_id)) {
        throw new Error('trace binding is invalid');
      }
      if (!UUID.test(payload.user_id) || !UUID.test(payload.session_id)) {
        throw new Error('identity binding is invalid');
      }
      if (payload.tenant_id !== null && !UUID.test(payload.tenant_id)) {
        throw new Error('tenant binding is invalid');
      }
      if (
        !IDEMPOTENCY.test(payload.idempotency_key) ||
        payload.idempotency_key !== input.idempotencyKey
      ) {
        throw new Error('idempotency binding failed');
      }
      if (!SHA256.test(payload.request_sha256)) throw new Error('request digest is invalid');
      const expectedRequest = canonicalTaiToolRequestSha256({
        method: input.method,
        path: input.path,
        payload: input.body,
        idempotencyKey: input.idempotencyKey,
      });
      if (payload.request_sha256 !== expectedRequest) throw new Error('request binding failed');

      const now = input.now ?? new Date();
      const record = payload as unknown as Record<string, unknown>;
      const issuedAt = parseDate(requiredString(record, 'issued_at'), 'issued_at');
      const expiresAt = parseDate(requiredString(record, 'expires_at'), 'expires_at');
      const ttl = expiresAt.getTime() - issuedAt.getTime();
      if (ttl <= 0 || ttl > MAX_TTL_MS) throw new Error('assertion TTL is invalid');
      if (issuedAt.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
        throw new Error('assertion issued in future');
      }
      if (expiresAt.getTime() <= now.getTime() - MAX_CLOCK_SKEW_MS) {
        throw new Error('assertion expired');
      }

      return {
        userId: payload.user_id,
        tenantId: payload.tenant_id,
        sessionId: payload.session_id,
        traceId: payload.trace_id,
        callId: payload.call_id,
        toolName: payload.tool_name,
        mode: payload.mode,
        idempotencyKey: payload.idempotency_key,
      };
    } catch {
      throw new UnauthorizedException({ code: 'TAI_TOOL_ASSERTION_INVALID' });
    }
  }
}
