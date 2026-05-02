import type { CanonicalDeal } from './types';

export type ReleaseGuardBlocker =
  | 'NO_RESERVED_MONEY'
  | 'NO_RELEASE_AMOUNT'
  | 'OPEN_DISPUTE'
  | 'DOCUMENTS_NOT_READY'
  | 'MANUAL_BLOCKER'
  | 'DEAL_NOT_READY';

export interface ReleaseGuardResult {
  readonly canRequestRelease: boolean;
  readonly canExecuteRelease: boolean;
  readonly blockers: readonly ReleaseGuardBlocker[];
  readonly releaseAmount: number;
  readonly reservedAmount: number;
}

const releaseReadyStatuses = new Set<CanonicalDeal['status']>([
  'DOCUMENTS_COMPLETE',
  'RELEASE_PENDING',
]);

function hasDocumentStop(deal: CanonicalDeal): boolean {
  return deal.documents.some((document) => document.blocksMoneyRelease && document.status !== 'verified' && document.status !== 'signed');
}

function hasManualBlocker(deal: CanonicalDeal): boolean {
  return deal.blockers.length > 0;
}

export function evaluateReleaseGuard(deal: CanonicalDeal): ReleaseGuardResult {
  const blockers: ReleaseGuardBlocker[] = [];

  if (deal.money.reservedAmount <= 0) blockers.push('NO_RESERVED_MONEY');
  if (deal.money.releaseAmount <= 0) blockers.push('NO_RELEASE_AMOUNT');
  if (deal.dispute || deal.status === 'DISPUTED') blockers.push('OPEN_DISPUTE');
  if (hasDocumentStop(deal)) blockers.push('DOCUMENTS_NOT_READY');
  if (hasManualBlocker(deal)) blockers.push('MANUAL_BLOCKER');
  if (!releaseReadyStatuses.has(deal.status)) blockers.push('DEAL_NOT_READY');

  const canRequestRelease = blockers.length === 0;
  const canExecuteRelease = canRequestRelease && deal.status === 'RELEASE_PENDING';

  return {
    canRequestRelease,
    canExecuteRelease,
    blockers,
    releaseAmount: deal.money.releaseAmount,
    reservedAmount: deal.money.reservedAmount,
  };
}
