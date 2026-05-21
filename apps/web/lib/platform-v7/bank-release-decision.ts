import type { PlatformV7BankLedgerEntry } from './bank-ledger';
import {
  platformV7BankManualReviewModel,
  type PlatformV7BankManualReviewModel,
} from './bank-manual-review';
import {
  platformV7BankReconciliationAllowsRelease,
  platformV7BankReconciliationModel,
  type PlatformV7BankReconciliationModel,
} from './bank-reconciliation';
import type { PlatformV7BankWebhookEvent } from './bank-webhooks';

export type PlatformV7BankReleaseDecisionStatus = 'release_allowed' | 'hold' | 'manual_review' | 'blocked';
export type PlatformV7BankReleaseDecisionTone = 'success' | 'warning' | 'danger';

export interface PlatformV7BankReleaseDecisionInput {
  dealId: string;
  ledgerEntries: PlatformV7BankLedgerEntry[];
  webhookEvents: PlatformV7BankWebhookEvent[];
  releaseAmount: number;
  releaseLimit: number;
  documentPackReady: boolean;
  bankContractReady: boolean;
  disputeOpen: boolean;
  amlFlag: boolean;
}

export interface PlatformV7BankReleaseDecisionModel {
  dealId: string;
  status: PlatformV7BankReleaseDecisionStatus;
  canRelease: boolean;
  blockerCount: number;
  reasons: string[];
  nextAction: string;
  tone: PlatformV7BankReleaseDecisionTone;
  reconciliation: PlatformV7BankReconciliationModel;
  manualReview: PlatformV7BankManualReviewModel;
}

export function platformV7BankReleaseDecisionModel(
  input: PlatformV7BankReleaseDecisionInput,
): PlatformV7BankReleaseDecisionModel {
  const reconciliation = platformV7BankReconciliationModel(
    input.dealId,
    input.ledgerEntries,
    input.webhookEvents,
  );
  const reconciliationAllowsRelease = platformV7BankReconciliationAllowsRelease(reconciliation);
  const manualReview = platformV7BankManualReviewModel({
    reconciliation,
    releaseAmount: input.releaseAmount,
    releaseLimit: input.releaseLimit,
    disputeOpen: input.disputeOpen,
    amlFlag: input.amlFlag,
  });

  const reasons: string[] = [];

  if (!Number.isFinite(input.releaseAmount) || input.releaseAmount <= 0) {
    reasons.push('Сумма release должна быть положительной.');
  }

  if (!input.bankContractReady) {
    reasons.push('Нет подтверждённого банкового договора или боевого доступа.');
  }

  if (!input.documentPackReady) {
    reasons.push('Неполный документный пакет блокирует выпуск денег.');
  }

  if (input.disputeOpen) {
    reasons.push('Открытый спор блокирует финальный выпуск денег.');
  }

  if (!reconciliationAllowsRelease) {
    reasons.push(reconciliation.mismatchReason ?? 'Банковая сверка не подтверждена.');
  }

  if (manualReview.requiresReview) {
    reasons.push(`Требуется ручная банковская проверка: ${manualReview.reasons.join(', ')}.`);
  }

  const uniqueReasons = [...new Set(reasons)];
  const status = platformV7BankReleaseDecisionStatus(input, reconciliationAllowsRelease, manualReview);
  const canRelease = status === 'release_allowed'
    && uniqueReasons.length === 0
    && reconciliationAllowsRelease
    && !manualReview.requiresReview;

  return {
    dealId: input.dealId,
    status,
    canRelease,
    blockerCount: uniqueReasons.length,
    reasons: uniqueReasons,
    nextAction: platformV7BankReleaseDecisionNextAction(status, uniqueReasons),
    tone: platformV7BankReleaseDecisionTone(status),
    reconciliation,
    manualReview,
  };
}

export function platformV7BankReleaseDecisionStatus(
  input: Pick<PlatformV7BankReleaseDecisionInput, 'bankContractReady' | 'documentPackReady' | 'disputeOpen' | 'releaseAmount'>,
  reconciliationAllowsRelease: boolean,
  manualReview: PlatformV7BankManualReviewModel,
): PlatformV7BankReleaseDecisionStatus {
  if (!Number.isFinite(input.releaseAmount) || input.releaseAmount <= 0) return 'blocked';
  if (!input.bankContractReady) return 'blocked';
  if (manualReview.requiresReview) return 'manual_review';
  if (!input.documentPackReady || input.disputeOpen || !reconciliationAllowsRelease) return 'hold';
  return 'release_allowed';
}

export function platformV7BankReleaseDecisionTone(
  status: PlatformV7BankReleaseDecisionStatus,
): PlatformV7BankReleaseDecisionTone {
  if (status === 'release_allowed') return 'success';
  if (status === 'blocked') return 'danger';
  return 'warning';
}

export function platformV7BankReleaseDecisionNextAction(
  status: PlatformV7BankReleaseDecisionStatus,
  reasons: string[],
): string {
  if (status === 'release_allowed') return 'Выпуск денег разрешён.';
  if (status === 'blocked') return reasons[0] ?? 'Остановить release до восстановления банкового контура.';
  if (status === 'manual_review') return 'Передать кейс в ручную банковскую проверку.';
  return reasons[0] ?? 'Удержать деньги до закрытия блокеров.';
}
