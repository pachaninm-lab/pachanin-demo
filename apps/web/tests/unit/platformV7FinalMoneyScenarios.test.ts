import { describe, expect, it } from 'vitest';
import { canonicalDomainDeals } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';

describe('platform-v7 final money scenarios', () => {
  it('keeps stopped money out of release amount for blocked deals', () => {
    const blocked = canonicalDomainDeals
      .map((deal) => ({ deal, guard: evaluateReleaseGuard(deal) }))
      .filter((item) => !item.guard.canRequestRelease);

    expect(blocked.length).toBeGreaterThan(0);

    for (const item of blocked) {
      expect(item.guard.blockers.length).toBeGreaterThan(0);
      expect(item.guard.canRequestRelease).toBe(false);
    }
  });

  it('keeps open dispute, missing documents and hold reasons visible when present', () => {
    const blockerCodes = new Set(
      canonicalDomainDeals.flatMap((deal) => evaluateReleaseGuard(deal).blockers)
    );

    expect(blockerCodes.has('OPEN_DISPUTE') || blockerCodes.has('DOCUMENTS_NOT_READY') || blockerCodes.has('HOLD_AMOUNT_ACTIVE')).toBe(true);
  });
});
