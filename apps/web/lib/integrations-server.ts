import { serverApiUrl, serverAuthHeaders } from './server-api';

export type IntegrationDiagnosticConnector = Readonly<{
  name: string;
  status: string;
  callbacks?: number;
}>;

export type IntegrationDiagnosticSnapshot = Readonly<{
  available: boolean;
  aggregateStatus: string | null;
  connectors: readonly IntegrationDiagnosticConnector[];
}>;

const UNAVAILABLE: IntegrationDiagnosticSnapshot = Object.freeze({
  available: false,
  aggregateStatus: null,
  connectors: Object.freeze([]),
});

/**
 * Reads the authenticated internal integration diagnostic envelope.
 *
 * The endpoint is not evidence of a production contract, credential exchange,
 * external availability or a completed end-to-end operation. The UI therefore
 * exposes every returned connector as diagnostic-only and never upgrades it to
 * a production-connected state.
 */
export async function getIntegrationDiagnostics(): Promise<IntegrationDiagnosticSnapshot> {
  try {
    const response = await fetch(serverApiUrl('/integrations/health'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) return UNAVAILABLE;
    return parseSnapshot(await response.json());
  } catch {
    return UNAVAILABLE;
  }
}

function parseSnapshot(value: unknown): IntegrationDiagnosticSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return UNAVAILABLE;
  const record = value as Record<string, unknown>;
  const aggregateStatus = optionalText(record.status);
  if (!Array.isArray(record.connectors)) return UNAVAILABLE;

  const connectors: IntegrationDiagnosticConnector[] = [];
  for (const item of record.connectors.slice(0, 100)) {
    const connector = parseConnector(item);
    if (!connector) return UNAVAILABLE;
    connectors.push(connector);
  }

  return Object.freeze({
    available: true,
    aggregateStatus,
    connectors: Object.freeze(connectors),
  });
}

function parseConnector(value: unknown): IntegrationDiagnosticConnector | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = requiredText(record.name);
  const status = requiredText(record.status);
  if (!name || !status) return null;

  const callbacks = optionalCount(record.callbacks);
  if (record.callbacks !== null && record.callbacks !== undefined && callbacks === null) return null;

  return Object.freeze({
    name,
    status,
    ...(callbacks === null ? {} : { callbacks }),
  });
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value);
}

function optionalCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const count = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}
