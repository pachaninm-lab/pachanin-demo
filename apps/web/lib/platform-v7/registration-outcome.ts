export type RegistrationBusinessStatus =
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ORGANIZATION_VERIFICATION_PENDING'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'APPROVED'
  | 'ACTIVATED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'CANCELLED';

export type RegistrationNextAction =
  | 'VERIFY_EMAIL'
  | 'WAIT_FOR_REVIEW'
  | 'PROVIDE_ADDITIONAL_INFORMATION'
  | 'WAIT_FOR_ACTIVATION'
  | 'LOGIN'
  | 'CONTACT_SUPPORT'
  | 'START_NEW_APPLICATION'
  | 'WAIT';

export type RegistrationStatusSnapshot = Readonly<{
  applicationId?: string;
  status: RegistrationBusinessStatus;
  nextAction: RegistrationNextAction;
  reason?: string | null;
  correlationId?: string;
  statusToken?: string;
  ok?: boolean;
}>;

export type RegistrationUnknownOperation = Readonly<{
  serializedPayload: string;
  idempotencyKey: string;
}>;

export type RegistrationSubmitVerdict = 'accepted' | 'invalid' | 'unavailable' | 'unknown';
export type RegistrationStatusVerdict =
  | Readonly<{ kind: 'available'; status: RegistrationStatusSnapshot }>
  | Readonly<{ kind: 'invalid' | 'unavailable' }>;

const STATUS_CODES = new Set<RegistrationBusinessStatus>([
  'EMAIL_VERIFICATION_REQUIRED',
  'ORGANIZATION_VERIFICATION_PENDING',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'APPROVED',
  'ACTIVATED',
  'REJECTED',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
]);

const NEXT_ACTIONS = new Set<RegistrationNextAction>([
  'VERIFY_EMAIL',
  'WAIT_FOR_REVIEW',
  'PROVIDE_ADDITIONAL_INFORMATION',
  'WAIT_FOR_ACTIVATION',
  'LOGIN',
  'CONTACT_SUPPORT',
  'START_NEW_APPLICATION',
  'WAIT',
]);

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown, limit: number): string | undefined {
  return typeof value === 'string' && value.length <= limit ? value : undefined;
}

export function registrationOperationForPayload(
  serializedPayload: string,
  unknownOperation: RegistrationUnknownOperation | null,
  createKey: () => string,
): RegistrationUnknownOperation {
  if (unknownOperation?.serializedPayload === serializedPayload) return unknownOperation;
  return Object.freeze({ serializedPayload, idempotencyKey: createKey() });
}

export function classifyRegistrationSubmitResponse(
  response: Readonly<{ ok: boolean; status: number }>,
  payload: unknown,
): RegistrationSubmitVerdict {
  const row = object(payload);
  if (row?.outcome === 'unknown') return 'unknown';
  if (response.ok && row?.accepted === true) return 'accepted';
  if (response.ok) return 'unknown';
  // A 5xx (or an idempotency conflict) can arrive after the upstream mutation.
  // Retain the exact operation key until its outcome is reconciled.
  if (response.status >= 500 || response.status === 409) return 'unknown';
  if (row?.accepted === false) return response.status === 400 ? 'invalid' : 'unavailable';
  return 'unknown';
}

export function parseRegistrationStatusSnapshot(payload: unknown): RegistrationStatusSnapshot | null {
  const row = object(payload);
  if (!row || row.ok === false) return null;
  if (typeof row.status !== 'string' || !STATUS_CODES.has(row.status as RegistrationBusinessStatus)) return null;
  if (typeof row.nextAction !== 'string' || !NEXT_ACTIONS.has(row.nextAction as RegistrationNextAction)) return null;
  const reason = row.reason === null
    ? null
    : typeof row.reason === 'string' && row.reason.length <= 2_000
      ? row.reason
      : undefined;
  if (row.reason !== undefined && reason === undefined) return null;
  return Object.freeze({
    applicationId: optionalString(row.applicationId, 160),
    status: row.status as RegistrationBusinessStatus,
    nextAction: row.nextAction as RegistrationNextAction,
    reason,
    correlationId: optionalString(row.correlationId, 160),
    statusToken: optionalString(row.statusToken, 512),
    ok: row.ok === true ? true : undefined,
  });
}

export function classifyRegistrationStatusResponse(
  response: Readonly<{ ok: boolean; status: number }>,
  payload: unknown,
): RegistrationStatusVerdict {
  if (response.ok) {
    const status = parseRegistrationStatusSnapshot(payload);
    return status ? { kind: 'available', status } : { kind: 'unavailable' };
  }
  const row = object(payload);
  if (response.status === 404 || row?.code === 'REGISTRATION_APPLICATION_NOT_FOUND') return { kind: 'invalid' };
  return { kind: 'unavailable' };
}
