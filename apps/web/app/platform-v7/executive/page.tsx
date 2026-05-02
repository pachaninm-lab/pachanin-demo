import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import ExecutivePage from '@/app/platform-v7r/analytics/page';

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleExecutionSummary role="executive" />
      <ExecutivePage />
    </div>
  );
}
