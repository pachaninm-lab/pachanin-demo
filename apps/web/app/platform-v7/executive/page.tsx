import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import ExecutivePage from '@/app/platform-v7r/analytics/page';
import { OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

export default function Page() {
  return (
    <RoleExecutionCockpitPage cockpit={OPERATIONAL_ROLE_EXECUTION_COCKPITS.executive}>
      <RoleExecutionSummary role="executive" />
      <ExecutivePage />
    </RoleExecutionCockpitPage>
  );
}
