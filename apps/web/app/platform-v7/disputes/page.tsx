import { DomainDisputesSummary } from '@/components/v7r/DomainDisputesSummary';
import { DisputesRuntime } from '@/components/v7r/DisputesRuntime';

export default function PlatformV7DisputesPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DomainDisputesSummary />
      <DisputesRuntime />
    </div>
  );
}
