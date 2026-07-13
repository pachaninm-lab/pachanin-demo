import Link from 'next/link';
import { OperatorKpiDashboard } from '@/components/platform-v7/OperatorKpiDashboard';
import { PushNotificationBanner } from '@/components/platform-v7/PushNotificationBanner';
import { OperatorInboxPanel } from '@/components/platform-v7/OperatorInboxPanel';
import { OperatorExecutionQueue } from '@/components/platform-v7/OperatorExecutionQueue';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { RecentlyViewedWidget } from '@/components/platform-v7/RecentlyViewedWidget';
import { IntegrationStatusWidget } from '@/components/platform-v7/IntegrationStatusWidget';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount, shipmentsWithBlockers } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

const blockers = [
  { title: 'DL-9106 · СДИЗ', detail: 'ФГИС «Зерно» не подтвердил документ · 9,65 млн ₽ под блокировкой', href: '/platform-v7/deals/DL-9106/clean' },
  { title: 'DL-9106 · ЭТрН', detail: 'Ожидается подпись грузополучателя и передача в ГИС ЭПД', href: '/platform-v7/logistics' },
  { title: 'DL-9102 · отклонение веса', detail: 'Акт расхождения не закрыт · удержание 624 тыс. ₽', href: '/platform-v7/deals/DL-9102/clean' },
] as const;

function formatMoney(rub: number): string {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function PlatformV7OperatorPage() {
  const [deals, disputes, shipments, outbox] = await Promise.all([
    getDealsCanonical(),
    getDisputes(),
    getShipments(),
    getOutboxStatus(),
  ]);

  const disputeCount = openDisputeCount(disputes);
  const heldRub = disputeTotalHeldRub(disputes);
  const shipmentCount = activeShipmentCount(shipments);
  const blockedShipments = shipmentsWithBlockers(shipments);
  const liveBlockers = [
    ...disputes
      .filter((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW')
      .map((dispute) => ({
        id: dispute.id,
        label: `Спор ${dispute.id}: ${dispute.description.slice(0, 60)}`,
        severity: 'stop' as const,
        responsibleRole: 'ARBITRATOR',
        nextAction: 'Закрыть спор и доказательную базу',
      })),
    ...blockedShipments.map((shipment) => ({
      id: shipment.id,
      label: `Рейс ${shipment.id}: ${(shipment.blockers ?? [])[0] ?? 'блокер'}`,
      severity: 'warn' as const,
      responsibleRole: 'LOGISTICIAN',
      nextAction: shipment.nextAction ?? 'Устранить блокер рейса',
    })),
  ];

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-operator-v8'
      eyebrow='Оператор · управление исполнением'
      title='Сначала критический блокер сделки'
      description='Оператор видит только бизнес-очередь: какая сделка остановлена, что блокирует деньги, кто отвечает и какое действие нужно выполнить сейчас.'
      statusLabel={liveBlockers.length > 0 ? 'требует действий' : 'очередь чистая'}
      statusTone={liveBlockers.length > 0 ? 'critical' : 'success'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={outbox.isApiAvailable}
          blockers={liveBlockers}
          pendingBankOps={outbox.totalPending}
          openDisputes={disputeCount}
          activeShipments={shipmentCount}
          role='OPERATOR · Центр исполнения'
          summary={`${deals.length} сделок · ${disputeCount} споров · ${formatMoney(heldRub)} удержано · ${shipmentCount} рейсов`}
        />
      )}
      priority={{
        state: 'critical',
        title: 'Разобрать DL-9106 и закрыть документные блокеры',
        description: 'СДИЗ и ЭТрН держат основание для банковской проверки. Оператор назначает ответственного и контролирует подтверждённый результат, но не создаёт банковский статус вручную.',
        blocker: 'СДИЗ + ЭТрН + качество',
        owner: 'продавец → грузополучатель → лаборатория',
        impact: '9,65 млн ₽ не передаются на банковскую проверку',
        result: 'полный доказательный пакет в Сделке',
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals/DL-9106/clean'>Открыть DL-9106</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/documents'>Матрица документов</Link>,
      }}
      facts={[
        { label: 'Критических блокеров', value: String(liveBlockers.filter((item) => item.severity === 'stop').length || blockers.length), hint: 'сортируются по влиянию на исполнение и деньги' },
        { label: 'Удержано по спорам', value: formatMoney(heldRub), hint: 'снимается только после решения и подтверждённого основания' },
        { label: 'Банк ожидает', value: String(outbox.totalPending), hint: 'операции в очереди внешнего подтверждения' },
        { label: 'Рейсов с блокерами', value: String(blockedShipments.length), hint: 'логистические стопы связаны со Сделкой' },
      ]}
      boundary='Оператор управляет очередью и ответственными. Он не подменяет банк, лабораторию, элеватор, подписанта или арбитра и не выпускает деньги.'
    >
      <OperationalCockpitSection id='queue'>
        <OperationalQueue>
          {blockers.map((item) => <OperationalQueueLink key={item.title} {...item} />)}
        </OperationalQueue>
        <OperatorExecutionQueue />
      </OperationalCockpitSection>

      <CollapsibleSection title='Операционные инструменты' summary='KPI · входящие · недавно открытые' defaultOpen={false}>
        <div className={operationalCockpitClasses.toolGrid}>
          <OperatorKpiDashboard />
          <OperatorInboxPanel />
          <RecentlyViewedWidget />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Технические статусы подключений' summary='второй уровень · не бизнес-очередь' defaultOpen={false}>
        <IntegrationStatusWidget />
      </CollapsibleSection>

      <PushNotificationBanner />
    </OperationalDecisionCockpit>
  );
}
