import { describe, expect, it, beforeEach } from 'vitest';
import { buildP7DealWorkspaceRuntimeRefreshSnapshot } from '@/lib/platform-v7/deal-workspace-runtime-snapshot';
import {
  latestP7DealWorkspaceRuntimeSnapshot,
  listP7DealWorkspaceRuntimeSnapshots,
  resetP7DealWorkspaceRuntimeStoreForTests,
  saveP7DealWorkspaceRuntimeSnapshot,
} from '@/lib/platform-v7/deal-workspace-runtime-store';

function snapshot(dealId: string, status = 'ok') {
  return buildP7DealWorkspaceRuntimeRefreshSnapshot({
    dealId,
    intentId: 'start_document_review',
    ok: status === 'ok',
    status,
    duplicate: false,
    auditPayloadCount: status === 'ok' ? 2 : 0,
  });
}

describe('VP-3 process runtime store', () => {
  beforeEach(() => {
    resetP7DealWorkspaceRuntimeStoreForTests();
  });

  it('saves runtime snapshots with version and history count', () => {
    const first = saveP7DealWorkspaceRuntimeSnapshot({ snapshot: snapshot('DL-STORE-1'), savedAt: '2026-07-09T12:00:00.000Z' });
    const second = saveP7DealWorkspaceRuntimeSnapshot({ snapshot: snapshot('DL-STORE-1', 'domain_blocked'), savedAt: '2026-07-09T12:01:00.000Z' });

    expect(first.version).toBe('p7-runtime-store-v1');
    expect(first.historyCount).toBe(1);
    expect(second.version).toBe('p7-runtime-store-v2');
    expect(second.historyCount).toBe(2);
    expect(second.maturity).toBe('manual-process-runtime-store');
  });

  it('lists only snapshots for the requested deal', () => {
    saveP7DealWorkspaceRuntimeSnapshot({ snapshot: snapshot('DL-STORE-A') });
    saveP7DealWorkspaceRuntimeSnapshot({ snapshot: snapshot('DL-STORE-B') });
    saveP7DealWorkspaceRuntimeSnapshot({ snapshot: snapshot('DL-STORE-A', 'domain_blocked') });

    const records = listP7DealWorkspaceRuntimeSnapshots('DL-STORE-A');
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.dealId === 'DL-STORE-A')).toBe(true);
  });

  it('returns the latest runtime snapshot for a deal', () => {
    saveP7DealWorkspaceRuntimeSnapshot({ snapshot: snapshot('DL-STORE-LATEST'), savedAt: '2026-07-09T12:00:00.000Z' });
    const receipt = saveP7DealWorkspaceRuntimeSnapshot({ snapshot: snapshot('DL-STORE-LATEST', 'domain_blocked'), savedAt: '2026-07-09T12:02:00.000Z' });

    const latest = latestP7DealWorkspaceRuntimeSnapshot('DL-STORE-LATEST');
    expect(latest?.recordId).toBe(receipt.recordId);
    expect(latest?.snapshot.state).toBe('blocked');
  });
});
