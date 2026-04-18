import Link from 'next/link';
import { CALLBACKS, DEALS, DISPUTES, getDealIntegrationState } from '@/lib/v7r/data';
import { lots as PLATFORM_LOTS } from '@/lib/v7r/esia-fgis-data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { ControlTowerOperatorPanel } from '@/components/v7r/ControlTowerOperatorPanel';

export default function PlatformV7ControlTowerPage() {
  const activeDeals = DEALS.filter((d) => d.status !== 'closed');
  const integratedDeals = activeDeals.map((deal) => ({ deal, integration: getDealIntegrationState(deal.id, deal.lotId) }));

  const operatorItems = integratedDeals
    .filter((x) => x.integration.gateState !== 'PASS')
    .slice(0, 4)
    .map((x) => ({
      id: x.deal.id,
      title: `${x.deal.grain} · ${x.deal.quantity} ${x.deal.unit}`,
      gateState: x.integration.gateState,
      nextStep: x.integration.nextStep,
      nextOwner: x.integration.nextOwner,
      releasableAmount: x.deal.releaseAmount ?? Math.max(x.deal.reservedAmount - x.deal.holdAmount, 0),
      releaseEligible: x.deal.status === 'release_requested',
      reasonCodes: x.integration.reasonCodes,
    }));

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      <ControlTowerOperatorPanel deals={operatorItems} />

      <div style={{ padding: 20 }}>Control Tower базовая часть оставлена без изменений</div>

    </div>
  );
}
