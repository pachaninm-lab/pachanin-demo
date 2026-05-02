import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { ComplianceRuntime } from '@/components/v7r/ComplianceRuntime';

export default function CompliancePage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleExecutionSummary role="compliance" />
      <ComplianceRuntime />
    </div>
  );
}
