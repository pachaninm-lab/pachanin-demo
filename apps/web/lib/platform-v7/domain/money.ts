import type { CanonicalDeal, MoneyAmount, MoneyState } from './types';

export type MoneyEventType =
  | 'RESERVE_REQUESTED'
  | 'RESERVE_CONFIRMED'
  | 'HOLD_CREATED'
  | 'HOLD_UPDATED'
  | 'RELEASE_REQUESTED'
  | 'PARTIAL_RELEASE_EXECUTED'
  | 'FINAL_RELEASE_EXECUTED'
  | 'REFUND_REQUESTED'
  | 'REFUND_EXECUTED'
  | 'BANK_REJECTED'
  | 'MANUAL_REVIEW'
  | 'RECONCILIATION_MISMATCH'
  | 'COMMISSION_ACCRUED';

export interface MoneyEvent {
  readonly id: string;
  readonly dealId: string;
  readonly type: MoneyEventType;
  readonly amount: MoneyAmount;
  readonly at: string;
  readonly actor: string;
  readonly operationId?: string;
  readonly bankReference?: string;
  readonly reason?: string;
}

export interface MoneyKpi {
  readonly totalGmv: MoneyAmount;
  readonly totalReserved: MoneyAmount;
  readonly totalHold: MoneyAmount;
  readonly totalReleaseRequested: MoneyAmount;
  readonly totalRefund: MoneyAmount;
  readonly moneyAtRisk: MoneyAmount;
  readonly dealsWithOpenDisputes: number;
  readonly dealsBlockedByMoney: number;
}

export interface MoneyTreeNode {
  readonly key: 'reserved' | 'readyToRelease' | 'held' | 'blockedByDispute' | 'blockedByDocuments' | 'manualReview' | 'notReady';
  readonly label: string;
  readonly amount: MoneyAmount;
  readonly formula: string;
  readonly dealIds: readonly string[];
}

export interface MoneyTree {
  readonly reserved: MoneyTreeNode;
  readonly parts: readonly MoneyTreeNode[];
  readonly remainder: MoneyAmount;
  readonly isBalanced: boolean;
}

type MoneyTreeBucketKey = Exclude<MoneyTreeNode['key'], 'reserved'>;

const MONEY_TREE_LABELS: Record<MoneyTreeBucketKey, string> = {
  readyToRelease: 'К выпуску',
  held: 'Удержано',
  blockedByDispute: 'Заблокировано спором',
  blockedByDocuments: 'Заблокировано документами',
  manualReview: 'На ручной проверке банка',
  notReady: 'Недоступно к выпуску',
};

const MONEY_TREE_FORMULAS: Record<MoneyTreeBucketKey, string> = {
  readyToRelease: 'К выпуску = часть резерва по сделкам без удержаний, споров и причин остановки',
  held: 'Удержано = часть резерва по сделкам с удержанием',
  blockedByDispute: 'Заблокировано спором = часть резерва по сделкам со спором',
  blockedByDocuments: 'Заблокировано документами = часть резерва по сделкам с документами, блокирующими выпуск денег',
  manualReview: 'На ручной проверке банка = часть резерва по сделкам с банковской ручной проверкой',
  notReady: 'Недоступно к выпуску = остаток резерва, который ещё не готов к выпуску',
};

export function calculateDealMoneyAtRisk(deal: Pick<CanonicalDeal, 'money' | 'dispute' | 'blockers' | 'status'>): MoneyAmount {
  if (deal.status === 'DISPUTED') {
    return deal.money.holdAmount || deal.dispute?.amountAtRisk || 0;
  }

  if (deal.blockers.some((blocker) => blocker.includes('bank') || blocker.includes('release'))) {
    return Math.max(deal.money.holdAmount, deal.money.releaseAmount);
  }

  return deal.money.holdAmount;
}

function hasDocumentReleaseBlocker(deal: CanonicalDeal): boolean {
  return deal.documents.some((doc) => doc.blocksMoneyRelease && doc.status !== 'verified' && doc.status !== 'signed');
}

function hasManualBankReview(deal: CanonicalDeal): boolean {
  return deal.blockers.some((blocker) => blocker.includes('bank') || blocker.includes('review'));
}

function resolveMoneyTreeBucket(deal: CanonicalDeal): MoneyTreeBucketKey {
  if (deal.dispute || deal.status === 'DISPUTED') return 'blockedByDispute';
  if (hasDocumentReleaseBlocker(deal)) return 'blockedByDocuments';
  if (hasManualBankReview(deal)) return 'manualReview';
  if (deal.money.holdAmount > 0) return 'held';
  if (deal.money.releaseAmount > 0 && deal.blockers.length === 0) return 'readyToRelease';
  return 'notReady';
}

export function calculateMoneyTree(deals: readonly CanonicalDeal[]): MoneyTree {
  const reservedAmount = deals.reduce((sum, deal) => sum + deal.money.reservedAmount, 0);
  const buckets = new Map<MoneyTreeBucketKey, { amount: MoneyAmount; dealIds: string[] }>(
    (Object.keys(MONEY_TREE_LABELS) as MoneyTreeBucketKey[]).map((key) => [key, { amount: 0, dealIds: [] }]),
  );

  for (const deal of deals) {
    const key = resolveMoneyTreeBucket(deal);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.amount += deal.money.reservedAmount;
    bucket.dealIds.push(deal.id);
  }

  const reserved: MoneyTreeNode = {
    key: 'reserved',
    label: 'Всего в резерве',
    amount: reservedAmount,
    formula: 'Всего в резерве = сумма reservedAmount по сделкам',
    dealIds: deals.map((deal) => deal.id),
  };

  const parts: MoneyTreeNode[] = (Object.keys(MONEY_TREE_LABELS) as MoneyTreeBucketKey[]).map((key) => {
    const bucket = buckets.get(key) ?? { amount: 0, dealIds: [] };
    return {
      key,
      label: MONEY_TREE_LABELS[key],
      amount: bucket.amount,
      formula: MONEY_TREE_FORMULAS[key],
      dealIds: bucket.dealIds,
    };
  });

  const partsTotal = parts.reduce((sum, part) => sum + part.amount, 0);

  return {
    reserved,
    parts,
    remainder: Math.max(0, reservedAmount - partsTotal),
    isBalanced: partsTotal === reservedAmount,
  };
}

export function calculateMoneyStateFromEvents(events: readonly MoneyEvent[]): MoneyState {
  return events.reduce<MoneyState>(
    (state, event) => {
      switch (event.type) {
        case 'RESERVE_CONFIRMED':
          return { ...state, reservedAmount: state.reservedAmount + event.amount, totalAmount: Math.max(state.totalAmount, event.amount) };
        case 'HOLD_CREATED':
        case 'HOLD_UPDATED':
          return { ...state, holdAmount: event.amount };
        case 'RELEASE_REQUESTED':
          return { ...state, releaseAmount: event.amount };
        case 'PARTIAL_RELEASE_EXECUTED':
        case 'FINAL_RELEASE_EXECUTED':
          return { ...state, releaseAmount: Math.max(0, state.releaseAmount - event.amount), reservedAmount: Math.max(0, state.reservedAmount - event.amount) };
        case 'REFUND_EXECUTED':
          return { ...state, refundAmount: (state.refundAmount ?? 0) + event.amount, reservedAmount: Math.max(0, state.reservedAmount - event.amount) };
        case 'COMMISSION_ACCRUED':
          return { ...state, commissionAmount: (state.commissionAmount ?? 0) + event.amount };
        default:
          return state;
      }
    },
    { totalAmount: 0, reservedAmount: 0, holdAmount: 0, releaseAmount: 0, refundAmount: 0, commissionAmount: 0 },
  );
}

export function calculateMoneyKpi(deals: readonly CanonicalDeal[]): MoneyKpi {
  return deals.reduce<MoneyKpi>(
    (kpi, deal) => {
      const moneyAtRisk = calculateDealMoneyAtRisk(deal);
      const isMoneyBlocked = deal.blockers.some((blocker) => blocker.includes('bank') || blocker.includes('release'));

      return {
        totalGmv: kpi.totalGmv + deal.money.totalAmount,
        totalReserved: kpi.totalReserved + deal.money.reservedAmount,
        totalHold: kpi.totalHold + deal.money.holdAmount,
        totalReleaseRequested: kpi.totalReleaseRequested + deal.money.releaseAmount,
        totalRefund: kpi.totalRefund + (deal.money.refundAmount ?? 0),
        moneyAtRisk: kpi.moneyAtRisk + moneyAtRisk,
        dealsWithOpenDisputes: kpi.dealsWithOpenDisputes + (deal.status === 'DISPUTED' ? 1 : 0),
        dealsBlockedByMoney: kpi.dealsBlockedByMoney + (isMoneyBlocked ? 1 : 0),
      };
    },
    {
      totalGmv: 0,
      totalReserved: 0,
      totalHold: 0,
      totalReleaseRequested: 0,
      totalRefund: 0,
      moneyAtRisk: 0,
      dealsWithOpenDisputes: 0,
      dealsBlockedByMoney: 0,
    },
  );
}
