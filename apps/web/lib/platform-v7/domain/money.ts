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

export function calculateDealMoneyAtRisk(deal: Pick<CanonicalDeal, 'money' | 'dispute' | 'blockers' | 'status'>): MoneyAmount {
  if (deal.status === 'DISPUTED') {
    return deal.money.holdAmount || deal.dispute?.amountAtRisk || 0;
  }

  if (deal.blockers.some((blocker) => blocker.includes('bank') || blocker.includes('release'))) {
    return Math.max(deal.money.holdAmount, deal.money.releaseAmount);
  }

  return deal.money.holdAmount;
}

export function calculateMoneyTree(deals: readonly CanonicalDeal[]): MoneyTree {
  const reservedAmount = deals.reduce((sum, deal) => sum + deal.money.reservedAmount, 0);
  const readyDeals = deals.filter((deal) => deal.money.releaseAmount > 0 && deal.money.holdAmount === 0 && deal.blockers.length === 0 && !deal.dispute);
  const heldDeals = deals.filter((deal) => deal.money.holdAmount > 0);
  const disputeDeals = deals.filter((deal) => Boolean(deal.dispute));
  const documentBlockedDeals = deals.filter((deal) => deal.documents.some((doc) => doc.blocksMoneyRelease && doc.status !== 'verified' && doc.status !== 'signed'));
  const manualReviewDeals = deals.filter((deal) => deal.blockers.some((blocker) => blocker.includes('bank') || blocker.includes('review')));

  const readyToRelease = readyDeals.reduce((sum, deal) => sum + Math.min(deal.money.releaseAmount, deal.money.reservedAmount), 0);
  const held = heldDeals.reduce((sum, deal) => sum + deal.money.holdAmount, 0);
  const blockedByDispute = disputeDeals.reduce((sum, deal) => sum + Math.max(deal.money.holdAmount, deal.dispute?.amountAtRisk ?? 0), 0);
  const blockedByDocuments = documentBlockedDeals.reduce((sum, deal) => sum + Math.max(0, deal.money.reservedAmount - deal.money.releaseAmount - deal.money.holdAmount), 0);
  const manualReview = manualReviewDeals.reduce((sum, deal) => sum + Math.max(0, deal.money.releaseAmount || deal.money.holdAmount), 0);

  const counted = readyToRelease + held + blockedByDispute + blockedByDocuments + manualReview;
  const remainder = Math.max(0, reservedAmount - counted);

  const reserved: MoneyTreeNode = {
    key: 'reserved',
    label: 'Всего в резерве',
    amount: reservedAmount,
    formula: 'Всего в резерве = сумма reservedAmount по сделкам',
    dealIds: deals.map((deal) => deal.id),
  };

  const parts: MoneyTreeNode[] = [
    {
      key: 'readyToRelease',
      label: 'К выпуску',
      amount: readyToRelease,
      formula: 'К выпуску = releaseAmount по сделкам без удержаний, споров и причин остановки',
      dealIds: readyDeals.map((deal) => deal.id),
    },
    {
      key: 'held',
      label: 'Удержано',
      amount: held,
      formula: 'Удержано = holdAmount по сделкам',
      dealIds: heldDeals.map((deal) => deal.id),
    },
    {
      key: 'blockedByDispute',
      label: 'Заблокировано спором',
      amount: blockedByDispute,
      formula: 'Заблокировано спором = max(holdAmount, dispute.amountAtRisk) по сделкам со спором',
      dealIds: disputeDeals.map((deal) => deal.id),
    },
    {
      key: 'blockedByDocuments',
      label: 'Заблокировано документами',
      amount: blockedByDocuments,
      formula: 'Заблокировано документами = остаток резерва по сделкам с документами, блокирующими выпуск денег',
      dealIds: documentBlockedDeals.map((deal) => deal.id),
    },
    {
      key: 'manualReview',
      label: 'На ручной проверке банка',
      amount: manualReview,
      formula: 'На ручной проверке банка = releaseAmount или holdAmount по сделкам с банковской причиной остановки',
      dealIds: manualReviewDeals.map((deal) => deal.id),
    },
    {
      key: 'notReady',
      label: 'Недоступно к выпуску',
      amount: remainder,
      formula: 'Недоступно к выпуску = резерв минус уже разложенные части MoneyTree',
      dealIds: deals.filter((deal) => !readyDeals.includes(deal) && !heldDeals.includes(deal) && !disputeDeals.includes(deal) && !documentBlockedDeals.includes(deal) && !manualReviewDeals.includes(deal)).map((deal) => deal.id),
    },
  ];

  return {
    reserved,
    parts,
    remainder,
    isBalanced: parts.reduce((sum, part) => sum + part.amount, 0) === reservedAmount,
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
