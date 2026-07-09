import {
  p7RuntimeDbContractNextState,
  type P7DealWorkspaceRuntimeDbContract,
  type P7DealWorkspaceRuntimeDbWriteState,
} from './deal-workspace-runtime-db-contract';

export type P7DealWorkspaceRuntimeRepositoryMaturity = 'repository-contract-adapter';
export type P7DealWorkspaceRuntimeRepositoryReceiptStatus = 'persisted' | 'duplicate';

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
  write(input: P7DealWorkspaceRuntimeRepositoryWriteInput): P7DealWorkspaceRuntimeRepositoryReceipt;
  findByIdempotencyKey(idempotencyKey: string): P7DealWorkspaceRuntimeRepositoryReceipt | null;
  list(): readonly P7DealWorkspaceRuntimeRepositoryRecord[];
}

interface RepositoryState {
  readonly records: P7DealWorkspaceRuntimeRepositoryRecord[];
  readonly byIdempotencyKey: Map<string, P7DealWorkspaceRuntimeRepositoryRecord>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 160);
}

function buildRecordId(contract: P7DealWorkspaceRuntimeDbContract): string {
  return `p7-runtime-db:${safePart(contract.runtimeSnapshotId)}`;
}

function toReceipt(record: P7DealWorkspaceRuntimeRepositoryRecord, status: P7DealWorkspaceRuntimeRepositoryReceiptStatus): P7DealWorkspaceRuntimeRepositoryReceipt {
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
  };
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

export function createP7DealWorkspaceRuntimeRepository(): P7DealWorkspaceRuntimeRepository {
  const state: RepositoryState = {
    records: [],
    byIdempotencyKey: new Map<string, P7DealWorkspaceRuntimeRepositoryRecord>(),
  };

  return {
    write(input) {
      const duplicate = state.byIdempotencyKey.get(input.contract.idempotencyKey);
      if (duplicate) return toReceipt(duplicate, 'duplicate');

      const receipt = buildP7DealWorkspaceRuntimeRepositoryReceipt(input);
      const record: P7DealWorkspaceRuntimeRepositoryRecord = {
        ...receipt,
        status: 'persisted',
        contract: input.contract,
      };

      state.records.push(record);
      state.byIdempotencyKey.set(input.contract.idempotencyKey, record);

      return toReceipt(record, 'persisted');
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
