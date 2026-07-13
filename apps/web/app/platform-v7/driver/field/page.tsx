import { NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import { FieldTaskTemplate, KeyFact, KeyFactGrid } from '@/components/transaction-ux/FieldTaskTemplate';
import workspace from '@/components/transaction-ux/FieldRoleWorkspace.module.css';
import { RoleRouteHint } from '@/components/platform-v7/RoleRouteHint';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { DriverMissionRouteCard } from '@/components/platform-v7/DriverMissionRouteCard';
import { getPlatformV7DriverCockpitState } from '@/lib/platform-v7/runtime/driver-cockpit-state';
import { OfflineSyncBanner } from '@/components/platform-v7/premium';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { getShipments, activeShipmentCount, shipmentsWithBlockers } from '@/lib/logistics-server';
import { DriverOfflineQueue } from '@/components/platform-v7/DriverOfflineQueue';
import { PwaOfflinePanel } from '@/components/platform-v7/PwaOfflinePanel';
import { RouteMapStub } from '@/components/platform-v7/RouteMapStub';
import { DriverCameraCapture } from '@/components/platform-v7/DriverCameraCapture';

export default async function DriverFieldPage() {
  const mission = getPlatformV7DriverCockpitState();
  const shipments = await getShipments();
  const shipmentCount = activeShipmentCount(shipments);
  const blockedShipments = shipmentsWithBlockers(shipments);
  const apiOnline = shipments.some((shipment) => !shipment.id.includes('MOCK') && !shipment.id.includes('STATIC'));
  const [from = 'Тамбов', to = 'Воронеж'] = (mission.route ?? 'Тамбов → Воронеж').split(' → ');
  const currentKm = Math.round((mission.progressPercent / 100) * 142);

  const liveBlockers = blockedShipments.map((shipment) => ({
    id: shipment.id,
    label: `Рейс ${shipment.id}: ${(shipment.blockers ?? [])[0] ?? 'блокер'}`,
    severity: 'warn' as const,
    responsibleRole: 'DRIVER',
    nextAction: shipment.nextAction ?? 'Устранить блокер рейса',
  }));

  const liveStatus = <div className={workspace.stack}><LiveApiStatusBar apiOnline={apiOnline} blockers={liveBlockers} activeShipments={shipmentCount} role='DRIVER · Полевой режим' summary={`${shipmentCount} активных рейсов · ${blockedShipments.length} с блокерами`} /><OfflineSyncBanner /></div>;

  const primary = (
    <div className={workspace.stack}>
      <NextActionCard label='Один рейс · одно действие' action='Подтвердить прибытие' reason='Сначала проверь точку назначения. После прибытия зафиксируй фото, пломбу и документ рейса.' blocked={blockedShipments.length > 0} impact={blockedShipments.length ? `${blockedShipments.length} рейса с блокерами` : 'рейс продолжает исполнение'} owner='назначенный водитель' deadline='текущая точка маршрута' actions={<><a className={workspace.primaryLink} href='#driver-next-action'>Открыть действие</a><a className={workspace.secondaryLink} href='#driver-photo-seal'>Фото и пломба</a></>} />
      <KeyFactGrid>
        <KeyFact label='Рейс' value={mission.tripId} hint='доступен только назначенному водителю' />
        <KeyFact label='Маршрут' value={mission.route} hint={mission.stageLabel} />
        <KeyFact label='Прогресс' value={`${mission.progressPercent}%`} hint='по текущему маршруту' />
        <KeyFact label='Доступ' value='только свой рейс' hint='денежный контур скрыт' />
      </KeyFactGrid>
      <section id='driver-next-action' className={workspace.sectionAnchor}><CollapsibleSection title='Текущий рейс' summary='маршрут · следующая точка · ETA' defaultOpen><DriverMissionRouteCard tripId={mission.tripId} route={mission.route} progressPercent={mission.progressPercent} stageLabel={mission.stageLabel} photoChecklist={mission.photoChecklist} /></CollapsibleSection></section>
      <CollapsibleSection title='Маршрут на карте' summary='прогресс · точки · ETA' defaultOpen={false}><RouteMapStub from={from} to={to} currentKm={currentKm} totalKm={142} eta='14:30' vehiclePlate='А234-ВС-68' /></CollapsibleSection>
      <section id='driver-photo-seal' className={workspace.sectionAnchor}><CollapsibleSection title='Фото, пломба и документ рейса' summary='камера · доказательства · весовой талон' defaultOpen><DriverCameraCapture tripId={mission.tripId} /></CollapsibleSection></section>
      <section id='driver-runtime' className={workspace.sectionAnchor}><CollapsibleSection title='Полевой runtime' summary='события · конфликт · повтор' defaultOpen={false}><FieldDriverRuntime compact /></CollapsibleSection></section>
      <RoleRouteHint role='driver' route='/platform-v7/driver/field' />
    </div>
  );

  const context = <div className={workspace.stack}><StatusChip tone={apiOnline ? 'success' : 'warning'}>{apiOnline ? 'Связь с сервером есть' : 'Сервер недоступен'}</StatusChip><ol className={workspace.contextList}><li><span>Следующая точка</span><strong>{to}</strong><small>подтверди прибытие только на площадке</small></li><li><span>Фото</span><strong>{mission.photoChecklist.length} пункта проверки</strong><small>фото привязываются к рейсу и этапу</small></li><li><span>Проблема</span><strong>зафиксировать факт, не решать спор</strong><small>оператор получит событие и доказательства</small></li></ol></div>;

  const evidence = <section className={workspace.evidenceStack} aria-label='Полевые доказательства и связь'><Surface><div className={workspace.sectionStack}><strong>Работа при нестабильной связи</strong><p className={workspace.muted}>Команды не считаются подтверждёнными, пока сервер не принял их в привязанной сессии. При конфликте пользователь получает явную остановку и повторную проверку.</p></div></Surface><CollapsibleSection title='Очередь полевых событий' summary='защищённая синхронизация · повтор · конфликт' defaultOpen={false}><DriverOfflineQueue tripId={mission.tripId} /></CollapsibleSection><CollapsibleSection title='PWA и локальный кэш' summary='доступность · восстановление · ограничения' defaultOpen={false}><PwaOfflinePanel /></CollapsibleSection></section>;

  return <div data-platform-v7-driver-field-pass='true' data-hidden-controls='финансовый контур, ставки и платёжные данные скрыты от водителя'><FieldTaskTemplate testId='platform-v7-driver-field-shell' eyebrow='Водитель · полевая роль' title='Рейс, следующая точка и доказательства' description='На первом уровне только назначенный рейс, одна CTA, связь, фото, пломба, документ и фиксация проблемы.' statusLabel={blockedShipments.length ? 'Есть блокер' : 'Рейс в работе'} statusTone={blockedShipments.length ? 'warning' : 'success'} liveStatus={liveStatus} primary={primary} context={context} evidence={evidence} /></div>;
}
