import Link from 'next/link';
import { WeatherWidget } from '@/components/platform-v7/WeatherWidget';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { EtranRzdPanel } from '@/components/platform-v7/EtranRzdPanel';
import { IoTWeighingPanel } from '@/components/platform-v7/IoTWeighingPanel';
import { RailwayLogisticsPanel } from '@/components/platform-v7/RailwayLogisticsPanel';
import { GpsGeofencePanel } from '@/components/platform-v7/GpsGeofencePanel';
import { getShipments, activeShipmentCount, shipmentsWithBlockers } from '@/lib/logistics-server';
import { formatTons, selectDealLogisticsTripPlan } from '@/lib/platform-v7/deal-execution-source-of-truth';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

const logisticsHandoff: HandoffItem[] = [
  {
    direction: 'sends',
    role: 'логистика → водитель',
    requirement: 'передаёт назначение, маршрут, транспорт и требования к доказательствам',
    entity: 'DL-9106',
    href: '/platform-v7/driver',
    documentImpact: true,
  },
  {
    direction: 'awaits',
    role: 'логистика ← элеватор',
    requirement: 'ожидает прибытие, вес, подпись ЭТрН и акт приёмки',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'blockedBy',
    requirement: 'неполный транспортный пакет блокирует передачу основания дальше по Сделке',
    documentImpact: true,
    moneyImpact: true,
  },
];

export default async function LogisticsPage() {
  const shipments = await getShipments();
  const shipmentCount = activeShipmentCount(shipments);
  const blockedShipments = shipmentsWithBlockers(shipments);
  const tripPlan = selectDealLogisticsTripPlan('DL-9106');
  const criticalTrip = tripPlan.trips.find((trip) => !(trip.epdTitleId && trip.sealStatus)) ?? tripPlan.trips[0];

  const liveBlockers = blockedShipments.slice(0, 4).map((shipment) => ({
    id: shipment.id,
    label: `Рейс ${shipment.id}: ${(shipment.blockers ?? [])[0] ?? 'блокер'}`,
    severity: 'warn' as const,
    responsibleRole: 'LOGISTICIAN',
    nextAction: shipment.nextAction ?? 'Закрыть транспортный блокер',
  }));

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-logistics-v8'
      eyebrow='Логистика · рейс → водитель → приёмка'
      title='Один рейс, один блокер, один следующий шаг'
      description='Логист видит исполнение конкретной Сделки: назначение, маршрут, ЭТрН, доказательства, прибытие и передачу на приёмку.'
      statusLabel={blockedShipments.length > 0 ? 'есть блокеры рейсов' : 'рейсы исполняются'}
      statusTone={blockedShipments.length > 0 ? 'warning' : 'success'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={shipments.some((shipment) => !shipment.id.startsWith('SHIP-00'))}
          blockers={liveBlockers}
          activeShipments={shipmentCount}
          role='LOGISTICIAN · Исполнение рейсов'
          summary={`${shipmentCount} активных рейсов · ${blockedShipments.length} с блокерами`}
        />
      )}
      priority={{
        state: blockedShipments.length > 0 ? 'critical' : 'active',
        title: criticalTrip ? `Закрыть транспортный пакет ${criticalTrip.tripId}` : 'Создать первый рейс по DL-9106',
        description: criticalTrip
          ? 'Проверьте водителя, пломбу, ЭТрН и факт прибытия. Неполный пакет не должен переходить в приёмку и денежный контур.'
          : 'План перевозки должен покрыть заявленный объём и назначить ответственного водителя.',
        blocker: criticalTrip?.epdTitleId ? 'ожидается подтверждение приёмки' : 'ЭТрН не сформирована полностью',
        owner: 'логист → водитель → элеватор',
        impact: `${formatTons(tripPlan.plannedTons)} из ${formatTons(tripPlan.declaredTons)} запланировано`,
        result: 'подтверждённый рейс и транспортный evidence-пакет',
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deal-logistics'>Открыть рейсы DL-9106</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/logistics/inbox'>Очередь назначений</Link>,
      }}
      facts={[
        { label: 'Активных рейсов', value: String(shipmentCount), hint: 'серверная очередь логистики' },
        { label: 'Рейсов с блокерами', value: String(blockedShipments.length), hint: 'нужны действия до следующего этапа' },
        { label: 'Машин в плане', value: String(tripPlan.vehicleCount), hint: `${tripPlan.tripIds.length} рейса в Сделке` },
        { label: 'ГИС ЭПД', value: tripPlan.epdPackage?.gisEpdTransferStatus ?? 'нет статуса', hint: 'внешний статус не имитируется платформой' },
      ]}
      boundary='Логистика подтверждает транспортные факты и документы. Она не меняет качество, приёмку, банковский статус или решение по спору.'
    >
      <OperationalCockpitSection id='trips'>
        <OperationalQueue>
          {tripPlan.trips.map((trip) => (
            <OperationalQueueLink
              key={trip.tripId}
              href='/platform-v7/deal-logistics'
              title={`${trip.tripId} · ${trip.driverAlias} · ${trip.vehicleMasked}`}
              detail={`${trip.pickupPoint} → ${trip.deliveryPoint} · ETA ${trip.eta} · ЭТрН ${trip.epdTitleId ?? 'ожидает'}`}
            />
          ))}
        </OperationalQueue>
        <RoleExecutionHandoff items={logisticsHandoff} title='Передача между логистикой, водителем и элеватором' />
      </OperationalCockpitSection>

      <CollapsibleSection title='GPS, геозоны и полевая фиксация' summary='маршрут · въезд/выезд · отклонения' defaultOpen={false}>
        <GpsGeofencePanel />
      </CollapsibleSection>

      <CollapsibleSection title='Весовая и приёмка' summary='IoT · акты · расхождения · доказательства' defaultOpen={false}>
        <IoTWeighingPanel />
      </CollapsibleSection>

      <div className={operationalCockpitClasses.toolGrid}>
        <CollapsibleSection title='РЖД ЭТРАН' summary='вагоны · ГУ-29 · статусы' defaultOpen={false}>
          <EtranRzdPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Железнодорожная логистика' summary='ГУ-12 · парк · демередж' defaultOpen={false}>
          <RailwayLogisticsPanel />
        </CollapsibleSection>
      </div>

      <CollapsibleSection title='Погода по маршрутам' summary='дорожные условия · предупреждения' defaultOpen={false}>
        <WeatherWidget />
      </CollapsibleSection>
    </OperationalDecisionCockpit>
  );
}
