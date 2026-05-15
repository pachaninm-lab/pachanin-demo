import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import SurveyorPage from '@/app/platform-v7r/surveyor/page';
import { OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

export default function Page() {
  return (
    <RoleExecutionCockpitPage cockpit={OPERATIONAL_ROLE_EXECUTION_COCKPITS.surveyor}>
      <RoleExecutionSummary role="surveyor" />
      <SurveyorPage />
    </RoleExecutionCockpitPage>
  );
}
