import type { P7DealWorkspaceRuntimeIntentId } from './deal-workspace-runtime-intents';

export type P7DealWorkspaceRuntimeSnapshotState = 'updated' | 'blocked' | 'duplicate' | 'failed';

export interface P7DealWorkspaceRuntimeRefreshSnapshot {
  readonly dealId: string;
  readonly intentId: P7DealWorkspaceRuntimeIntentId;
  readonly state: P7DealWorkspaceRuntimeSnapshotState;
  readonly title: string;
  readonly statusLabel: string;
  readonly nextVisibleStep: string;
  readonly auditLabel: string;
  readonly persistenceMode: 'manual-runtime-snapshot';
  readonly canRefreshWorkspace: boolean;
}

export interface P7DealWorkspaceRuntimeRefreshSnapshotInput {
  readonly dealId: string;
  readonly intentId: P7DealWorkspaceRuntimeIntentId;
  readonly ok: boolean;
  readonly status: string;
  readonly duplicate: boolean;
  readonly auditPayloadCount: number;
  readonly boundaryStatus?: string;
}

const INTENT_TITLES: Record<P7DealWorkspaceRuntimeIntentId, string> = {
  request_bank_basis: 'Банковское основание',
  start_document_review: 'Документная проверка',
  open_dispute: 'Спор',
};

const INTENT_NEXT_STEPS: Record<P7DealWorkspaceRuntimeIntentId, string> = {
  request_bank_basis: 'Обновить карточку сделки и проверить деньги, документы, спор и audit trail.',
  start_document_review: 'Вернуться к документам сделки и закрыть недостающие основания.',
  open_dispute: 'Перейти в спор, собрать доказательства и удержать спорную часть до решения.',
};

export function buildP7DealWorkspaceRuntimeRefreshSnapshot(input: P7DealWorkspaceRuntimeRefreshSnapshotInput): P7DealWorkspaceRuntimeRefreshSnapshot {
  const state: P7DealWorkspaceRuntimeSnapshotState = input.duplicate ? 'duplicate' : input.ok ? 'updated' : input.status === 'domain_blocked' ? 'blocked' : 'failed';
  const statusLabel = input.boundaryStatus ? `${input.status} · ${input.boundaryStatus}` : input.status;

  return {
    dealId: input.dealId,
    intentId: input.intentId,
    state,
    title: INTENT_TITLES[input.intentId],
    statusLabel,
    nextVisibleStep: INTENT_NEXT_STEPS[input.intentId],
    auditLabel: input.auditPayloadCount > 0 ? `audit events: ${input.auditPayloadCount}` : 'audit events: 0',
    persistenceMode: 'manual-runtime-snapshot',
    canRefreshWorkspace: input.ok && !input.duplicate,
  };
}

export function p7RuntimeSnapshotStateText(state: P7DealWorkspaceRuntimeSnapshotState): string {
  if (state === 'updated') return 'состояние обновлено';
  if (state === 'duplicate') return 'повтор не применён';
  if (state === 'blocked') return 'действие заблокировано';
  return 'действие не выполнено';
}
