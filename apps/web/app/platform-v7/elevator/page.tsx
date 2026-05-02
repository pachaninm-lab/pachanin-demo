import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldElevatorRuntime } from '@/components/v7r/FieldElevatorRuntime';

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleExecutionSummary role="elevator" />
      <FieldElevatorRuntime />
    </div>
  );
}
