export const GENERIC_INTEGRATION_ERROR_CODE = 'INTEGRATION_ERROR';

export type SafeIntegrationPayloadMetadata =
  | { readonly kind: 'ARRAY'; readonly itemCount: number; readonly truncated: boolean }
  | { readonly kind: 'OBJECT'; readonly fieldCount: number; readonly truncated: boolean }
  | { readonly kind: 'STRING'; readonly length: number; readonly truncated: boolean }
  | { readonly kind: 'NUMBER' }
  | { readonly kind: 'BOOLEAN' }
  | { readonly kind: 'NULL' }
  | { readonly kind: 'OTHER' };

export interface IntegrationEventRowLike {
  readonly id: string;
  readonly adapterName: string;
  readonly direction: string;
  readonly eventType: string;
  readonly status: string;
  readonly httpStatus: number | null;
  readonly durationMs: number | null;
  readonly errorMessage?: string | null;
  readonly createdAt: Date;
}

/**
 * Deliberately small staff-facing projection. The event table historically has
 * requestPayload/responsePayload/errorMessage fields, but §43/§48/§53 require
 * support to be metadata-only by default and forbid secrets in support output.
 * No generic "spread" is used here, so adding a sensitive column later cannot
 * make it escape automatically.
 */
export interface SafeIntegrationEventView {
  readonly id: string;
  readonly adapterName: string;
  readonly direction: string;
  readonly eventType: string;
  readonly status: string;
  readonly httpStatus: number | null;
  readonly durationMs: number | null;
  readonly safeErrorCode: string | null;
  readonly createdAt: Date;
}

const MAX_STRUCTURAL_COUNT = 1_000_000;
const MAX_STRING_LENGTH_REPORT = 10_000_000;
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_.:-]{0,95}$/;

/**
 * Replace an arbitrary request/response value with structural metadata only.
 * We intentionally do not persist hashes, field names or samples: a hash of a
 * low-entropy password/API key is still sensitive, and field names can expose
 * business semantics unnecessarily. This function never returns an original
 * scalar value.
 */
export function summarizeIntegrationPayload(
  value: unknown,
): SafeIntegrationPayloadMetadata | null {
  if (value === undefined) return null;
  if (value === null) return Object.freeze({ kind: 'NULL' });

  if (Array.isArray(value)) {
    return Object.freeze({
      kind: 'ARRAY',
      itemCount: Math.min(value.length, MAX_STRUCTURAL_COUNT),
      truncated: value.length > MAX_STRUCTURAL_COUNT,
    });
  }

  switch (typeof value) {
    case 'object': {
      let fieldCount = 0;
      try {
        fieldCount = Object.keys(value as Record<string, unknown>).length;
      } catch {
        return Object.freeze({ kind: 'OTHER' });
      }
      return Object.freeze({
        kind: 'OBJECT',
        fieldCount: Math.min(fieldCount, MAX_STRUCTURAL_COUNT),
        truncated: fieldCount > MAX_STRUCTURAL_COUNT,
      });
    }
    case 'string':
      return Object.freeze({
        kind: 'STRING',
        length: Math.min(value.length, MAX_STRING_LENGTH_REPORT),
        truncated: value.length > MAX_STRING_LENGTH_REPORT,
      });
    case 'number':
    case 'bigint':
      return Object.freeze({ kind: 'NUMBER' });
    case 'boolean':
      return Object.freeze({ kind: 'BOOLEAN' });
    default:
      return Object.freeze({ kind: 'OTHER' });
  }
}

/**
 * Preserve only a bounded machine code. Free text is intentionally collapsed
 * to a generic code because exception messages commonly contain URLs, account
 * identifiers, upstream response fragments or credentials.
 */
export function safeIntegrationErrorCode(
  errorMessage: string | null | undefined,
): string | null {
  if (errorMessage == null || errorMessage.trim() === '') return null;
  const candidate = errorMessage.trim();
  return SAFE_ERROR_CODE.test(candidate)
    ? candidate
    : GENERIC_INTEGRATION_ERROR_CODE;
}

export function toSafeIntegrationEventView(
  event: IntegrationEventRowLike,
): SafeIntegrationEventView {
  return Object.freeze({
    id: event.id,
    adapterName: event.adapterName,
    direction: event.direction,
    eventType: event.eventType,
    status: event.status,
    httpStatus: event.httpStatus,
    durationMs: event.durationMs,
    safeErrorCode: safeIntegrationErrorCode(event.errorMessage),
    createdAt: event.createdAt,
  });
}
