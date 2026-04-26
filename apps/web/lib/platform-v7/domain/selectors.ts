import { calculateControlTowerKpi, calculateInvestorKpi } from './kpi';
import { calculateMoneyKpi } from './money';
import { normalizeLegacyDeals, type LegacyDealFixture } from './legacy-deal-adapter';
import type { CanonicalDeal } from './types';

export function selectCanonicalDealsFromLegacyFixtures(deals: readonly LegacyDealFixture[]): CanonicalDeal[] {
  return normalizeLegacyDeals(deals);
}

export function selectCanonicalControlTowerKpi(deals: readonly CanonicalDeal[]) {
  return calculateControlTowerKpi(deals);
}

export function selectCanonicalInvestorKpi(deals: readonly CanonicalDeal[]) {
  return calculateInvestorKpi(deals);
}

export function selectCanonicalMoneyKpi(deals: readonly CanonicalDeal[]) {
  return calculateMoneyKpi(deals);
}

export function selectDealReadinessFlags(deal: CanonicalDeal) {
  const hasBlockingDocuments = deal.documents.some((document) => document.blocksMoneyRelease);
  const hasBankBlocker = deal.blockers.some((blocker) => blocker.includes('bank') || blocker.includes('release'));
  const hasOpenDispute = deal.status === 'DISPUTED';
  const canRequestRelease = deal.status === 'DOCUMENTS_COMPLETE' && !hasBlockingDocuments && !hasBankBlocker && !hasOpenDispute;
  const canExecuteRelease = deal.status === 'RELEASE_PENDING' && !hasBlockingDocuments && !hasBankBlocker && !hasOpenDispute;

  return {
    hasBlockingDocuments,
    hasBankBlocker,
    hasOpenDispute,
    canRequestRelease,
    canExecuteRelease,
  };
}

export function selectHighestRiskDeal(deals: readonly CanonicalDeal[]): CanonicalDeal | null {
  if (!deals.length) return null;
  return [...deals].sort((left, right) => right.riskScore - left.riskScore)[0] ?? null;
}
