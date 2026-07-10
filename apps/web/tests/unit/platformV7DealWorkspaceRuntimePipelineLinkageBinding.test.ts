import { describe, expect, it } from 'vitest';
import {
  executeP7DealWorkspaceRuntimeIntentAction,
  type P7DealWorkspaceRuntimeIntentActionInput,
} from '@/app/platform-v7/actions/deal-workspace-runtime-intent-actions';

describe('VP-3.25 runtime pipeline linkage binding', () => {
  it('routes the repository write through the linkage boundary', async () => {
    const result = await executeP7DealWorkspaceRuntimeIntentAction({
      dealId: 'DL-9112',
      intentId: 'start_document_review',
    });

    expect(result.ok).toBe(true);
    expect(result.runtimeLinkage.maturity).toBe('contract-linkage');
    expect(result.runtimeLinkage.state).toBe('outbox_required');
    expect(result.runtimeLinkage.acceptedOutboxEvidence).toBe(false);
    expect(result.runtimeLinkage.acceptedAuditEvidence).toBe(false);
    expect(result.runtimeRepositoryReceipt.state).toBe(result.runtimeLinkage.state);
    expect(result.runtimeRepositoryReceipt.outboxEntryId).toBeNull();
    expect(result.runtimeRepositoryReceipt.auditEventId).toBeNull();
  });

  it('does not accept linkage evidence or raw ids from public action input', async () => {
    const maliciousInput = {
      dealId: 'DL-9113',
      intentId: 'start_document_review',
      outboxEntryId: 'client-outbox-id',
      auditEventId: 'client-audit-id',
      outbox: {
        entryId: 'client-outbox-id',
        eventType: 'deal_workspace.runtime_snapshot.persisted',
      },
      audit: {
        eventId: 'client-audit-id',
        action: 'deal_workspace.runtime_snapshot.persisted',
      },
    } as unknown as P7DealWorkspaceRuntimeIntentActionInput;

    const result = await executeP7DealWorkspaceRuntimeIntentAction(maliciousInput);

    expect(result.runtimeLinkage.state).toBe('outbox_required');
    expect(result.runtimeLinkage.acceptedOutboxEvidence).toBe(false);
    expect(result.runtimeLinkage.acceptedAuditEvidence).toBe(false);
    expect(result.runtimeRepositoryReceipt.outboxEntryId).toBeNull();
    expect(result.runtimeRepositoryReceipt.auditEventId).toBeNull();
    expect(result.runtimeRepositoryReceipt.state).not.toBe('fully_linked');
  });

  it('keeps repeated action persistence duplicate-safe after linkage validation', async () => {
    const input = {
      dealId: 'DL-9114',
      intentId: 'start_document_review',
    } as const;

    const first = await executeP7DealWorkspaceRuntimeIntentAction(input);
    const second = await executeP7DealWorkspaceRuntimeIntentAction(input);

    expect(first.runtimeRepositoryReceipt.status).toBe('persisted');
    expect(second.runtimeRepositoryReceipt.status).toBe('duplicate');
    expect(second.runtimeRepositoryReceipt.recordId).toBe(first.runtimeRepositoryReceipt.recordId);
    expect(second.runtimeRepositoryReceipt.state).toBe('outbox_required');
    expect(second.runtimeLinkage.state).toBe('outbox_required');
    expect(second.runtimeRepositoryReceipt.outboxEntryId).toBeNull();
    expect(second.runtimeRepositoryReceipt.auditEventId).toBeNull();
  });
});
