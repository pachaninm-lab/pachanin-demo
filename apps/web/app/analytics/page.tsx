import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageAccessGuard } from '../../components/page-access-guard';
import { EXECUTIVE_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';

type KPI = { label: string; value: string; delta?: string; deltaPositive?: boolean };
type MetricGroup = { title: string; kpis: KPI[] };

const METRICS: MetricGroup[] = [
  {
    title: 'Торговые показатели',
    kpis: [
      { label: 'Лотов за 30 дней', value: '47', delta: '+12%', deltaPositive: true },
      { label: 'Объём сделок', value: '14 200 т', delta: '+8%', deltaPositive: true },
      { label: 'Средняя цена пшеницы', value: '13 450 ₽/т', delta: '-2%', deltaPositive: false },
      { label: 'Активных аукционов', value: '3' },
    ],
  },
  {
    title: 'Исполнение сделок',
    kpis: [
      { label: 'Сделок в работе', value: '24' },
      { label: 'В пути', value: '6', delta: '', deltaPositive: true },
      { label: 'На проверке качества', value: '3' },
      { label: 'Расчёт завершён', value: '11', delta: '+3', deltaPositive: true },
      { label: 'Споры', value: '2', delta: '-1', deltaPositive: true },
    ],
  },
  {
    title: 'Финансы',
    kpis: [
      { label: 'Оборот за 30 дней', value: '287 М₽', delta: '+15%', deltaPositive: true },
      { label: 'Hold на счетах', value: '42 М₽' },
      { label: 'Выплачено', value: '245 М₽' },
      { label: 'Средний чек сделки', value: '11.9 М₽' },
    ],
  },
  {
    title: 'Операционные',
    kpis: [
      { label: 'Открытых кейсов', value: '5', delta: '-2', deltaPositive: true },
      { label: 'SLA нарушений', value: '0', delta: '', deltaPositive: true },
      { label: 'Флаги антифрода', value: '2' },
      { label: 'Доступность платформы', value: '99.8%', delta: '+0.1%', deltaPositive: true },
    ],
  },
  {
    title: 'Интеграции',
    kpis: [
      { label: 'GPS — Wialon', value: 'LIVE_OK', deltaPositive: true },
      { label: 'EDO — Диадок', value: 'SANDBOX', deltaPositive: false },
      { label: 'Банк — Сбер', value: 'SANDBOX', deltaPositive: false },
      { label: 'ФГИС Зерно', value: 'MISSING', deltaPositive: false },
    ],
  },
];

export default function AnalyticsPage() {
  return (
    <PageAccessGuard allowedRoles={[...EXECUTIVE_ROLES, ...INTERNAL_ONLY_ROLES]}
      title="Аналитика ограничена"
      subtitle="Операционная аналитика платформы доступна исполнительным и внутренним ролям.">
      <AppShell title="Аналитика" subtitle="Операционные и торговые показатели платформы Прозрачная Цена">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Аналитика' }]} />

          <div className="soft-box" style={{ background: 'var(--color-surface-2, #f9fafb)' }}>
            <div className="muted small">
              Данные актуальны на {new Date().toLocaleDateString('ru-RU')} · Источник: in-memory stores платформы
            </div>
          </div>

          {METRICS.map((group) => (
            <div key={group.title}>
              <div className="section-title" style={{ marginBottom: 8 }}>{group.title}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {group.kpis.map((kpi) => (
                  <div key={kpi.label} className="soft-box" style={{ flex: '1 1 120px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{kpi.value}</div>
                    <div className="muted small">{kpi.label}</div>
                    {kpi.delta && (
                      <div style={{
                        fontSize: '0.72rem', marginTop: 4,
                        color: kpi.deltaPositive ? 'var(--color-green, #22c55e)' : 'var(--color-red, #ef4444)',
                      }}>
                        {kpi.delta}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            <Link href="/operator-cockpit" className="mini-chip">Кокпит оператора</Link>
            <Link href="/deals" className="mini-chip">Сделки</Link>
            <Link href="/connectors" className="mini-chip">Интеграции</Link>
            <Link href="/payments" className="mini-chip">Платежи</Link>
            <Link href="/forecasting" className="mini-chip">Прогнозирование →</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
