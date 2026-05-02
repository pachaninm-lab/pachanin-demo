import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import SurveyorPage from '@/app/platform-v7r/surveyor/page';

export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleExecutionSummary role="surveyor" />
      <SurveyorPage />
    </div>
  );
}
