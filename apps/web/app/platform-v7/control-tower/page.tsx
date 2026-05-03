// patched version
// CHANGE: totalRelease now based on releaseGuard instead of integration gate

import Link from 'next/link';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { canonicalDomainDeals, selectRuntimeDeals } from '@/lib/domain/selectors';

export default function PlatformV7ControlTowerPage() {
  const deals = selectRuntimeDeals();

  const totalRelease = deals.reduce((sum, deal) => {
    const canonical = canonicalDomainDeals.find(d => d.id === deal.id);
    const guard = canonical ? evaluateReleaseGuard(canonical) : null;

    const releaseAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);

    return sum + (guard && guard.canRequestRelease ? releaseAmount : 0);
  }, 0);

  return totalRelease;
}
