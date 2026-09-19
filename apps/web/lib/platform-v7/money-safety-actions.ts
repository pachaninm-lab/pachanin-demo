import { runPlatformAction, type PlatformActionRunnerResult } from './action-runner';
import { P7_RECONCILIATION_LABELS, type P7MoneyReconciliationDecision } from './money-safety';

export interface P7MoneyReconciliationActionResult {
  readonly dealId: string;
  readonly decision: P7MoneyReconciliationDecision;
  readonly nextOwner: 'bank_operator' | 'release_operator';
  readonly nextAction: string;
  readonly releaseBlocked: boolean;
}

export interface P7MoneyReconciliationActionInput {
  readonly dealId: string;
  readonly decision: P7MoneyReconciliationDecision;
  readonly actor?: string;
  readonly at?: () => string;
}

function getNextAction(decision: P7MoneyReconciliationDecision): string {
  if (decision.state === 'matched') return 'Callback совпадает с ledger. Выпуск можно проверять по release guard.';
  return `Остановить release и провести ручную сверку: ${P7_RECONCILIATION_LABELS[decision.reasonCode]}.`;
}

export async function openMoneyReconciliationAction(input: P7MoneyReconciliationActionInput): Promise<PlatformActionRunnerResult<P7MoneyReconciliationActionResult>> {
  return runPlatformAction<P7MoneyReconciliationActionResult>({
    scope: 'bank',
    objectId: input.dealId,
    action: input.decision.state === 'matched' ? 'money-reconciliation-matched' : 'money-reconciliation-manual-review',
    actor: input.actor ?? 'operator',
    loadingMessage: `Сверка банкового события по ${input.dealId} начата`,
    successMessage: (result) => result.releaseBlocked
      ? `Release заблокирован: ${result.nextAction}`
      : `Сверка закрыта: ${result.nextAction}`,
    errorMessage: (error) => error instanceof Error ? `Сверка не выполнена: ${error.message}` : 'Сверка не выполнена',
    run: async () => ({
      dealId: input.dealId,
      decision: input.decision,
      nextOwner: input.decision.state === 'matched' ? 'release_operator' : 'bank_operator',
      nextAction: getNextAction(input.decision),
      releaseBlocked: input.decision.state === 'manual_review',
    }),
    at: input.at,
  });
}
