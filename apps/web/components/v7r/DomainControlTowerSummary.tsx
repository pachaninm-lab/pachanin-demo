'use client';

import Link from 'next/link';
import { formatKpiFormula, type ControlTowerKpis } from '@/lib/domain/kpi/controlTower';
import { useCanonicalControlTowerKpis, useControlTowerKpis } from '@/lib/domain/hooks';
import { formatCompactMoney } from '@/lib/v7r/helpers';

type MetricKey = keyof ControlTowerKpis;

function StatCard({
  testId,
  title,
  value,
  note,
  formula,
  href,
  tone = 'default',
}: {
  testId: string;
  title: string;
  value: string;
  note: string;
  formula: string;
  href: string;
  tone?: 'default' | 'green' | 'red';
}) {
  const bg = tone === 'red' ? '#FEF2F2' : tone === 'green' ? '#F0FDF4' : '#fff';
  const border = tone === 'red' ? '#FECACA' : tone === 'green' ? '#BBF7D0' : '#E4E6EA';

  return (
    <Link
      href={href}
      title={formula}
      data-testid={testId}
      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 18, padding: 18, textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
      <div style={{ fontSize: 11, color: '#0A7A5F', fontWeight: 800, marginTop: 10 }}>Открыть →</div>
    </Link>
  );
}

export function DomainControlTowerSummary() {
  const kpis = useControlTowerKpis();
  const canonicalKpis = useCanonicalControlTowerKpis();
  const formula = (key: MetricKey) => formatKpiFormula(key, kpis[key]);
  const canonicalReserveFormula = `canonical.totalReserved: ${canonicalKpis.totalReserved}`;
  const canonicalHoldFormula = `canonical.totalHold: ${canonicalKpis.totalHold}`;
  const canonicalReadyToReleaseFormula = `canonical.readyToRelease: ${canonicalKpis.readyToRelease}`;

  return (
    <section style={{ display: 'grid', gap: 14 }} aria-label='Доменная сводка центра управления'>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          KPI центра управления
        </div>
        <Link
          href='/platform-v7/control-tower/canonical-reconciliation'
          style={{ border: '1px solid #CBD5E1', borderRadius: 999, padding: '7px 11px', color: '#334155', background: '#F8FAFC', textDecoration: 'none', fontSize: 12, fontWeight: 800 }}
        >
          Сверка canonical KPI
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard testId='kpi-moneyAtRisk' title='Деньги под риском' value={formatCompactMoney(kpis.moneyAtRisk.value)} note='Единый расчёт риска из доменного слоя.' formula={formula('moneyAtRisk')} href='/platform-v7/disputes' tone='red' />
        <StatCard testId='kpi-heldAmount' title='Под удержанием' value={formatCompactMoney(canonicalKpis.totalHold)} note='Удержание из canonical domain layer; формула риска пока не менялась.' formula={canonicalHoldFormula} href='/platform-v7/disputes' tone='red' />
        <StatCard testId='kpi-readyToRelease' title='К выпуску' value={formatCompactMoney(canonicalKpis.readyToRelease)} note='К выпуску из canonical domain layer: только RELEASE_PENDING без блокеров.' formula={canonicalReadyToReleaseFormula} href='/platform-v7/bank' tone='green' />
        <StatCard testId='kpi-integrationStops' title='Интеграционные стопы' value={String(kpis.integrationStops.value)} note='Доменные признаки остановки интеграций.' formula={formula('integrationStops')} href='/platform-v7/connectors' tone='red' />
        <StatCard testId='kpi-transportStops' title='Транспортные стопы' value={String(kpis.transportStops.value)} note='Доменные признаки транспортной остановки.' formula={formula('transportStops')} href='/platform-v7/control-tower/hotlist' tone='red' />
        <StatCard testId='kpi-slaCritical' title='SLA срочно' value={String(kpis.slaCritical.value)} note='Сделки с критичным дедлайном.' formula={formula('slaCritical')} href='/platform-v7/deals' tone='red' />
        <StatCard testId='kpi-reserveTotal' title='В резерве' value={formatCompactMoney(canonicalKpis.totalReserved)} note='Резерв из canonical domain layer; формула риска пока не менялась.' formula={canonicalReserveFormula} href='/platform-v7/bank' />
      </div>
    </section>
  );
}
