import { PageAccessGuard } from '../../components/page-access-guard';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { OperationBlueprint } from '../../components/operation-blueprint';
import { NextStepBar } from '../../components/next-step-bar';
import { buildMarketRows, readCommercialWorkspace, scoreBuyerRows } from '../../lib/commercial-workspace-store';
import { FARMER_ROLES } from '../../lib/route-roles';

export default async function FarmerMobilePage() {
  const state = await readCommercialWorkspace();
  const rows = scoreBuyerRows(buildMarketRows(state));
  const topRow = rows[0];

  return (
    <PageAccessGuard allowedRoles={[...FARMER_ROLES]} title="Farmer mobile ограничен" subtitle="Экран нужен фермеру и торговой роли, которая ведёт продажу от его имени.">
      <AppShell title="Farmer mobile" subtitle="Мобильный rail фермера: цена, buyer offer, решение по лоту и следующий путь в сделку.">
        <div className="page-surface">
          <ModuleHub
            title="Что должен связывать farmer mobile"
            subtitle="Мобильный фермерский экран должен продолжать market desk, lot rail и deal creation, а не быть отдельной справкой про цену."
            items={[
              { href: '/market-center', label: 'Ценовой центр', detail: 'Смотреть netback, gross price, скорость денег и trust.', icon: '📈', meta: `${rows.length} buyers`, tone: 'blue' },
              { href: '/lots', label: 'Лоты', detail: 'Открыть или пересмотреть свой лот и buyer selection.', icon: '◌', meta: topRow?.linkedLotId || 'lot rail', tone: 'green' },
              { href: '/deals', label: 'Сделки', detail: 'После выбора buyer перейти в сделочный контур, а не остаться на мобильном экране.', icon: '≣', meta: topRow?.linkedDealId || 'deal rail', tone: 'amber' },
              { href: '/finance', label: 'Финансы', detail: 'Проверить аванс / factoring, если это влияет на выбор buyer.', icon: '₽', meta: 'money', tone: 'gray' },
            ]}
          />

          <OperationBlueprint
            title="Как должен заканчиваться farmer mobile"
            subtitle="Фермерский экран не должен быть тупиком. После price view следующий rail обязан быть lot/deal/finance."
            stages={[
              { title: 'Market desk', detail: 'Смотреть netback и buyer trust не как новость, а как decision surface.', state: topRow ? 'active' : 'pending', href: '/market-center' },
              { title: 'Lot decision', detail: 'Перейти из buyer offer в lot rail и принять решение по buyer.', state: topRow?.linkedLotId ? 'active' : 'pending', href: topRow?.linkedLotId ? `/lots/${topRow.linkedLotId}` : '/lots' },
              { title: 'Deal creation', detail: 'После выбора buyer следующий rail — deal creation / execution.', state: topRow?.linkedDealId ? 'active' : 'pending', href: topRow?.linkedDealId ? `/deals/${topRow.linkedDealId}` : '/deals' },
              { title: 'Money check', detail: 'Финальный выбор buyer должен учитывать payout speed / advance / factoring.', state: 'pending', href: '/finance' },
            ]}
            outcomes={[
              { href: '/market-center', label: 'Buyer offers', detail: 'Открыть реальные buyer rows и посмотреть, кто сильнее по netback и trust.', meta: topRow?.buyerName || 'buyers' },
              { href: topRow?.linkedLotId ? `/lots/${topRow.linkedLotId}` : '/lots', label: 'Lot rail', detail: 'Перейти из мобильного price surface в торговый контур.', meta: topRow?.linkedLotId || 'lot' },
              { href: '/finance', label: 'Finance rail', detail: 'Проверить, влияет ли advance / factoring на итоговый выбор buyer.', meta: 'money' },
            ]}
            rules={[
              'Farmer mobile не должен заканчиваться на просмотре цены — после него обязан быть lot/deal/finance rail.',
              'Решение по buyer должно учитывать не только gross/netback, но и trust / payout speed / dispute history.',
              'Любой мобильный фермерский экран должен вести в действие, а не быть отдельной "витриной" без execution continuation.'
            ]}
          />

          <NextStepBar
            title={topRow ? `Открыть buyer ${topRow.buyerName} и перейти в lot rail` : 'Открыть market center'}
            detail={topRow ? `${topRow.culture} · ${topRow.netbackRubPerTon != null ? topRow.netbackRubPerTon.toLocaleString('ru-RU') : topRow.price != null ? topRow.price.toLocaleString('ru-RU') : '—'} ₽/т` : 'Нет buyer rows в market desk.'}
            primary={{ href: topRow?.linkedLotId ? `/lots/${topRow.linkedLotId}` : '/market-center', label: topRow?.linkedLotId ? 'Открыть lot rail' : 'Открыть market center' }}
            secondary={[{ href: '/deals', label: 'Deals' }, { href: '/finance', label: 'Finance' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
