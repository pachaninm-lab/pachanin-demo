import { describe, expect, it } from 'vitest';
import {
  domainDeals,
  selectActiveDealCount,
  selectActiveDeals,
  selectCanonicalControlTowerKpis,
  selectCanonicalDeals,
  selectCanonicalInvestorKpis,
  selectDealById,
  selectDealCount,
  selectDisputeById,
  selectDisputesByDealId,
  selectDomainTotals,
  selectHeldTotal,
  selectReadyToReleaseTotal,
  selectReserveTotal,
} from '@/lib/domain/selectors';

describe('domain selectors', () => {
  it('exposes the full platform-v7 deal set', () => {
    expect(selectDealCount()).toBe(19);
    expect(selectActiveDealCount()).toBe(18);
  });

  it('includes required audit deals from the unified domain view', () => {
    for (const id of ['DL-9113', 'DL-9114', 'DL-9116', 'DL-9118', 'DL-9120']) {
      expect(selectDealById(id)?.id).toBe(id);
    }
  });

  it('adds domain metadata to adapted deals', () => {
    const deal = selectDealById('DL-9102');
    expect(deal?.version).toBe(1);
    expect(deal?.sourceOfTruth).toBe('FGIS');
    expect(deal?.createdAt).toBeTruthy();
    expect(deal?.updatedAt).toBeTruthy();
  });

  it('selects active deals without closed records', () => {
    const active = selectActiveDeals();
    expect(active.every((deal) => deal.status !== 'closed')).toBe(true);
    expect(active.find((deal) => deal.id === 'DL-9107')).toBeUndefined();
  });

  it('calculates reserve total from active deals only', () => {
    const manual = domainDeals
      .filter((deal) => deal.status !== 'closed')
      .reduce((sum, deal) => sum + deal.reservedAmount, 0);
    expect(selectReserveTotal()).toBe(manual);
  });

  it('calculates held total from active deals only', () => {
    const manual = domainDeals
      .filter((deal) => deal.status !== 'closed')
      .reduce((sum, deal) => sum + deal.holdAmount, 0);
    expect(selectHeldTotal()).toBe(manual);
    expect(selectHeldTotal()).toBe(2306000);
  });

  it('calculates ready-to-release total from release requested and docs complete deals', () => {
    const manual = domainDeals
      .filter((deal) => deal.status !== 'closed')
      .reduce((sum, deal) => {
        const release = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
        return sum + (deal.status === 'release_requested' || deal.status === 'docs_complete' ? release : 0);
      }, 0);
    expect(selectReadyToReleaseTotal()).toBe(manual);
  });

  it('returns a consistent totals object', () => {
    expect(selectDomainTotals()).toEqual({
      reserveTotal: selectReserveTotal(),
      heldTotal: selectHeldTotal(),
      readyToReleaseTotal: selectReadyToReleaseTotal(),
    });
  });

  it('exposes canonical read-only selectors without changing the old domain totals', () => {
    const canonicalDeals = selectCanonicalDeals();
    const canonicalControlTower = selectCanonicalControlTowerKpis();
    const canonicalInvestor = selectCanonicalInvestorKpis();

    expect(canonicalDeals).toHaveLength(domainDeals.length);
    expect(canonicalDeals.find((deal) => deal.id === 'DL-9102')?.status).toBe('DISPUTED');
    expect(canonicalControlTower.totalReserved).toBeGreaterThanOrEqual(selectReserveTotal());
    expect(canonicalControlTower.moneyAtRisk).toBeGreaterThanOrEqual(selectHeldTotal());
    expect(canonicalInvestor.gmv).toBeGreaterThan(0);
    expect(canonicalInvestor.activeDeals).toBe(selectActiveDealCount());
  });

  it('selects disputes by id and deal id', () => {
    expect(selectDisputeById('DK-2024-89')?.dealId).toBe('DL-9102');
    expect(selectDisputesByDealId('DL-9102')).toHaveLength(1);
    expect(selectDisputesByDealId('DL-9102')[0]?.id).toBe('DK-2024-89');
  });

  it('returns undefined for missing records', () => {
    expect(selectDealById('DL-0000')).toBeUndefined();
    expect(selectDisputeById('DK-0000')).toBeUndefined();
  });
});
