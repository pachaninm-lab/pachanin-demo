import { platformV7BankLedgerBlocksRelease, platformV7BankLedgerSummary, type PlatformV7BankLedgerEntry } from './bank-ledger';
import { platformV7BankWebhookSummary, type PlatformV7BankWebhookEvent } from './bank-webhooks';

export type PlatformV7BankReconciliationStatus = 'matched' | 'pending' | 'mismatch' | 'failed';

export interface PlatformV7BankReconciliationModel {
  dealId: string;
  status: PlatformV7BankReconciliationStatus;
  ledgerBalance: number;
  ledgerBlocksRelease: boolean;
  webhookBlocksReconciliation: boolean;
  pendingItems: number;
  failedItems: number;
  mismatchReason: string | null;
}

export function platformV7BankReconciliationModel(
  dealId: string,
  ledgerEntries: PlatformV7BankLedgerEntry[],
  webhookEvents: PlatformV7BankWebhookEvent[],
): PlatformV7BankReconciliationModel {
  const ledger = platformV7BankLedgerSummary(dealId, ledgerEntries);
  const webhooks = platformV7BankWebhookSummary(webhookEvents.filter((event) => event.dealId === dealId));
  const ledgerBlocksRelease = platformV7BankLedgerBlocksRelease(ledger);
  const pendingItems = ledger.pending + webhooks.pending + webhooks.retryable;
  const failedItems = ledger.failed + webhooks.rejected;

  let status: PlatformV7BankReconciliationStatus = 'matched';
  let mismatchReason: string | null = null;

  if (failedItems > 0) {
    status = 'failed';
    mismatchReason = 'Есть failed/rejected банковские события.';
  } else if (pendingItems > 0 || webhooks.blocksReconciliation) {
    status = 'pending';
    mismatchReason = 'Есть pending/retryable банковские события.';
  } else if (ledgerBlocksRelease) {
    status = 'mismatch';
    mismatchReason = 'Ledger не сбалансирован или блокирует release.';
  }

  return {
    dealId,
    status,
    ledgerBalance: ledger.balance,
    ledgerBlocksRelease,
    webhookBlocksReconciliation: webhooks.blocksReconciliation,
    pendingItems,
    failedItems,
    mismatchReason,
  };
}

export function platformV7BankReconciliationAllowsRelease(model: PlatformV7BankReconciliationModel): boolean {
  return model.status === 'matched' && !model.ledgerBlocksRelease && !model.webhookBlocksReconciliation;
}

export function platformV7BankReconciliationTone(
  model: PlatformV7BankReconciliationModel,
): 'success' | 'warning' | 'danger' {
  if (model.status === 'matched') return 'success';
  if (model.status === 'pending') return 'warning';
  return 'danger';
}
