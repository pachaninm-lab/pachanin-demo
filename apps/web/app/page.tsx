import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { KpiCard } from '../components/kpi-card';

export default function HomePage() {
  return (
    <AppShell title="Прозрачная Цена" subtitle="Единый контур зерновой сделки: цена → логистика → документы → деньги → спор">
      <div className="grid-3">
        <KpiCard title="Сделки" value="Execution rail" hint="От winner selection до final release" />
        <KpiCard title="Контроль денег" value="Fail-closed" hint="Reserve / hold / partial / final" tone="amber" />
        <KpiCard title="Доказательность" value="Evidence first" hint="Audit trail, provenance, dispute pack" tone="blue" />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Быстрые входы</div>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          <Link href="/cabinet" className="primary-link">Кабинеты ролей</Link>
          <Link href="/deal-console" className="secondary-link">Deal console</Link>
          <Link href="/logistics" className="secondary-link">Логистика</Link>
          <Link href="/documents" className="secondary-link">Документы</Link>
          <Link href="/settlement" className="secondary-link">Расчёты</Link>
        </div>
      </div>
    </AppShell>
  );
}
