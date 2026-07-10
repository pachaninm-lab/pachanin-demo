import { describe, expect, it } from 'vitest';
import { buildP7DealWorkspaceRuntimeDbContract } from '@/lib/platform-v7/deal-workspace-runtime-db-contract';
import { createP7DealWorkspaceRuntimeRepository } from '@/lib/platform-v7/deal-workspace-runtime-db-repository';
import {
  buildP7DealWorkspaceRuntimeLinkage,
  writeP7DealWorkspaceRuntimeWithLinkage,
} from '@/lib/platform-v7/deal-workspace-runtime-linkage';
import { buildP7DealWorkspaceRuntimeRefreshSnapshot } from '@/lib/platform-v7/deal-workspace-runtime-snapshot';
import type { P7DealWorkspaceRuntimeStoreReceipt } from '@/lib/platform-v7/deal-workspace-runtime-store';

function runtimeStoreReceipt(): P7DealWorkspaceRuntimeStoreReceipt {
  return {
    recordId: 'DL-LINK-1:start_document_review:p7-runtime-store-v1',
    dealId: 'DL-LINK-1',
    intentId: 'start_document_review',
    version: 'p7-runtime-store-v1',
    savedAt: '2026-07-10T04:00:00.000Z',
    maturity: 'manual-process-runtime-store',
    historyCount: 1,
  };
}

function contract() {
  const snapshot = buildP7DealWorkspaceRuntimeRefreshSnapshot({
    dealId: 'DL-LINK-1',
    intentId: 'start_document_review',
    ok: true,
    status: 'success',
    duplicate: false,
    auditPayloadCount: 1,
    boundaryStatus: 'allowed',
  });

  return buildP7DealWorkspaceRuntimeDbContract({
    snapshot,
    receipt: runtimeStoreReceipt(),
    actorId: 'operator-link-1',
    actorRole: 'operator',
    correlationId: 'corr-link-1',
    auditId: 'audit-link-1',
    idempotencyKey: 'idem-link-1',
    createdAt: '2026-07-10T04:00:00.000Z',
  });
}

function outboxEvidence() {
  return {
    entryId: 'outbox-link-1',
    eventType: 'deal_workspace.runtime_snapshot.persisted' as const,
    correlationId: 'corr-link-1',
    idempotencyKey: 'idem-link-1',
    createdAt: '2026-07-10T04:00:01.000Z',
  };
}

function auditEvidence() {
  return {
    eventId: 'audit-event-link-1',
    action: 'deal_workspace.runtime_snapshot.persisted' as const,
    correlationId: 'corr-link-1',
    actorId: 'operator-link-1',
    createdAt: '2026-07-10T04:00:02.000Z',
  };
}

describe('VP-3.21 runtime outbox audit linkage boundary', () => {
  it('keeps the contract outbox_required when no explicit evidence exists', () => {
    const result = buildP7DealWorkspaceRuntimeLinkage({ contract: contract() });

    expect(result.state).toBe('outbox_required');
    expect(result.linkage.outboxEntryId).toBeNull();
    expect(result.linkage.auditEventId).toBeNull();
    expect(result.acceptedOutboxEvidence).toBe(false);
    expect(result.acceptedAuditEvidence).toBe(false);
    expect(result.maturity).toBe('contract-linkage');
  });

  it('moves to audit_required only after valid outbox evidence is explicit', () => {
    const result = buildP7DealWorkspaceRuntimeLinkage({
      contract: contract(),
      outbox: outboxEvidence(),
    });

    expect(result.state).toBe('audit_required');
    expect(result.linkage.outboxEntryId).toBe('outbox-link-1');
    expect(result.linkage.auditEventId).toBeNull();
    expect(result.acceptedOutboxEvidence).toBe(true);
    expect(result.acceptedAuditEvidence).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it('allows fully_linked only when both matching outbox and audit evidence exist', () => {
    const result = buildP7DealWorkspaceRuntimeLinkage({
      contract: contract(),
      outbox: outboxEvidence(),
      audit: auditEvidence(),
    });

    expect(result.state).toBe('fully_linked');
    expect(result.linkage.outboxEntryId).toBe('outbox-link-1');
    expect(result.linkage.auditEventId).toBe('audit-event-link-1');
    expect(result.acceptedOutboxEvidence).toBe(true);
    expect(result.acceptedAuditEvidence).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects mismatched evidence and never manufactures fully_linked state', () => {
    const result = buildP7DealWorkspaceRuntimeLinkage({
      contract: contract(),
      outbox: { ...outboxEvidence(), idempotencyKey: 'wrong-idempotency' },
      audit: { ...auditEvidence(), actorId: 'wrong-actor' },
    });

    expect(result.state).toBe('outbox_required');
    expect(result.linkage.outboxEntryId).toBeNull();
    expect(result.linkage.auditEventId).toBeNull();
    expect(result.acceptedOutboxEvidence).toBe(false);
    expect(result.acceptedAuditEvidence).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'OUTBOX_IDEMPOTENCY_MISMATCH',
      'AUDIT_ACTOR_MISMATCH',
    ]);
  });

  it('writes only linkage ids accepted by the validation boundary', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const result = writeP7DealWorkspaceRuntimeWithLinkage({
      repository,
      contract: contract(),
      outbox: outboxEvidence(),
      audit: auditEvidence(),
      savedAt: '2026-07-10T04:00:03.000Z',
    });

    expect(result.linkageResult.state).toBe('fully_linked');
    expect(result.repositoryReceipt.state).toBe('fully_linked');
    expect(result.repositoryReceipt.outboxEntryId).toBe('outbox-link-1');
    expect(result.repositoryReceipt.auditEventId).toBe('audit-event-link-1');
    expect(repository.list()).toHaveLength(1);
  });

  it('writes a blocked linkage state when supplied evidence fails validation', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const result = writeP7DealWorkspaceRuntimeWithLinkage({
      repository,
      contract: contract(),
      outbox: { ...outboxEvidence(), correlationId: 'wrong-correlation' },
      audit: auditEvidence(),
    });

    expect(result.linkageResult.state).toBe('outbox_required');
    expect(result.linkageResult.issues.map((issue) => issue.code)).toContain('OUTBOX_CORRELATION_MISMATCH');
    expect(result.repositoryReceipt.state).toBe('outbox_required');
    expect(result.repositoryReceipt.outboxEntryId).toBeNull();
    expect(result.repositoryReceipt.auditEventId).toBe('audit-event-link-1');
  });
});
