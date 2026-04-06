import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

export default function DealConsolePage() {
  return (
    <AppShell title="Deal console" subtitle="Главная рабочая поверхность сделки: статус, owner, blockers, next action">
      <div className="stack-sm">
        <Link href="/deals/DEAL-001" className="primary-link">DEAL-001</Link>
        <Link href="/deals/DEAL-002" className="secondary-link">DEAL-002</Link>
      </div>
    </AppShell>
  );
}
