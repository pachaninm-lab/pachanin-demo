import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { BankCompliancePilotPanel } from '@/components/platform-v7/BankCompliancePilotPanel';
import { ComplianceRuntime } from '@/components/v7r/ComplianceRuntime';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

export default function CompliancePage() {
  return (
    <RoleExecutionCockpitPage cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.compliance}>
      <RoleExecutionSummary role="compliance" />
      <BankCompliancePilotPanel mode="compliance" />
      <ComplianceRuntime />
    </RoleExecutionCockpitPage>
  );
}
