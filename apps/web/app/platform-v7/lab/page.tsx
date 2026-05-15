import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { FieldLabRuntime } from '@/components/v7r/FieldLabRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';
import { OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

export default function Page() {
  return (
    <RoleExecutionCockpitPage cockpit={OPERATIONAL_ROLE_EXECUTION_COCKPITS.lab}>
      <RoleExecutionSummary role="lab" />
      <RoleContinuityPanel role="lab" compact />
      <FieldLabRuntime />
    </RoleExecutionCockpitPage>
  );
}
