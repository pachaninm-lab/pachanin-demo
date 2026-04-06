import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { LiquidityLayerPanel } from '../../components/liquidity-layer-panel';
import { NextStepBar } from '../../components/next-step-bar';
import { PageAccessGuard } from '../../components/page-access-guard';
import { SourceNote } from '../../components/source-note';
import { TRADING_ROLES, EXECUTIVE_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';
import { getIndustrializationData } from '../../lib/industrialization-server';

export default async function LiquidityLayerPage() {
  const { liquidity } = await getIndustrializationData();

  return (
    <PageAccessGuard allowedRoles={[...TRADING_ROLES, ...EXECUTIVE_ROLES, ...INTERNAL_ONLY_ROLES]} title="Liquidity layer ограничен" subtitle="Слой управляемой ликвидности нужен торговым ролям, оператору и руководителю.">
      <AppShell title="Managed liquidity" subtitle="Target orders, private buyer network, best bid now и rescue flow для слабой ликвидности.">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/market-center', label: 'Рынок' }, { label: 'Managed liquidity' }]} />
          <SourceNote source="industrialization.liquidity" warning="Этот экран должен не объяснять рынок, а приводить спрос к исполненной сделке: выбрать режим продажи, подключить private buyers и запустить rescue flow." compact />
          <DetailHero
            kicker="Conversion workspace"
            title="Слабую ликвидность надо дотягивать, а не наблюдать"
            description="Open auction — только один из режимов. Здесь продукт должен рекомендовать, в какой именно rail перевести лот: instant, private, target order или operator-assisted."
            chips={[`${liquidity.targetOrders.length} target orders`, `${liquidity.rescueFlows.length} rescue flows`, `${liquidity.strongestBuyers.length} strong buyers`]}
            nextStep="Для каждого проблемного лота выбрать режим продажи и перевести его в конкретное действие, а не в красивую рекомендацию."
            owner="commercial desk / operator"
            blockers={liquidity.rescueFlows[0]?.pain || 'критичных liquidity-хвостов не видно'}
            actions={[
              { href: '/purchase-requests', label: 'Buyer requests' },
              { href: '/market-center', label: 'Price desk', variant: 'secondary' },
              { href: '/trust-center', label: 'Trust input', variant: 'secondary' },
            ]}
          />
          <LiquidityLayerPanel
            targetOrders={liquidity.targetOrders}
            recommendations={liquidity.recommendations}
            rescueFlows={liquidity.rescueFlows}
            strongestBuyers={liquidity.strongestBuyers}
          />
          <NextStepBar
            title="Превращать рекомендацию в действие"
            detail="Следующий шаг — связать liquidity layer с trust, private buyer network и operator-assisted routing без ручного перепридумывания сценария."
            primary={{ href: '/purchase-requests', label: 'Открыть buyer requests' }}
            secondary={[{ href: '/trust-center', label: 'Trust center' }, { href: '/partner-rail', label: 'Partner rail' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
