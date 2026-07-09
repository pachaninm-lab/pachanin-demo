import { describe, expect, it } from 'vitest';
import {
  buildP7DealWorkspaceRuntimeRefreshSnapshot,
  p7RuntimeSnapshotStateText,
} from '@/lib/platform-v7/deal-workspace-runtime-snapshot';

describe('VP-3 runtime refresh snapshot', () => {
  it('marks a successful runtime action as a refreshable manual runtime snapshot', () => {
    const snapshot = buildP7DealWorkspaceRuntimeRefreshSnapshot({
      dealId: 'DL-SNAPSHOT-1',
      intentId: 'start_document_review',
      ok: true,
      status: 'ok',
      duplicate: false,
      auditPayloadCount: 2,
      boundaryStatus: 'allowed',
    });

    expect(snapshot.state).toBe('updated');
    expect(snapshot.canRefreshWorkspace).toBe(true);
    expect(snapshot.statusLabel).toBe('ok · allowed');
    expect(snapshot.auditLabel).toBe('audit events: 2');
    expect(snapshot.persistenceMode).toBe('manual-runtime-snapshot');
  });

  it('marks domain blocked runtime actions as blocked and not refreshable', () => {
    const snapshot = buildP7DealWorkspaceRuntimeRefreshSnapshot({
      dealId: 'DL-SNAPSHOT-2',
      intentId: 'request_bank_basis',
      ok: false,
      status: 'domain_blocked',
      duplicate: false,
      auditPayloadCount: 0,
    });

    expect(snapshot.state).toBe('blocked');
    expect(snapshot.canRefreshWorkspace).toBe(false);
    expect(snapshot.nextVisibleStep).toContain('Обновить карточку сделки');
  });

  it('exposes child-readable snapshot state labels', () => {
    expect(p7RuntimeSnapshotStateText('updated')).toBe('состояние обновлено');
    expect(p7RuntimeSnapshotStateText('blocked')).toBe('действие заблокировано');
    expect(p7RuntimeSnapshotStateText('duplicate')).toBe('повтор не применён');
    expect(p7RuntimeSnapshotStateText('failed')).toBe('действие не выполнено');
  });
});
