export type PlatformActionStatus = 'started' | 'success' | 'error';

export type PlatformActionScope =
  | 'deal'
  | 'dispute'
  | 'bank'
  | 'lot'
  | 'logistics'
  | 'lab'
  | 'elevator'
  | 'system';

export interface PlatformActionLogEntry {
  id: string;
  scope: PlatformActionScope;
  status: PlatformActionStatus;
  objectId: string;
  action: string;
  message: string;
  actor: string;
  at: string;
  error?: string;
}

export interface CreateActionLogEntryInput {
  scope: PlatformActionScope;
  status: PlatformActionStatus;
  objectId: string;
  action: string;
  message: string;
  actor?: string;
  at?: string;
  error?: string;
}

export function createActionLogEntry(input: CreateActionLogEntryInput): PlatformActionLogEntry {
  const at = input.at ?? new Date().toISOString();
  const safeObjectId = input.objectId.trim() || 'UNKNOWN';
  const safeAction = input.action.trim() || 'unknown-action';

  return {
    id: `${safeObjectId}-${safeAction}-${at}`,
    scope: input.scope,
    status: input.status,
    objectId: safeObjectId,
    action: safeAction,
    message: input.message.trim(),
    actor: input.actor?.trim() || 'system',
    at,
    error: input.error,
  };
}

export function appendActionLogEntry(log: PlatformActionLogEntry[], entry: PlatformActionLogEntry): PlatformActionLogEntry[] {
  return [entry, ...log].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function filterActionLogByObject(log: PlatformActionLogEntry[], objectId: string): PlatformActionLogEntry[] {
  return log.filter((entry) => entry.objectId === objectId);
}

export function summarizeActionLog(log: PlatformActionLogEntry[]) {
  return {
    total: log.length,
    success: log.filter((entry) => entry.status === 'success').length,
    error: log.filter((entry) => entry.status === 'error').length,
    started: log.filter((entry) => entry.status === 'started').length,
  };
}
