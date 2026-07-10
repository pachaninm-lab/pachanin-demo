import {
  p7RuntimeDbContractNextState,
  type P7DealWorkspaceRuntimeDbContract,
  type P7DealWorkspaceRuntimeDbWriteState,
} from './deal-workspace-runtime-db-contract';

export type P7DealWorkspaceRuntimeRepositoryMaturity = 'repository-contract-adapter';
export type P7DealWorkspaceRuntimeRepositoryReceiptStatus = 'persisted' | 'duplicate' | 'promoted' | 'conflict';
export type P7DealWorkspaceRuntimeRepositoryConflictCode =
  | 'IDEMPOTENCY_CONTRACT_MISMATCH'
  | 'OUTBOX_LINKAGE_CONFLICT'
  | 'AUDIT_LINKAGE_CONFLICT';

export interface P7DealWorkspaceRuntimeRepositoryLinkage {
  readonly outboxEntryId?: string | null;
  readonly auditEventId?: string | null;
}

export interface P7DealWorkspaceRuntimeRepositoryReceipt {
  readonly recordId: string;
  readonly runtimeSnapshotId: string;
  readonly idempotencyKey: string;
  readonly state: P7DealWorkspaceRuntimeDbWriteState;
  readonly savedAt: string;
  readonly outboxEntryId: string | null;
  readonly auditEventId: string | null;
  readonly status: P7DealWorkspaceRuntimeRepositoryReceiptStatus;
  readonly maturity: P7DealWorkspaceRuntimeRepositoryMaturity;
  readonly conflictCode?: P7DealWorkspaceRuntimeRepositoryConflictCode;
  readonly conflictReason?: string;
}

export interface P7DealWorkspaceRuntimeRepositoryRecord extends P7DealWorkspaceRuntimeRepositoryReceipt {
  readonly contract: P7DealWorkspaceRuntimeDbContract;
}

export interface P7DealWorkspaceRuntimeRepositoryWriteInput {
  readonly contract: P7DealWorkspaceRuntimeDbContract;
  readonly linkage?: P7DealWorkspaceRuntimeRepositoryLinkage;
  readonly savedAt?: string;
}

export interface P7DealWorkspaceRuntimeRepository {
  /** Backward-compatible duplicate-safe write used by the current action pipeline. */
  write(input: P7DealWorkspaceRuntimeRepositoryWriteInput): P7DealWorkspaceRuntimeRepositoryReceipt;
  /** Strict write for transaction/idempotency hardening and monotonic linkage promotion. */
  writeHardened(input: P7DealWorkspaceRuntimeRepositoryWriteInput): P7DealWorkspaceRuntimeRepositoryReceipt;
  findByIdempotencyKey(idempotencyKey: string): P7DealWorkspaceRuntimeRepositoryReceipt | null;
  list(): readonly P7DealWorkspaceRuntimeRepositoryRecord[];
}

interface RepositoryState {
  readonly records: P7DealWorkspaceRuntimeRepositoryRecord[];
  readonly byIdempotencyKey: Map<string, P7DealWorkspaceRuntimeRepositoryRecord>;
}

const STATE_RANK: Record<P7DealWorkspaceRuntimeDbWriteState, number> = {
  ready_to_persist: 0,
  outbox_required: 1,
  audit_required: 2,
  fully_linked: 3,
};

function nowIso(): string {
  return new Date().toISOString();
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 160);
}

function buildRecordId(contract: P7DealWorkspaceRuntimeDbContract): string {
  return `p7-runtime-db:${safePart(contract.runtimeSnapshotId)}`;
}

function toReceipt(
  record: P7DealWorkspaceRuntimeRepositoryRecord,
  status: P7DealWorkspaceRuntimeRepositoryReceiptStatus,
  conflict?: { readonly code: P7DealWorkspaceRuntimeRepositoryConflictCode; readonly reason: string },
): P7DealWorkspaceRuntimeRepositoryReceipt {
  return {
    recordId: record.recordId,
    runtimeSnapshotId: record.runtimeSnapshotId,
    idempotencyKey: record.idempotencyKey,
    state: record.state,
    savedAt: record.savedAt,
    outboxEntryId: record.outboxEntryId,
    auditEventId: record.auditEventId,
    status,
    maturity: record.maturity,
    conflictCode: conflict?.code,
    conflictReason: conflict?.reason,
  };
}

function materialContractFingerprint(contract: P7DealWorkspaceRuntimeDbContract): string {
  return JSON.stringify({
    runtimeSnapshotId: contract.runtimeSnapshotId,
    dealId: contract.dealId,
    intentId: contract.intentId,
    runtimeStoreRecordId: contract.runtimeStoreRecordId,
    runtimeStoreVersion: contract.runtimeStoreVersion,
    outboxType: contract.outboxType,
    auditAction: contract.auditAction,
    actorId: contract.actorId,
    actorRole: contract.actorRole,
    correlationId: contract.correlationId,
    auditId: contract.auditId,
    idempotencyKey: contract.idempotencyKey,
    snapshot: contract.payload.snapshot,
  });
}

function sameMaterialContract(
  existing: P7DealWorkspaceRuntimeDbContract,
  incoming: P7DealWorkspaceRuntimeDbContract,
): boolean {
  return materialContractFingerprint(existing) === materialContractFingerprint(incoming);
}

function linkageConflict(
  existing: P7DealWorkspaceRuntimeRepositoryRecord,
  incoming: P7DealWorkspaceRuntimeRepositoryLinkage,
): { readonly code: P7DealWorkspaceRuntimeRepositoryConflictCode; readonly reason: string } | null {
  const incomingOutbox = incoming.outboxEntryId ?? null;
  const incomingAudit = incoming.auditEventId ?? null;

  if (existing.outboxEntryId && incomingOutbox && existing.outboxEntryId !== incomingOutbox) {
    return {
      code: 'OUTBOX_LINKAGE_CONFLICT',
      reason: 'Existing outbox linkage cannot be replaced by another entry id.',
    };
  }
  if (existing.auditEventId && incomingAudit && existing.auditEventId !== incomingAudit) {
    return {
      code: 'AUDIT_LINKAGE_CONFLICT',
      reason: 'Existing audit linkage cannot be replaced by another event id.',
    };
  }
  return null;
}

export function buildP7DealWorkspaceRuntimeRepositoryReceipt(input: P7DealWorkspaceRuntimeRepositoryWriteInput): P7DealWorkspaceRuntimeRepositoryReceipt {
  const linkage = input.linkage ?? {};
  const state = p7RuntimeDbContractNextState(input.contract, linkage);
  const outboxEntryId = linkage.outboxEntryId ?? null;
  const auditEventId = linkage.auditEventId ?? null;

  return {
    recordId: buildRecordId(input.contract),
    runtimeSnapshotId: input.contract.runtimeSnapshotId,
    idempotencyKey: input.contract.idempotencyKey,
    state,
    savedAt: input.savedAt ?? nowIso(),
    outboxEntryId,
    auditEventId,
    status: 'persisted',
    maturity: 'repository-contract-adapter',
  };
}

function persistNewRecord(
  state: RepositoryState,
  input: P7DealWorkspaceRuntimeRepositoryWriteInput,
): P7DealWorkspaceRuntimeRepositoryReceipt {
  const receipt = buildP7DealWorkspaceRuntimeRepositoryReceipt(input);
  const record: P7DealWorkspaceRuntimeRepositoryRecord = {
    ...receipt,
    status: 'persisted',
    contract: input.contract,
  };

  state.records.push(record);
  state.byIdempotencyKey.set(input.contract.idempotencyKey, record);
  return toReceipt(record, 'persisted');
}

function promoteExistingRecord(
  state: RepositoryState,
  existing: P7DealWorkspaceRuntimeRepositoryRecord,
  input: P7DealWorkspaceRuntimeRepositoryWriteInput,
): P7DealWorkspaceRuntimeRepositoryReceipt {
  if (!sameMaterialContract(existing.contract, input.contract)) {
    return toReceipt(existing, 'conflict', {
      code: 'IDEMPOTENCY_CONTRACT_MISMATCH',
      reason: 'The idempotency key is already bound to another runtime snapshot or material contract.',
    });
  }

  const incomingLinkage = input.linkage ?? {};
  const conflict = linkageConflict(existing, incomingLinkage);
  if (conflict) return toReceipt(existing, 'conflict', conflict);

  const mergedLinkage: P7DealWorkspaceRuntimeRepositoryLinkage = {
    outboxEntryId: existing.outboxEntryId ?? incomingLinkage.outboxEntryId ?? null,
    auditEventId: existing.auditEventId ?? incomingLinkage.auditEventId ?? null,
  };
  const nextState = p7RuntimeDbContractNextState(existing.contract, mergedLinkage);

  if (STATE_RANK[nextState] <= STATE_RANK[existing.state]) {
    return toReceipt(existing, 'duplicate');
  }

  const promoted: P7DealWorkspaceRuntimeRepositoryRecord = {
    ...existing,
    state: nextState,
    outboxEntryId: mergedLinkage.outboxEntryId ?? null,
    auditEventId: mergedLinkage.auditEventId ?? null,
    status: 'persisted',
  };
  const index = state.records.findIndex((record) => record.recordId === existing.recordId);
  if (index >= 0) state.records[index] = promoted;
  state.byIdempotencyKey.set(existing.idempotencyKey, promoted);
  return toReceipt(promoted, 'promoted');
}

export function createP7DealWorkspaceRuntimeRepository(): P7DealWorkspaceRuntimeRepository {
  const state: RepositoryState = {
    records: [],
    byIdempotencyKey: new Map<string, P7DealWorkspaceRuntimeRepositoryRecord>(),
  };

  return {
    write(input) {
      const duplicate = state.byIdempotencyKey.get(input.contract.idempotencyKey);
      if (duplicate) return toReceipt(duplicate, 'duplicate');
      return persistNewRecord(state, input);
    },

    writeHardened(input) {
      const existing = state.byIdempotencyKey.get(input.contract.idempotencyKey);
      if (!existing) return persistNewRecord(state, input);
      return promoteExistingRecord(state, existing, input);
    },

    findByIdempotencyKey(idempotencyKey) {
      const record = state.byIdempotencyKey.get(idempotencyKey);
      return record ? toReceipt(record, 'persisted') : null;
    },

    list() {
      return state.records.map((record) => ({ ...record }));
    },
  };
}
