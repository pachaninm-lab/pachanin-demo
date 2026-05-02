import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

export default function DriverPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleExecutionSummary role="driver" />
      <RoleContinuityPanel role="driver" compact />
      <FieldDriverRuntime />
    </div>
  );
}
