import type { AuditEvent } from './core-types';
import type { WorkflowState } from './workflow-source-of-truth';

export const WORKFLOW_STORAGE_KEY = 'pc-platform-v7-workflow-state-v3';
export const LEGACY_WORKFLOW_STORAGE_KEY = 'pc-platform-v7-workflow-state-v2';
export const WORKFLOW_VERSION = 3;
export const WORKFLOW_AUDIT_LIMIT = 20;

export interface WorkflowSnapshot {
  state: WorkflowState;
  auditEvents: AuditEvent[];
  toast: string;
}

export interface WorkflowStoredSnapshot extends WorkflowSnapshot {
  version: number;
  updatedAt: string;
}

const stateKeys: Array<keyof WorkflowState> = [
  'batchStatus',
  'lotStatus',
  'offerStatus',
  'dealDraftStatus',
  'moneyStatus',
  'documentStatus',
  'logisticsStatus',
  'bypassStatus',
  'nextAction',
  'updatedAt',
];

export function encodeWorkflowSnapshot(snapshot: WorkflowSnapshot): string {
  return JSON.stringify({
    version: WORKFLOW_VERSION,
    state: snapshot.state,
    auditEvents: limitAuditEvents(snapshot.auditEvents),
    toast: snapshot.toast,
    updatedAt: new Date().toISOString(),
  });
}

export function decodeWorkflowSnapshot(raw: string | null | undefined): WorkflowStoredSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowStoredSnapshot>;
    if (!isWorkflowState(parsed.state)) return null;
    return {
      version: WORKFLOW_VERSION,
      state: parsed.state,
      auditEvents: limitAuditEvents(parsed.auditEvents),
      toast: typeof parsed.toast === 'string' ? parsed.toast : 'Состояние восстановлено из предыдущего действия.',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function hydrateWorkflowState(baseState: WorkflowState, stored: WorkflowStoredSnapshot | null): WorkflowState {
  if (!stored) return baseState;
  return { ...baseState, ...stored.state };
}

export function mergeWorkflowAuditEvents(primary: unknown, secondary: unknown, limit = WORKFLOW_AUDIT_LIMIT): AuditEvent[] {
  const seen = new Set<string>();
  return [...toAuditEvents(primary), ...toAuditEvents(secondary)].filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  }).slice(0, limit);
}

export function limitAuditEvents(events: unknown, limit = WORKFLOW_AUDIT_LIMIT): AuditEvent[] {
  return toAuditEvents(events).slice(0, limit);
}

function toAuditEvents(events: unknown): AuditEvent[] {
  if (!Array.isArray(events)) return [];
  return events.filter(isAuditEvent);
}

function isWorkflowState(value: unknown): value is WorkflowState {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return stateKeys.every((key) => typeof record[key] === 'string');
}

function isAuditEvent(value: unknown): value is AuditEvent {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.entityType === 'string' && typeof record.entityId === 'string' && typeof record.actorRole === 'string' && typeof record.actorId === 'string' && typeof record.action === 'string' && typeof record.createdAt === 'string';
}
