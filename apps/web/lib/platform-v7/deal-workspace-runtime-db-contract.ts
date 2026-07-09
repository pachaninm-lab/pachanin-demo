import type { P7DealWorkspaceRuntimeIntentId } from './deal-workspace-runtime-intents';
import type { P7DealWorkspaceRuntimeRefreshSnapshot } from './deal-workspace-runtime-snapshot';
import type { P7DealWorkspaceRuntimeStoreReceipt } from './deal-workspace-runtime-store';

export type P7DealWorkspaceRuntimeDbMaturity = 'postgres-contract';
export type P7DealWorkspaceRuntimeDbWriteState = 'ready_to_persist' | 'outbox_required' | 'audit_required' | 'fully_linked';

export interface P7DealWorkspaceRuntimeDbContractInput {
  readonly snapshot: P7DealWorkspaceRuntimeRefreshSnapshot;
  readonly receipt: P7DealWorkspaceRuntimeStoreReceipt;
  readonly actorId: string;
  readonly actorRole: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
}

export interface P7DealWorkspaceRuntimeDbContract {
  readonly runtimeSnapshotId: string;
  readonly dealId: string;
  readonly intentId: P7DealWorkspaceRuntimeIntentId;
  readonly state: P7DealWorkspaceRuntimeDbWriteState;
  readonly maturity: P7DealWorkspaceRuntimeDbMaturity;
  readonly runtimeStoreRecordId: string;
  readonly runtimeStoreVersion: string;
  readonly outboxType: 'deal_workspace.runtime_snapshot.persisted';
  readonly auditAction: 'deal_workspace.runtime_snapshot.persisted';
  readonly actorId: string;
  readonly actorRole: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly idempotencyKey: string;
  readonly payload: {
    readonly snapshot: P7DealWorkspaceRuntimeRefreshSnapshot;
    readonly receipt: P7DealWorkspaceRuntimeStoreReceipt;
  };
  readonly createdAt: string;
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96);
}

export function buildP7DealWorkspaceRuntimeDbContract(input: P7DealWorkspaceRuntimeDbContractInput): P7DealWorkspaceRuntimeDbContract {
  const runtimeSnapshotId = [
    'p7-runtime-snapshot',
    safePart(input.snapshot.dealId),
    safePart(input.snapshot.intentId),
    safePart(input.receipt.version),
  ].join(':');

  return {
    runtimeSnapshotId,
    dealId: input.snapshot.dealId,
    intentId: input.snapshot.intentId,
    state: 'ready_to_persist',
    maturity: 'postgres-contract',
    runtimeStoreRecordId: input.receipt.recordId,
    runtimeStoreVersion: input.receipt.version,
    outboxType: 'deal_workspace.runtime_snapshot.persisted',
    auditAction: 'deal_workspace.runtime_snapshot.persisted',
    actorId: input.actorId,
    actorRole: input.actorRole,
    correlationId: input.correlationId,
    auditId: input.auditId,
    idempotencyKey: input.idempotencyKey,
    payload: { snapshot: input.snapshot, receipt: input.receipt },
    createdAt: input.createdAt,
  };
}

export function p7RuntimeDbContractNextState(contract: P7DealWorkspaceRuntimeDbContract, linkage: { readonly outboxEntryId?: string | null; readonly auditEventId?: string | null }): P7DealWorkspaceRuntimeDbWriteState {
  if (linkage.outboxEntryId && linkage.auditEventId) return 'fully_linked';
  if (!linkage.outboxEntryId) return 'outbox_required';
  if (!linkage.auditEventId) return 'audit_required';
  return contract.state;
}
