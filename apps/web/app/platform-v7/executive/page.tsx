import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { PriceChart } from '@/components/platform-v7/PriceChart';
import { ExecutiveSignalWall, type ExecutiveSignal } from '@/components/platform-v7/ExecutiveSignalWall';
import { EmptyState } from '@/components/platform-v7/EmptyState';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { getPlatformV7BiCockpitState } from '@/lib/platform-v7/runtime/bi-cockpit-state';
import { UnitEconomicsPassport } from '@/components/platform-v7/UnitEconomicsPassport';
import { ClickHouseAnalyticsPanel } from '@/components/platform-v7/ClickHouseAnalyticsPanel';
import { MlPricePredictorPanel } from '@/components/platform-v7/MlPricePredictorPanel';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  operationalCockpitClasses,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

function formatMoney(rub: number): string {
  if (rub >= 1_000_000_000) return `${(rub / 1_000_000_000).toFixed(2)} млрд ₽`;
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function ExecutivePage() {
  const [deals, disputes, shipments, outbox] = await Promise.all([
    getDealsCanonical(),
    getDisputes(),
    getShipments(),
    getOutboxStatus(),
  ]);

  const dealList: any[] = Array.isArray(deals) ? deals : [];
  const activeDeals = dealList.filter((deal) => !['CLOSED', 'CANCELLED'].includes(deal.status));
  const totalVolume = dealList.reduce((sum, deal) => sum + (deal.totalRub ?? 0), 0);
  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const shipmentCount = activeShipmentCount(shipments);
  const pendingBank = outbox.totalPending ?? 0;
  const bi = getPlatformV7BiCockpitState();

  const liveBlockers = [
    ...(disputeCount > 0 ? [{ id: 'disputes', label: `${disputeCount} открытых спора · ${formatMoney(heldRub)} удержано`, severity: 'stop' as const }] : []),
    ...(pendingBank > 0 ? [{ id: 'bank', label: `${pendingBank} банковских операций ожидают подтверждения`, severity: 'warn' as const }] : []),
  ];

  const signals: ExecutiveSignal[] = [
    { label: 'Деньги в блоке', value: formatMoney(heldRub), detail: disputeCount > 0 ? 'удержано до решения споров' : 'удержаний нет', state: heldRub > 0 ? 'stop' : 'ok' },
    { label: 'Открытые споры', value: String(disputeCount), detail: 'каждый спор связан с конкретной Сделкой', state: disputeCount > 0 ? 'stop' : 'ok' },
    { label: 'Банк ожидает', value: String(pendingBank), detail: 'операции требуют внешнего подтверждения', state: pendingBank > 0 ? 'wait' : 'ok' },
    { label: 'Портфель', value: formatMoney(totalVolume), detail: `${dealList.length} сделок · ${activeDeals.length} активных`, state: 'ok' },
  ];

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-executive-v8'
      eyebrow='Руководитель · только просмотр'
      title='Контроль результата без операционного вмешательства'
      description='Руководитель видит деньги, споры, блокеры, портфель и динамику. Экран не даёт полномочий менять Сделку или подтверждать чужие действия.'
      statusLabel={liveBlockers.length > 0 ? 'есть отклонения' : 'контур стабилен'}
      statusTone={liveBlockers.some((item) => item.severity === 'stop') ? 'critical' : liveBlockers.length > 0 ? 'warning' : 'success'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={outbox.isApiAvailable}
          blockers={liveBlockers}
          pendingBankOps={pendingBank}
          openDisputes={disputeCount}
          activeShipments={shipmentCount}
          role='EXECUTIVE · Стратегический обзор'
          summary={`${activeDeals.length} активных сделок · ${formatMoney(totalVolume)} портфель · ${formatMoney(heldRub)} удержано`}
        />
      )}
      priority={{
        state: 'readonly',
        eyebrow: 'Главный управленческий сигнал',
        title: heldRub > 0 ? `Разобрать причины удержания ${formatMoney(heldRub)}` : 'Критических удержаний нет',
        description: heldRub > 0
          ? 'Руководитель видит причины, владельцев и сроки, но операционные действия выполняют уполномоченные роли внутри Сделки.'
          : 'Продолжайте контролировать портфель, SLA и динамику без вмешательства в полномочия участников.',
        blocker: disputeCount > 0 ? `${disputeCount} открытых спора` : 'нет',
        owner: 'оператор + арбитр + банк',
        impact: formatMoney(heldRub),
        result: 'эскалация владельцу процесса, а не ручная правка данных',
      }}
      facts={[
        { label: 'Портфель', value: formatMoney(totalVolume), hint: `${dealList.length} сделок всего` },
        { label: 'Активных сделок', value: String(activeDeals.length), hint: 'не закрыты и не отменены' },
        { label: 'Открытых споров', value: String(disputeCount), hint: 'влияют на удержание и срок закрытия' },
        { label: 'Активных рейсов', value: String(shipmentCount), hint: 'операционный объём исполнения' },
      ]}
      boundary='Руководитель имеет read-only обзор. Экран не расширяет RBAC, не создаёт банк-статус и не позволяет обходить ответственных участников Сделки.'
    >
      <ExecutiveSignalWall signals={signals} />

      <OperationalCockpitSection id='portfolio'>
        {dealList.length === 0 ? (
          <EmptyState title='Сделок пока нет' description='После регистрации Сделок здесь появятся сумма, статус, культура, объём и владелец.' />
        ) : (
          <div className={operationalCockpitClasses.tableWrap}>
            <table className={operationalCockpitClasses.readOnlyTable}>
              <thead>
                <tr>{['ID', 'Статус', 'Культура', 'Объём, т', 'Сумма', 'Владелец'].map((header) => <th key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {dealList.slice(0, 20).map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.id}</td>
                    <td>{deal.status}</td>
                    <td>{deal.culture ?? '—'}</td>
                    <td>{deal.volumeTons ?? '—'}</td>
                    <td>{deal.totalRub ? formatMoney(deal.totalRub) : '—'}</td>
                    <td>{deal.owner ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalCockpitSection>

      <CollapsibleSection title='Юнит-экономика' summary='GMV · take rate · margin · CAC · LTV' defaultOpen={false}>
        <p className={operationalCockpitClasses.muted}>{bi.note}</p>
        <UnitEconomicsPassport />
      </CollapsibleSection>

      <div className={operationalCockpitClasses.toolGrid}>
        <CollapsibleSection title='Аналитика GMV' summary='сценарный ClickHouse-контур' defaultOpen={false}>
          <ClickHouseAnalyticsPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Ценовой прогноз' summary='модельный экран · не торговая рекомендация' defaultOpen={false}>
          <MlPricePredictorPanel />
        </CollapsibleSection>
      </div>

      <CollapsibleSection title='Динамика цен' summary='12 месяцев · основные культуры' defaultOpen={false}>
        <PriceChart cultures={['wheat_3', 'wheat_4', 'barley', 'corn', 'sunflower']} defaultPeriod={12} />
      </CollapsibleSection>
    </OperationalDecisionCockpit>
  );
}
