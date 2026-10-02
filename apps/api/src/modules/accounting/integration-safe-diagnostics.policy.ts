export interface IntegrationSafeDiagnosticsInput {
  readonly connectorVersion: string;
  readonly configurationVersion: string;
  readonly heartbeatAt: Date | null;
  readonly pendingCount: number;
  readonly safeErrorCodes: readonly string[];
}

export interface IntegrationSafeDiagnosticsPreview {
  readonly connectorVersion: string;
  readonly configurationVersion: string;
  readonly heartbeatAt: string | null;
  readonly pendingCount: number;
  readonly safeErrorCodes: readonly string[];
}

export class IntegrationSafeDiagnosticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationSafeDiagnosticsError';
  }
}

/**
 * Safe metadata from §53. The returned object is intended to be shown to the
 * user verbatim before a future "send diagnostics" action transmits it.
 * Keeping this function narrow makes it impossible to accidentally add a full
 * database, password, private key, OAuth token, client secret or endpoint by
 * forwarding an arbitrary object.
 */
export function buildIntegrationSafeDiagnosticsPreview(
  input: IntegrationSafeDiagnosticsInput,
): IntegrationSafeDiagnosticsPreview {
  nonBlank(input.connectorVersion, 'connectorVersion');
  nonBlank(input.configurationVersion, 'configurationVersion');

  if (
    !Number.isSafeInteger(input.pendingCount)
    || input.pendingCount < 0
    || input.pendingCount > 10_000_000
  ) {
    throw new IntegrationSafeDiagnosticsError(
      'pendingCount must be a non-negative safe integer within the reporting bound',
    );
  }

  let heartbeatAt: string | null = null;
  if (input.heartbeatAt !== null) {
    if (!(input.heartbeatAt instanceof Date) || !Number.isFinite(input.heartbeatAt.getTime())) {
      throw new IntegrationSafeDiagnosticsError('heartbeatAt must be a valid date');
    }
    heartbeatAt = input.heartbeatAt.toISOString();
  }

  if (input.safeErrorCodes.length > 50) {
    throw new IntegrationSafeDiagnosticsError('safeErrorCodes exceeds the reporting bound');
  }

  const seen = new Set<string>();
  const safeErrorCodes: string[] = [];
  for (const code of input.safeErrorCodes) {
    if (typeof code !== 'string' || !/^[A-Z0-9][A-Z0-9_.:-]{0,95}$/.test(code)) {
      throw new IntegrationSafeDiagnosticsError(`unsafe error code: ${String(code)}`);
    }
    if (!seen.has(code)) {
      seen.add(code);
      safeErrorCodes.push(code);
    }
  }

  return Object.freeze({
    connectorVersion: input.connectorVersion.trim(),
    configurationVersion: input.configurationVersion.trim(),
    heartbeatAt,
    pendingCount: input.pendingCount,
    safeErrorCodes: Object.freeze(safeErrorCodes),
  });
}

/**
 * Defence-in-depth guard for serialized diagnostic previews. This is useful at
 * a future controller boundary and proves that no extra field can be smuggled
 * into the supposedly user-visible payload before it is sent to support.
 */
export function isExactSafeDiagnosticsPreview(value: unknown): value is IntegrationSafeDiagnosticsPreview {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [
    'configurationVersion',
    'connectorVersion',
    'heartbeatAt',
    'pendingCount',
    'safeErrorCodes',
  ];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return false;
  }
  if (typeof record.connectorVersion !== 'string' || record.connectorVersion.trim() === '') return false;
  if (
    typeof record.configurationVersion !== 'string'
    || record.configurationVersion.trim() === ''
  ) return false;
  if (
    record.heartbeatAt !== null
    && (typeof record.heartbeatAt !== 'string' || Number.isNaN(Date.parse(record.heartbeatAt)))
  ) return false;
  if (
    typeof record.pendingCount !== 'number'
    || !Number.isSafeInteger(record.pendingCount)
    || record.pendingCount < 0
  ) return false;
  if (!Array.isArray(record.safeErrorCodes)) return false;
  return record.safeErrorCodes.every(
    (code) => typeof code === 'string' && /^[A-Z0-9][A-Z0-9_.:-]{0,95}$/.test(code),
  );
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new IntegrationSafeDiagnosticsError(`${field} is required`);
  }
}
