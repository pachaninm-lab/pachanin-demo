import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import ExecutivePage from '@/app/platform-v7r/analytics/page';

export default function Page() {
  return (
    <div data-testid="platform-v7-executive-page" style={{ display: 'grid', gap: 18 }}>
      <style>{`@media(max-width:767px){[data-testid='platform-v7-executive-page']{gap:10px!important}[data-testid='platform-v7-executive-page'] > div:first-child{display:none!important}}`}</style>
      <div><RoleExecutionSummary role="executive" /></div>
      <ExecutivePage />
    </div>
  );
}
