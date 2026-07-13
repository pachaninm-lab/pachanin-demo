import Link from 'next/link';
import { StatusChip, Surface } from '@pc/design-system-v8';
import {
  ControlBoundary,
  ControlCockpitSection,
  ControlQueue,
  ControlQueueLink,
  ControlRoleCockpit,
  ControlTable,
  controlCockpitClasses,
} from '@/components/transaction-ux/ControlRoleCockpit';
import { WeatherWidget } from '@/components/platform-v7/WeatherWidget';
import { getShipments, activeShipmentCount, shipmentsWithBlockers } from '@/lib/logistics-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { formatTons, selectDealLogisticsTripPlan } from '@/lib/platform-v7/deal-execution-source-of-truth';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { EtranRzdPanel } from '@/components/platform-v7/EtranRzdPanel';
import { IoTWeighingPanel } from '@/components/platform-v7/IoTWeighingPanel';
import { RailwayLogisticsPanel } from '@/components/platform-v7/RailwayLogisticsPanel';
import { GpsGeofencePanel } from '@/components/platform-v7/GpsGeofencePanel';

const logisticsHandoff: HandoffItem[] = [
  { direction: 'sends', role: 'логистика → элеватор', requirement: 'передаёт данные о рейсе и водителе — ожидает подтверждения приёмки от элеватора', entity: 'LOG-REQ-2403', documentImpact: true },
  { direction: 'awaits', role: 'от элеватора', requirement: 'ЭТрН ожидает подписи грузополучателя', documentImpact: true, moneyImpact: true },
  { direction: 'blockedBy', requirement: 'СДИЗ ожидает закрытия — денежная проверка не продолжается без документа', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'ожидать закрытия ЭТрН подписью грузополучателя — пакет передаётся в контур документов после подтверждения', documentImpact: true },
];

const orders = [
  { id: 'LOG-REQ-2403', dealId: 'DL-9106', crop: 'Пшеница 4 класса', volume: '600 т', route: 'Тамбовская область → Элеватор ВРЖ-08', status: 'Водитель назначен', driver: 'Водитель А', vehicle: 'Р***ТУ', progress: '62%', incidents: 'нет', etrn: 'ждёт подписи грузополучателя', next: 'контроль прибытия и подписи ЭТрН', href: '/platform-v7/deal-logistics' },
  { id: 'LOG-9102', dealId: 'DL-9102', crop: 'Ячмень 2 класса', volume: '180 т', route: 'Воронежская область → Курская область', status: 'Прибыл', driver: 'Водитель Б', vehicle: 'С***АА', progress: '100%', incidents: 'отклонение веса', etrn: 'подписана перевозчиком', next: 'закрыть инцидент и акт удержания', href: '/platform-v7/deal-logistics' },
  { id: 'LOG-9103', dealId: 'DL-9103', crop: 'Кукуруза 1 класса', volume: '360 т', route: 'Курская область → Белгородская область', status: 'Ожидает погрузки', driver: 'не назначен', vehicle: '—', progress: '0%', incidents: 'нет', etrn: 'не создана', next: 'назначить водителя и создать ЭТрН', href: '/platform-v7/logistics/inbox' },
] as const;

export default async function LogisticsPage() {
  const shipments = await getShipments();
  const shipmentCount = activeShipmentCount(shipments);
  const blockedShipments = shipmentsWithBlockers(shipments);
  const apiOnline = shipments.some((shipment) => !shipment.id.startsWith('SHIP-00'));
  const tripPlan = selectDealLogisticsTripPlan('DL-9106');
  const riskOrder = orders.find((order) => order.incidents !== 'нет') ?? orders[0];

  const liveBlockers = blockedShipments.slice(0, 3).map((shipment) => ({
    id: shipment.id,
    label: `Рейс ${shipment.id}: ${(shipment.blockers ?? [])[0] ?? 'блокер'}`,
    severity: 'warn' as const,
    responsibleRole: 'LOGISTICIAN',
    nextAction: shipment.nextAction ?? 'Устранить блокер',
  }));

  return (
    <ControlRoleCockpit
      kind='dispatch'
      testId='platform-v7-logistics-dispatch-v8'
      eyebrow='Логистика · Dispatch Board'
      title='Рисковый рейс, водитель, документы и следующий шаг'
      description='Первый экран показывает один рейс под риском, его влияние на срок и документы, ответственного и действие. Инженерная телеметрия открывается только в специальных инструментах.'
      statusLabel={apiOnline ? 'Сервер подтверждён' : 'Статичный контур'}
      statusTone={apiOnline ? 'success' : 'warning'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={apiOnline}
          blockers={liveBlockers}
          activeShipments={shipmentCount}
          role='LOGISTICIAN · Логистика'
          summary={apiOnline ? `${shipmentCount} активных рейсов · ${blockedShipments.length} с блокерами` : 'Данные статичные — API недоступен'}
        />
      )}
      priority={{
        title: `Закрыть инцидент по ${riskOrder.id}`,
        description: `${riskOrder.route}. ${riskOrder.incidents === 'нет' ? 'Критических инцидентов нет.' : `Зафиксировано: ${riskOrder.incidents}.`} До закрытия акта пакет не передаётся дальше.`,
        state: riskOrder.incidents === 'нет' ? 'information' : 'critical',
        impact: 'срок поставки и документное основание',
        blocker: riskOrder.incidents === 'нет' ? 'нет критического стопа' : riskOrder.incidents,
        owner: 'логист и элеватор',
        deadline: 'до закрытия приёмки',
        primaryAction: <Link className={controlCockpitClasses.primaryLink} href={riskOrder.href}>Открыть рейс</Link>,
        secondaryAction: <a className={controlCockpitClasses.secondaryLink} href='#dispatch-queue'>Очередь рейсов</a>,
      }}
      facts={[
        { label: 'Активных рейсов', value: shipmentCount, hint: 'по подтверждённому списку' },
        { label: 'С блокерами', value: blockedShipments.length, hint: 'требуют действия' },
        { label: 'План DL-9106', value: `${tripPlan.vehicleCount} машины`, hint: `${formatTons(tripPlan.plannedTons)} из ${formatTons(tripPlan.declaredTons)}` },
        { label: 'Следующий документ', value: 'подпись ЭТрН', hint: 'после прибытия' },
      ]}
    >
      <ControlBoundary>
        Бизнес-кабинет показывает рейс, документный блокер и ответственность. Сырые GPS-события, очереди интеграций и runtime-метрики не являются главным экраном логиста.
      </ControlBoundary>

      <ControlCockpitSection>
        <RoleExecutionCockpitContent cockpit={OPERATIONAL_ROLE_EXECUTION_COCKPITS.logistics} />
      </ControlCockpitSection>

      <ControlCockpitSection id='dispatch-queue'>
        <CollapsibleSection title='Очередь рейсов' summary='статус · водитель · документ · следующий шаг' defaultOpen>
          <ControlQueue>
            {orders.map((order) => (
              <ControlQueueLink
                key={order.id}
                href={order.href}
                title={`${order.id} · ${order.crop} · ${order.volume}`}
                detail={`${order.route} · ${order.driver} · ${order.vehicle} · ЭТрН: ${order.etrn} · ${order.next}`}
                status={<StatusChip tone={order.incidents === 'нет' ? (order.progress === '100%' ? 'success' : 'information') : 'critical'}>{order.status}</StatusChip>}
              />
            ))}
          </ControlQueue>
        </CollapsibleSection>
      </ControlCockpitSection>

      <ControlCockpitSection>
        <CollapsibleSection title='План перевозки DL-9106' summary='машины · объём · ETA · ЭТрН' defaultOpen={false}>
          <ControlTable
            headers={['Рейс', 'Водитель и ТС', 'Статус', 'Маршрут', 'ETA', 'ЭТрН']}
            rows={tripPlan.trips.map((trip) => [
              `${trip.tripId} · ${formatTons(trip.plannedLoadTons ?? 0)}`,
              `${trip.driverAlias} · ${trip.vehicleMasked}`,
              trip.status ?? trip.currentLeg,
              `${trip.pickupPoint} → ${trip.deliveryPoint}`,
              trip.eta,
              trip.epdTitleId ?? 'ожидает',
            ])}
          />
        </CollapsibleSection>
      </ControlCockpitSection>

      <ControlCockpitSection>
        <CollapsibleSection title='Передача между ролями' summary='элеватор · документы · деньги' defaultOpen={false}>
          <RoleExecutionHandoff items={logisticsHandoff} title='исполнение: что логистика отправляет и ожидает' />
        </CollapsibleSection>
      </ControlCockpitSection>

      <ControlCockpitSection>
        <CollapsibleSection title='Специализированные транспортные инструменты' summary='РЖД · весы · GPS · погода' defaultOpen={false}>
          <div className={controlCockpitClasses.toolGrid}>
            <Surface><EtranRzdPanel /></Surface>
            <Surface><IoTWeighingPanel /></Surface>
            <Surface><GpsGeofencePanel /></Surface>
            <Surface><RailwayLogisticsPanel /></Surface>
            <Surface><WeatherWidget /></Surface>
          </div>
        </CollapsibleSection>
      </ControlCockpitSection>
    </ControlRoleCockpit>
  );
}
