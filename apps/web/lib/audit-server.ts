import { serverApiUrl, serverAuthHeaders } from '@/lib/server-api';

export type AuditServerEntry = Readonly<{
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  hash: string | null;
  prevHash: string | null;
  createdAt: string;
}>;

export type AuditServerState = Readonly<{
  available: boolean;
  entries: readonly AuditServerEntry[];
}>;

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseEntry(value: unknown): AuditServerEntry | null {
  const row = asObject(value);
  if (!row) return null;
  const id = asString(row.id);
  const action = asString(row.action);
  const createdAt = asString(row.createdAt);
  if (!id || !action || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;

  return {
    id,
    action,
    entityType: asString(row.entityType) ?? '',
    entityId: asString(row.entityId) ?? '',
    actorUserId: asString(row.actorUserId),
    hash: asString(row.hash),
    prevHash: asString(row.prevHash),
    createdAt,
  };
}

export async function getAuditServerState(): Promise<AuditServerState> {
  try {
    const response = await fetch(serverApiUrl('/audit'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) return { available: false, entries: [] };

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { available: false, entries: [] };

    return {
      available: true,
      entries: payload.map(parseEntry).filter((entry): entry is AuditServerEntry => entry !== null),
    };
  } catch {
    return { available: false, entries: [] };
  }
}
