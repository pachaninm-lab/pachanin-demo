import { describe, expect, it } from 'vitest';
import { executeP7DealWorkspaceRuntimeIntentAction } from '@/app/platform-v7/actions/deal-workspace-runtime-intent-actions';

describe('VP-3.17 runtime persistence pipeline binding', () => {
  it('attaches repository adapter receipt after runtime store receipt', async () => {
    const result = await executeP7DealWorkspaceRuntimeIntentAction({
      dealId: 'DL-9117',
      intentId: 'start_document_review',
    });

    expect(result.ok).toBe(true);
    expect(result.runtimeStoreReceipt.recordId).toBe('DL-9117:start_document_review:p7-runtime-store-v1');
    expect(result.runtimeRepositoryReceipt.runtimeSnapshotId).toBe('p7-runtime-snapshot:DL-9117:start_document_review:p7-runtime-store-v1');
    expect(result.runtimeRepositoryReceipt.recordId).toBe('p7-runtime-db:p7-runtime-snapshot:DL-9117:start_document_review:p7-runtime-store-v1');
    expect(result.runtimeRepositoryReceipt.status).toBe('persisted');
    expect(result.runtimeRepositoryReceipt.state).toBe('outbox_required');
    expect(result.runtimeRepositoryReceipt.maturity).toBe('repository-contract-adapter');
    expect(result.runtimeRepositoryReceipt.idempotencyKey).toContain('upload_document');
  });

  it('keeps fully_linked blocked until outbox and audit linkage exist', async () => {
    const result = await executeP7DealWorkspaceRuntimeIntentAction({
      dealId: 'DL-9103',
      intentId: 'start_document_review',
    });

    expect(result.runtimeRepositoryReceipt.state).toBe('outbox_required');
    expect(result.runtimeRepositoryReceipt.outboxEntryId).toBeNull();
    expect(result.runtimeRepositoryReceipt.auditEventId).toBeNull();
    expect(result.runtimeRepositoryReceipt.state).not.toBe('fully_linked');
  });

  it('treats repeated runtime intent idempotency as duplicate-safe without a second repository write', async () => {
    const first = await executeP7DealWorkspaceRuntimeIntentAction({
      dealId: 'DL-9115',
      intentId: 'start_document_review',
    });
    const second = await executeP7DealWorkspaceRuntimeIntentAction({
      dealId: 'DL-9115',
      intentId: 'start_document_review',
    });

    expect(first.runtimeRepositoryReceipt.status).toBe('persisted');
    expect(second.runtimeRepositoryReceipt.status).toBe('duplicate');
    expect(second.runtimeRepositoryReceipt.recordId).toBe(first.runtimeRepositoryReceipt.recordId);
    expect(second.runtimeRepositoryReceipt.runtimeSnapshotId).toBe(first.runtimeRepositoryReceipt.runtimeSnapshotId);
    expect(second.runtimeRepositoryReceipt.outboxEntryId).toBeNull();
    expect(second.runtimeRepositoryReceipt.auditEventId).toBeNull();
    expect(second.runtimeRepositoryReceipt.state).toBe('outbox_required');
  });
});
