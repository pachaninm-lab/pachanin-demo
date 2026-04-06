import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

const QUICK_LINKS = [
  { href: '/operator-cockpit', label: 'Operator cockpit', detail: 'Сводка по очередям, блокерам и деньгам под риском.', tone: 'red' },
  { href: '/disputes', label: 'Споры', detail: 'Открытые разногласия с SLA и суммой под риском.', tone: 'amber' },
  { href: '/anti-fraud', label: 'Anti-fraud', detail: 'Флаги подозрительной активности.', tone: 'red' },
  { href: '/payments', label: 'Платежи', detail: 'Hold, release, ledger и сверки.', tone: 'green' },
  { href: '/documents', label: 'Документы', detail: 'Реестр документов, блокеры, статусы.', tone: 'blue' },
  { href: '/connectors', label: 'Коннекторы', detail: 'Статус интеграций: GPS, EDO, банк, ФГИС.', tone: 'gray' },
  { href: '/deals', label: 'Сделки', detail: 'Execution rail — все активные сделки.', tone: 'blue' },
  { href: '/logistics', label: 'Логистика', detail: 'Рейсы, ETA и распределение.', tone: 'gray' },
  { href: '/receiving', label: 'Приёмка', detail: 'Слоты очереди и состояние выгрузки.', tone: 'gray' },
  { href: '/lab', label: 'Лаборатория', detail: 'Пробы, протоколы и quality truth.', tone: 'gray' },
  { href: '/analytics', label: 'Аналитика', detail: 'KPI платформы: объём, споры, SLA, интеграции.', tone: 'blue' },
  { href: '/audit', label: 'Audit log', detail: 'Журнал действий и изменений.', tone: 'gray' },
];

const TONE_STYLE: Record<string, string> = {
  red: 'background: #fef2f2; border-left: 3px solid #ef4444;',
  amber: 'background: #fffbeb; border-left: 3px solid #f59e0b;',
  green: 'background: #f0fdf4; border-left: 3px solid #22c55e;',
  blue: 'background: #eff6ff; border-left: 3px solid #3b82f6;',
  gray: 'background: var(--color-surface-2, #f3f4f6); border-left: 3px solid #e5e7eb;',
};

export default function ControlPage() {
  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Control center требует авторизации">
      <AppShell title="Control center" subtitle="Операционный центр: блокеры, алерты, деньги, документы, споры">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Control center' }]} />

          <DetailHero
            kicker="Control center"
            title="Единый операционный центр"
            description="Быстрый доступ ко всем критическим разделам платформы: споры, платежи, логистика, anti-fraud, документы и коннекторы."
            chips={['blockers', 'money at risk', 'disputes', 'integrations']}
            nextStep="Открыть наиболее срочный раздел — operator cockpit или споры."
            owner="operator / admin"
            blockers=""
            actions={[
              { href: '/operator-cockpit', label: 'Operator cockpit' },
              { href: '/disputes', label: 'Споры', variant: 'secondary' },
              { href: '/analytics', label: 'Аналитика', variant: 'secondary' },
            ]}
          />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}>
            {QUICK_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="section-card-tight" style={{
                display: 'block',
                textDecoration: 'none',
                ...Object.fromEntries(
                  (TONE_STYLE[item.tone] || '').split(';').filter(Boolean).map((s) => {
                    const [k, ...v] = s.trim().split(':');
                    return [
                      k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
                      v.join(':').trim(),
                    ];
                  })
                ),
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.label}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{item.detail}</div>
              </Link>
            ))}
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
