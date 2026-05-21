import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { BankCompliancePilotPanel } from '@/components/platform-v7/BankCompliancePilotPanel';
import { ComplianceRuntime } from '@/components/v7r/ComplianceRuntime';

export default function CompliancePage() {
  return (
    <div data-testid="platform-v7-compliance-page" style={{ display: 'grid', gap: 18 }}>
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-compliance-page']{gap:10px!important}
          .p7-compliance-summary{display:none!important}
        }
      `}</style>
      <div className="p7-compliance-summary"><RoleExecutionSummary role="compliance" /></div>
      <BankCompliancePilotPanel mode="compliance" />
      <ComplianceRuntime />
    </div>
  );
}
