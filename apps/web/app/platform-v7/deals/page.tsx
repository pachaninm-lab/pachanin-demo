import { DomainDealsSummary } from '@/components/v7r/DomainDealsSummary';
import { DealsOverviewRuntime } from '@/components/v7r/DealsOverviewRuntime';

export default function PlatformV7DealsPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DomainDealsSummary />
      <DealsOverviewRuntime />
    </div>
  );
}
