import { describe, expect, it } from 'vitest';
import { canonicalDomainDeals, selectRuntimeDeals } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';

describe('platform-v7 Control Tower money consistency', () => {
  it('does not count stopped release guard deals as clean release money', () => {
    const runtimeDeals = selectRuntimeDeals().filter((deal) => deal.status !== 'closed');
    const canonicalById = new Map(canonicalDomainDeals.map((deal) => [deal.id, deal]));

    const cleanRelease = runtimeDeals.reduce((sum, deal) => {
      const canonicalDeal = canonicalById.get(deal.id);
      const releaseCheck = canonicalDeal ? evaluateReleaseGuard(canonicalDeal) : null;
      const canRequestRelease = releaseCheck ? releaseCheck.canRequestRelease : true;
      const releaseAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);

      return sum + (canRequestRelease ? releaseAmount : 0);
    }, 0);

    const stoppedRelease = runtimeDeals.reduce((sum, deal) => {
      const canonicalDeal = canonicalById.get(deal.id);
      const releaseCheck = canonicalDeal ? evaluateReleaseGuard(canonicalDeal) : null;
      const releaseAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);

      return sum + (releaseCheck && !releaseCheck.canRequestRelease ? releaseAmount : 0);
    }, 0);

    expect(cleanRelease).toBeGreaterThanOrEqual(0);
    expect(stoppedRelease).toBeGreaterThan(0);
    expect(cleanRelease + stoppedRelease).toBeGreaterThan(cleanRelease);
  });
});
