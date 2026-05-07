import type {
  BatchReadiness,
  DocumentRequirement,
  LogisticsOrder,
  MoneyProjection,
  NextAction,
  SdizGate,
} from '../types';

type GuardReason = string | undefined;

export interface ExecutionActionGuardInput {
  readonly readiness?: BatchReadiness;
  readonly moneyProjection?: MoneyProjection;
  readonly documents?: readonly DocumentRequirement[];
  readonly sdizGates?: readonly SdizGate[];
  readonly logisticsOrder?: LogisticsOrder;
}

function withDisabledReason(action: NextAction, reason: string): NextAction {
  return {
    ...action,
    disabled: true,
    disabledReason: action.disabledReason ?? reason,
  };
}

function hasOpenMoneyDocument(documents: readonly DocumentRequirement[] = []): boolean {
  return documents.some(
    (document) =>
      document.required &&
      document.blocksMoneyRelease &&
      !['uploaded', 'signed', 'not_required'].includes(document.status),
  );
}

function hasOpenMoneySdiz(sdizGates: readonly SdizGate[] = []): boolean {
  return sdizGates.some(
    (gate) =>
      gate.required &&
      gate.blockingMoneyRelease &&
      !['signed', 'sent', 'redeemed', 'partially_redeemed', 'not_required'].includes(gate.status),
  );
}

function guardReason(action: NextAction, input: ExecutionActionGuardInput): GuardReason {
  if (action.disabled) return action.disabledReason ?? 'Действие закрыто до выполнения условий.';

  if (action.actionType === 'publish_lot') {
    if (!input.readiness) return 'Нет расчёта готовности партии.';
    if (input.readiness.status === 'blocked') return 'Партия заблокирована критичной причиной остановки.';
    if (input.readiness.score < 80) return 'Готовность партии ниже безопасного порога публикации.';
  }

  if (action.actionType === 'create_deal') {
    if (input.readiness && input.readiness.status === 'blocked') {
      return 'Нельзя создавать сделку, пока партия заблокирована.';
    }
  }

  if (action.actionType === 'assign_logistics') {
    if (!input.moneyProjection || input.moneyProjection.reservedAmount.value <= 0) {
      return 'Рейс нельзя назначить без подтверждённой денежной готовности.';
    }
  }

  if (action.actionType === 'approve_release') {
    if (!input.moneyProjection) return 'Нет расчётного состояния денег.';
    if (!input.moneyProjection.releaseAllowed) return 'Выпуск денег закрыт до снятия причин остановки.';
    if (hasOpenMoneyDocument(input.documents)) return 'Есть документ, который блокирует выпуск денег.';
    if (hasOpenMoneySdiz(input.sdizGates)) return 'Есть СДИЗ, который блокирует выпуск денег.';
  }

  if (action.actionType === 'capture_weight') {
    if (input.logisticsOrder && !['arrived', 'unloading', 'completed', 'incident'].includes(input.logisticsOrder.status)) {
      return 'Вес нельзя фиксировать до прибытия рейса на приёмку.';
    }
  }

  return undefined;
}

export function guardNextActionsForExecutionState(
  actions: readonly NextAction[],
  input: ExecutionActionGuardInput,
): NextAction[] {
  return actions.map((action) => {
    const reason = guardReason(action, input);
    return reason ? withDisabledReason(action, reason) : action;
  });
}
