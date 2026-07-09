export type P7DealWorkspaceRuntimeIntentId = 'request_bank_basis' | 'start_document_review' | 'open_dispute';
export type P7DealWorkspaceRuntimeIntentTone = 'primary' | 'secondary' | 'danger';

export interface P7DealWorkspaceRuntimeIntent {
  readonly id: P7DealWorkspaceRuntimeIntentId;
  readonly label: string;
  readonly loadingLabel: string;
  readonly successLabel: string;
  readonly tone: P7DealWorkspaceRuntimeIntentTone;
  readonly blocked: boolean;
  readonly blockedReason: string | null;
  readonly safeReason: string;
}

export interface P7DealWorkspaceRuntimeIntentContext {
  readonly dealId: string;
  readonly bankBasisAmount: number;
  readonly bankBasisBlocked: boolean;
  readonly bankBasisBlockedReason: string | null;
  readonly documentsBlocked: boolean;
  readonly disputeOpen: boolean;
}

export const P7_DEAL_WORKSPACE_RUNTIME_INTENT_LABELS: Record<P7DealWorkspaceRuntimeIntentId, string> = {
  request_bank_basis: 'Подготовить основание банку',
  start_document_review: 'Запустить проверку документов',
  open_dispute: 'Открыть спор',
};

export function buildP7DealWorkspaceRuntimeIntents(context: P7DealWorkspaceRuntimeIntentContext): readonly P7DealWorkspaceRuntimeIntent[] {
  const bankBasisBlocked = context.bankBasisBlocked || context.bankBasisAmount <= 0;
  const bankBasisBlockedReason = context.bankBasisBlockedReason ?? (context.bankBasisAmount <= 0 ? 'Нет положительной суммы для банковского основания.' : null);

  return [
    {
      id: 'request_bank_basis',
      label: P7_DEAL_WORKSPACE_RUNTIME_INTENT_LABELS.request_bank_basis,
      loadingLabel: 'Проверяю через runtime…',
      successLabel: 'Основание проведено через runtime',
      tone: 'primary',
      blocked: bankBasisBlocked,
      blockedReason: bankBasisBlocked ? bankBasisBlockedReason : null,
      safeReason: 'Запрос идёт через server action → application service → action boundary → idempotency → audit. UI не меняет деньги напрямую.',
    },
    {
      id: 'start_document_review',
      label: P7_DEAL_WORKSPACE_RUNTIME_INTENT_LABELS.start_document_review,
      loadingLabel: 'Создаю runtime-событие…',
      successLabel: 'Проверка документов запущена',
      tone: 'secondary',
      blocked: false,
      blockedReason: null,
      safeReason: 'Документное действие проходит через document application service и audit boundary.',
    },
    {
      id: 'open_dispute',
      label: context.disputeOpen ? 'Открыть ещё один спор нельзя' : P7_DEAL_WORKSPACE_RUNTIME_INTENT_LABELS.open_dispute,
      loadingLabel: 'Открываю спор…',
      successLabel: 'Спор зафиксирован в runtime',
      tone: 'danger',
      blocked: context.disputeOpen,
      blockedReason: context.disputeOpen ? 'По сделке уже есть открытый спор.' : null,
      safeReason: 'Спор фиксируется как отдельный контур, который блокирует деньги и требует доказательств.',
    },
  ];
}

export function p7DealWorkspaceRuntimeIntentById(
  intents: readonly P7DealWorkspaceRuntimeIntent[],
  id: P7DealWorkspaceRuntimeIntentId,
): P7DealWorkspaceRuntimeIntent {
  const intent = intents.find((item) => item.id === id);
  if (!intent) throw new Error(`Unknown deal workspace runtime intent: ${id}`);
  return intent;
}
