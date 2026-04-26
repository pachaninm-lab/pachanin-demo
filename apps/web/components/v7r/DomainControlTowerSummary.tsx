'use client';

import Link from 'next/link';
import { P7MetricLinkCard } from '@/components/platform-v7/P7MetricLinkCard';
import { useCanonicalRegistryControlTowerKpis } from '@/lib/domain/canonicalHooks';
import { formatKpiFormula, type ControlTowerKpis } from '@/lib/domain/kpi/controlTower';
import { useControlTowerKpis } from '@/lib/domain/hooks';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { formatCompactMoney } from '@/lib/v7r/helpers';

type MetricKey = keyof ControlTowerKpis;

export function DomainControlTowerSummary() {
  const kpis = useControlTowerKpis();
  const canonicalKpis = useCanonicalRegistryControlTowerKpis();
  const formula = (key: MetricKey) => formatKpiFormula(key, kpis[key]);
  const canonicalMoneyAtRiskFormula = `registry.controlTower.moneyAtRisk: ${canonicalKpis.moneyAtRisk}`;
  const canonicalReserveFormula = `registry.controlTower.totalReserved: ${canonicalKpis.totalReserved}`;
  const canonicalHoldFormula = `registry.controlTower.totalHold: ${canonicalKpis.totalHold}`;
  const canonicalReadyToReleaseFormula = `registry.controlTower.readyToRelease: ${canonicalKpis.readyToRelease}`;

  return (
    <section style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }} aria-label='Доменная сводка центра управления'>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <div
          style={{
            fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
            color: PLATFORM_V7_TOKENS.color.textMuted,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          KPI центра управления
        </div>
        <Link
          href='/platform-v7/control-tower/canonical-reconciliation'
          style={{
            border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
            borderRadius: PLATFORM_V7_TOKENS.radius.pill,
            padding: '7px 11px',
            color: PLATFORM_V7_TOKENS.color.textMuted,
            background: PLATFORM_V7_TOKENS.color.surfaceMuted,
            textDecoration: 'none',
            fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
            fontWeight: 800,
          }}
        >
          Сверка canonical KPI
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.md }}>
        <P7MetricLinkCard testId='kpi-moneyAtRisk' title='Деньги под риском' value={formatCompactMoney(canonicalKpis.moneyAtRisk)} note='Консервативный canonical Control Tower risk из registry: удержание плюс резервная надбавка для сделок со спором или удержанием.' formula={canonicalMoneyAtRiskFormula} href='/platform-v7/disputes' tone='danger' />
        <P7MetricLinkCard testId='kpi-heldAmount' title='Под удержанием' value={formatCompactMoney(canonicalKpis.totalHold)} note='Удержание из canonical registry.' formula={canonicalHoldFormula} href='/platform-v7/disputes' tone='danger' />
        <P7MetricLinkCard testId='kpi-readyToRelease' title='К выпуску' value={formatCompactMoney(canonicalKpis.readyToRelease)} note='К выпуску из canonical registry: только RELEASE_PENDING без блокеров.' formula={canonicalReadyToReleaseFormula} href='/platform-v7/bank' tone='success' />
        <P7MetricLinkCard testId='kpi-integrationStops' title='Интеграционные стопы' value={String(kpis.integrationStops.value)} note='Доменные признаки остановки интеграций.' formula={formula('integrationStops')} href='/platform-v7/connectors' tone='integration' />
        <P7MetricLinkCard testId='kpi-transportStops' title='Транспортные стопы' value={String(kpis.transportStops.value)} note='Доменные признаки транспортной остановки.' formula={formula('transportStops')} href='/platform-v7/control-tower/hotlist' tone='warning' />
        <P7MetricLinkCard testId='kpi-slaCritical' title='SLA срочно' value={String(kpis.slaCritical.value)} note='Сделки с критичным дедлайном.' formula={formula('slaCritical')} href='/platform-v7/deals' tone='danger' />
        <P7MetricLinkCard testId='kpi-reserveTotal' title='В резерве' value={formatCompactMoney(canonicalKpis.totalReserved)} note='Резерв из canonical registry.' formula={canonicalReserveFormula} href='/platform-v7/bank' tone='money' />
      </div>
    </section>
  );
}
