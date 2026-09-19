import { describe, expect, it } from 'vitest';
import { buildP7DealWorkspaceRuntimeRefreshSnapshot } from '@/lib/platform-v7/deal-workspace-runtime-snapshot';
import type { P7DealWorkspaceRuntimeStoreReceipt } from '@/lib/platform-v7/deal-workspace-runtime-store';
import {
  buildP7DealWorkspaceRuntimeDbContract,
  p7RuntimeDbContractNextState,
} from '@/lib/platform-v7/deal-workspace-runtime-db-contract';

function receipt(): P7DealWorkspaceRuntimeStoreReceipt {
  return {
    recordId: 'DL-DB-1:start_document_review:p7-runtime-store-v1',
    dealId: 'DL-DB-1',
    intentId: 'start_document_review',
    version: 'p7-runtime-store-v1',
    savedAt: '2026-07-09T12:00:00.000Z',
    maturity: 'manual-process-runtime-store',
    historyCount: 1,
  };
}

describe('VP-3 runtime DB contract', () => {
  it('builds a Postgres persistence contract linked to outbox and audit semantics', () => {
    const snapshot = buildP7DealWorkspaceRuntimeRefreshSnapshot({
      dealId: 'DL-DB-1',
      intentId: 'start_document_review',
      ok: true,
      status: 'ok',
      duplicate: false,
      auditPayloadCount: 2,
      boundaryStatus: 'allowed',
    });

    const contract = buildP7DealWorkspaceRuntimeDbContract({
      snapshot,
      receipt: receipt(),
      actorId: 'operator-1',
      actorRole: 'operator',
      correlationId: 'corr-1',
      auditId: 'audit-1',
      idempotencyKey: 'idem-1',
      createdAt: '2026-07-09T12:00:00.000Z',
    });

    expect(contract.runtimeSnapshotId).toBe('p7-runtime-snapshot:DL-DB-1:start_document_review:p7-runtime-store-v1');
    expect(contract.maturity).toBe('postgres-contract');
    expect(contract.outboxType).toBe('deal_workspace.runtime_snapshot.persisted');
    expect(contract.auditAction).toBe('deal_workspace.runtime_snapshot.persisted');
    expect(contract.payload.snapshot.state).toBe('updated');
  });

  it('derives next DB linkage state from outbox and audit links', () => {
    const snapshot = buildP7DealWorkspaceRuntimeRefreshSnapshot({
      dealId: 'DL-DB-2',
      intentId: 'request_bank_basis',
      ok: false,
      status: 'domain_blocked',
      duplicate: false,
      auditPayloadCount: 0,
    });
    const contract = buildP7DealWorkspaceRuntimeDbContract({
      snapshot,
      receipt: { ...receipt(), dealId: 'DL-DB-2', intentId: 'request_bank_basis' },
      actorId: 'operator-1',
      actorRole: 'operator',
      correlationId: 'corr-2',
      auditId: 'audit-2',
      idempotencyKey: 'idem-2',
      createdAt: '2026-07-09T12:00:00.000Z',
    });

    expect(p7RuntimeDbContractNextState(contract, {})).toBe('outbox_required');
    expect(p7RuntimeDbContractNextState(contract, { outboxEntryId: 'outbox-1' })).toBe('audit_required');
    expect(p7RuntimeDbContractNextState(contract, { outboxEntryId: 'outbox-1', auditEventId: 'audit-event-1' })).toBe('fully_linked');
  });
});
