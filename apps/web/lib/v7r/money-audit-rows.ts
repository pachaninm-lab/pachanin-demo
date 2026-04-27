import { buildMoneySafetyAuditRow, type P7MoneySafetyAuditRow } from '../platform-v7/money-safety-audit';
import { appendMoneyEventOnce, type P7LedgerEntry, type P7MoneyEvent } from '../platform-v7/money-safety';

function eventFor(dealId: string, amount: number): P7MoneyEvent {
  return {
    dealId,
    eventId: `${dealId}-bank-event`,
    type: 'release_confirmed',
    amount,
    provider: 'sber_safe_deals',
    providerOperationId: `${dealId}-bank-operation`,
    occurredAt: '2026-04-26T12:00:00Z',
    payloadHash: `${dealId}:${amount}`,
  };
}

function ledgerFor(event: P7MoneyEvent): P7LedgerEntry[] {
  const result = appendMoneyEventOnce([], event, {
    at: () => '2026-04-26T12:02:00Z',
  });

  return result.status === 'accepted' ? result.ledger : [];
}

export function buildStableV7rMoneySafetyAuditRows(): P7MoneySafetyAuditRow[] {
  const safeEvent = eventFor('DL-9109', 10_500_000);
  const reviewEvent = eventFor('DL-9115', 2_470_000);

  return [
    buildMoneySafetyAuditRow({
      dealId: 'DL-9109',
      reservedAmount: 10_500_000,
      holdAmount: 0,
      requestedAmount: 10_500_000,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
      releaseRequestId: 'DL-9109-release',
      ledger: ledgerFor(safeEvent),
      latestBankEvent: safeEvent,
    }),
    buildMoneySafetyAuditRow({
      dealId: 'DL-9112',
      reservedAmount: 13_860_000,
      holdAmount: 500_000,
      requestedAmount: 13_360_000,
      docsComplete: false,
      bankCallbackConfirmed: false,
      disputeOpen: true,
      transportGateClear: false,
      fgisGateClear: true,
      releaseRequestId: 'DL-9112-release',
    }),
    buildMoneySafetyAuditRow({
      dealId: 'DL-9115',
      reservedAmount: 2_470_000,
      holdAmount: 0,
      requestedAmount: 2_470_000,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
      releaseRequestId: 'DL-9115-release',
      ledger: ledgerFor(reviewEvent),
      latestBankEvent: {
        ...reviewEvent,
        amount: 2_467_000,
        occurredAt: '2026-04-26T12:05:00Z',
      },
    }),
  ];
}
