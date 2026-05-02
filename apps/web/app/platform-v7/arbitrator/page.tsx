import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import ArbitratorPage from '@/app/platform-v7r/arbitrator/page';

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleExecutionSummary role="arbitrator" />
      <ArbitratorPage />
    </div>
  );
}
