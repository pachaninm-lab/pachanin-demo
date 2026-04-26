import { CALLBACKS, DEALS, type CallbackItem, type Deal } from './data';
import { buildMoneySafetyAuditRow, type P7MoneySafetyAuditRow } from '../platform-v7/money-safety-audit';
import { appendMoneyEventOnce, type P7LedgerEntry, type P7MoneyEvent } from '../platform-v7/money-safety';

const MONEY_AUDIT_CALLBACKS: CallbackItem[] = [
  ...CALLBACKS,
  {
    id: 'CB-E7-OK-001',
    type: 'Release',
    dealId: 'DL-9116',
    status: 'ok',
    note: 'E7 controlled callback: release confirmed for clean audit row',
    amountRub: 21_000_000,
  },
];

function moneyEventFromDeal(deal: Deal, callback?: CallbackItem): P7MoneyEvent {
  const amount = callback?.amountRub ?? deal.reservedAmount;

  return {
    dealId: deal.id,
    eventId: callback?.id ?? `${deal.id}-reserve-confirmed`,
    type: callback?.type === 'Release' ? 'release_confirmed' : 'reserve_confirmed',
    amount,
    provider: 'sber_safe_deals',
    providerOperationId: callback?.id ?? `${deal.id}-reserve`,
    occurredAt: '2026-04-26T12:00:00Z',
    payloadHash: `${deal.id}:${callback?.id ?? 'reserve'}:${amount}`,
  };
}

function createLedgerEntry(event: P7MoneyEvent): P7LedgerEntry[] {
  const result = appendMoneyEventOnce([], event, {
    at: () => '2026-04-26T12:02:00Z',
  });

  return result.status === 'accepted' ? result.ledger : [];
}

function docsComplete(deal: Deal): boolean {
  return deal.status === 'docs_complete' || deal.status === 'release_requested' || deal.status === 'release_approved' || deal.status === 'closed';
}

function hasOpenDispute(deal: Deal): boolean {
  return Boolean(deal.dispute) || deal.status === 'quality_disputed' || deal.blockers.includes('dispute');
}

function hasBankCallback(deal: Deal, callback?: CallbackItem): boolean {
  if (callback?.status === 'ok') return true;
  if (callback?.status === 'mismatch') return true;
  return deal.status === 'release_approved' || deal.status === 'closed';
}

function latestBankEventForDeal(deal: Deal, callback?: CallbackItem): P7MoneyEvent | undefined {
  if (!callback) return undefined;
  const baseEvent = moneyEventFromDeal(deal, callback);

  if (callback.status === 'mismatch') {
    return {
      ...baseEvent,
      amount: Math.max(baseEvent.amount - 3_000, 1),
      occurredAt: '2026-04-26T12:05:00Z',
    };
  }

  return baseEvent;
}

function ledgerForDeal(deal: Deal, callback?: CallbackItem): P7LedgerEntry[] {
  if (!callback) return [];
  const event = moneyEventFromDeal(deal, callback);
  return createLedgerEntry(event);
}

function selectedDealsForMoneyAudit(): Deal[] {
  const priorityIds = new Set(['DL-9109', 'DL-9115', 'DL-9110']);
  const priorityDeals = DEALS.filter((deal) => priorityIds.has(deal.id));
  const releaseDeals = DEALS.filter((deal) => deal.status === 'release_requested' && !priorityIds.has(deal.id));
  const blockedDeals = DEALS.filter((deal) => deal.blockers.length > 0 && !priorityIds.has(deal.id));

  return [...priorityDeals, ...releaseDeals, ...blockedDeals].slice(0, 6);
}

export function buildV7rMoneySafetyAuditRows(): P7MoneySafetyAuditRow[] {
  return selectedDealsForMoneyAudit().map((deal) => {
    const callback = MONEY_AUDIT_CALLBACKS.find((item) => item.dealId === deal.id);
    const requestedAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);

    return buildMoneySafetyAuditRow({
      dealId: deal.id,
      reservedAmount: deal.reservedAmount,
      holdAmount: deal.holdAmount,
      requestedAmount,
      docsComplete: docsComplete(deal),
      bankCallbackConfirmed: hasBankCallback(deal, callback),
      disputeOpen: hasOpenDispute(deal),
      transportGateClear: !deal.blockers.includes('transport'),
      fgisGateClear: !deal.blockers.includes('fgis'),
      releaseRequestId: `${deal.id}-release`,
      existingReleaseIds: deal.status === 'closed' ? [`${deal.id}-release-confirmed`] : [],
      ledger: ledgerForDeal(deal, callback),
      latestBankEvent: latestBankEventForDeal(deal, callback),
    });
  });
}
