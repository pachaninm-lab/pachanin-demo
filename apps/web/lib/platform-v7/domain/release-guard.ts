import type { CanonicalDeal, DocumentRef } from './types';

export type ReleaseGuardBlocker =
  | 'NO_RESERVED_MONEY'
  | 'NO_RELEASE_AMOUNT'
  | 'HOLD_AMOUNT_ACTIVE'
  | 'OPEN_DISPUTE'
  | 'DOCUMENTS_NOT_READY'
  | 'FGIS_NOT_READY'
  | 'TRANSPORT_NOT_READY'
  | 'ACCEPTANCE_NOT_CONFIRMED'
  | 'QUALITY_NOT_APPROVED'
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

const transportReadyStatuses = new Set<CanonicalDeal['status']>([
  'ACCEPTED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_COMPLETE',
  'RELEASE_PENDING',
  'PARTIAL_RELEASED',
  'FINAL_RELEASED',
  'CLOSED',
]);

const acceptanceReadyStatuses = new Set<CanonicalDeal['status']>([
  'ACCEPTED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_COMPLETE',
  'RELEASE_PENDING',
  'PARTIAL_RELEASED',
  'FINAL_RELEASED',
  'CLOSED',
]);

const qualityReadyStatuses = new Set<CanonicalDeal['status']>([
  'ACCEPTED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_COMPLETE',
  'RELEASE_PENDING',
  'PARTIAL_RELEASED',
  'FINAL_RELEASED',
  'CLOSED',
]);

function hasDocumentStop(deal: CanonicalDeal): boolean {
  return deal.documents.some((document) => document.blocksMoneyRelease && !isDocumentReady(document));
}

function isDocumentReady(document: DocumentRef): boolean {
  return document.status === 'verified' || document.status === 'signed';
}

function hasManualBlocker(deal: CanonicalDeal): boolean {
  return deal.blockers.length > 0;
}

function normalizedBlockers(deal: CanonicalDeal): string[] {
  return deal.blockers.map((blocker) => blocker.trim().toLowerCase());
}

function hasFgisStop(deal: CanonicalDeal): boolean {
  const blockers = normalizedBlockers(deal);
  const hasFgisBlocker = blockers.some((blocker) => blocker.includes('fgis') || blocker.includes('фгис') || blocker.includes('sdiz') || blocker.includes('сдиз'));
  const hasFgisDocumentStop = deal.documents.some((document) => {
    const name = document.name.toLowerCase();
    return (name.includes('фгис') || name.includes('fgis') || name.includes('сдиз') || name.includes('sdiz')) && !isDocumentReady(document);
  });

  return hasFgisBlocker || hasFgisDocumentStop;
}

function hasTransportStop(deal: CanonicalDeal): boolean {
  const blockers = normalizedBlockers(deal);
  if (blockers.some((blocker) => blocker.includes('transport') || blocker.includes('логист') || blocker.includes('рейс') || blocker.includes('этрн'))) return true;
  return !transportReadyStatuses.has(deal.status);
}

function hasAcceptanceStop(deal: CanonicalDeal): boolean {
  const blockers = normalizedBlockers(deal);
  if (blockers.some((blocker) => blocker.includes('acceptance') || blocker.includes('прием') || blocker.includes('приём') || blocker.includes('вес'))) return true;
  return !acceptanceReadyStatuses.has(deal.status);
}

function hasQualityStop(deal: CanonicalDeal): boolean {
  const blockers = normalizedBlockers(deal);
  if (blockers.some((blocker) => blocker.includes('quality') || blocker.includes('lab') || blocker.includes('лаборатор') || blocker.includes('качест'))) return true;
  return !qualityReadyStatuses.has(deal.status);
}

export function evaluateReleaseGuard(deal: CanonicalDeal): ReleaseGuardResult {
  const blockers: ReleaseGuardBlocker[] = [];

  if (deal.money.reservedAmount <= 0) blockers.push('NO_RESERVED_MONEY');
  if (deal.money.releaseAmount <= 0) blockers.push('NO_RELEASE_AMOUNT');
  if (deal.money.holdAmount > 0) blockers.push('HOLD_AMOUNT_ACTIVE');
  if (deal.dispute || deal.status === 'DISPUTED') blockers.push('OPEN_DISPUTE');
  if (hasDocumentStop(deal) || deal.status === 'DOCUMENTS_PENDING') blockers.push('DOCUMENTS_NOT_READY');
  if (hasFgisStop(deal)) blockers.push('FGIS_NOT_READY');
  if (hasTransportStop(deal)) blockers.push('TRANSPORT_NOT_READY');
  if (hasAcceptanceStop(deal)) blockers.push('ACCEPTANCE_NOT_CONFIRMED');
  if (hasQualityStop(deal)) blockers.push('QUALITY_NOT_APPROVED');
  if (hasManualBlocker(deal)) blockers.push('MANUAL_BLOCKER');
  if (!releaseReadyStatuses.has(deal.status)) blockers.push('DEAL_NOT_READY');

  const uniqueBlockers = [...new Set(blockers)];
  const canRequestRelease = uniqueBlockers.length === 0;
  const canExecuteRelease = canRequestRelease && deal.status === 'RELEASE_PENDING';

  return {
    canRequestRelease,
    canExecuteRelease,
    blockers: uniqueBlockers,
    releaseAmount: deal.money.releaseAmount,
    reservedAmount: deal.money.reservedAmount,
  };
}
