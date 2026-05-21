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
  const moneyAtRiskFormula = `Деньги под риском = удержание + резервная надбавка по сделкам со спором или удержанием: ${canonicalKpis.moneyAtRisk}`;
  const holdFormula = `Под удержанием = сумма удержаний по сделкам: ${canonicalKpis.totalHold}`;
  const readyToReleaseFormula = `К выпуску = сделки без открытых причин остановки: ${canonicalKpis.readyToRelease}`;

  return (
    <section style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }} aria-label='Сводка центра управления'>
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
          Главное за 10 секунд
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
          Открыть сверку KPI
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.md }}>
        <P7MetricLinkCard testId='kpi-readyToRelease' title='К выпуску' value={formatCompactMoney(canonicalKpis.readyToRelease)} note='Деньги, которые ближе всего к подтверждению банком.' formula={readyToReleaseFormula} href='/platform-v7/bank' tone='success' />
        <P7MetricLinkCard testId='kpi-heldAmount' title='Под удержанием' value={formatCompactMoney(canonicalKpis.totalHold)} note='Сумма, которую нельзя выпускать до закрытия причины остановки.' formula={holdFormula} href='/platform-v7/disputes' tone='danger' />
        <P7MetricLinkCard testId='kpi-moneyAtRisk' title='Деньги под риском' value={formatCompactMoney(canonicalKpis.moneyAtRisk)} note='Сумма, где есть спор, удержание или риск по исполнению.' formula={moneyAtRiskFormula} href='/platform-v7/disputes' tone='danger' />
        <P7MetricLinkCard testId='kpi-slaCritical' title='SLA срочно' value={String(kpis.slaCritical.value)} note='Сделки, по которым нужно действовать быстрее остальных.' formula={formula('slaCritical')} href='/platform-v7/deals' tone='danger' />
      </div>
    </section>
  );
}
