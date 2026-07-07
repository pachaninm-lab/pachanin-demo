import Link from 'next/link';
import { RoleRouteHint } from '@/components/platform-v7/RoleRouteHint';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { DriverMissionRouteCard } from '@/components/platform-v7/DriverMissionRouteCard';
import { getPlatformV7DriverCockpitState } from '@/lib/platform-v7/runtime/driver-cockpit-state';
import { CockpitHero, OfflineSyncBanner } from '@/components/platform-v7/premium';
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
  const apiOnline = shipments.some((s) => !s.id.includes('MOCK') && !s.id.includes('STATIC'));
  const liveBlockers = blockedShipments.map((s) => ({
    id: s.id,
    label: `Рейс ${s.id}: ${(s.blockers ?? [])[0] ?? 'блокер'}`,
    severity: 'warn' as const,
    responsibleRole: 'DRIVER',
    nextAction: s.nextAction ?? 'Устранить блокер рейса',
  }));
  return (
    <main
      data-testid="platform-v7-driver-field-shell"
      data-platform-v7-driver-field-pass="true"
      data-hidden-controls="финансовый контур, ставки и платёжные данные скрыты от водителя"
      style={{
        display: 'grid',
        gap: 14,
        width: '100%',
        maxWidth: 760,
        minWidth: 0,
        margin: '0 auto',
        overflowX: 'clip',
        padding: '6px 0 24px',
      }}
    >
      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        activeShipments={shipmentCount}
        role="DRIVER · Полевой режим"
        summary={`${shipmentCount} активных рейсов · ${blockedShipments.length} с блокерами`}
      />
      <OfflineSyncBanner />
      <style dangerouslySetInnerHTML={{ __html: `
        [data-testid='platform-v7-role-route-hint']{display:none!important}
        [data-testid='platform-v7-driver-field-shell']{max-width:100%!important;overflow-x:hidden!important}
        [data-testid='platform-v7-driver-field-shell'] *{min-width:0;overflow-wrap:anywhere}
        [data-testid='platform-v7-driver-field-shell'] img,
        [data-testid='platform-v7-driver-field-shell'] canvas,
        [data-testid='platform-v7-driver-field-shell'] video,
        [data-testid='platform-v7-driver-field-shell'] svg{max-width:100%!important}
        @media(max-width:767px){
          [data-testid='platform-v7-driver-field-shell']{gap:10px!important;padding-top:0!important}
          .driver-field-hero{padding:16px!important;border-radius:24px!important;gap:10px!important;overflow:hidden!important}
          .driver-field-hero p{display:none!important}
          .driver-field-hero a{white-space:normal!important}
          .driver-field-quick-links{grid-template-columns:1fr!important}
          .driver-field-status-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .driver-field-first-screen{grid-template-columns:1fr!important;border-radius:22px!important;padding:14px!important;overflow:hidden!important}
          [data-testid='platform-v7-driver-field-shell'] section[id]{scroll-margin-top:112px!important}
        }
        @media(max-width:380px){
          .driver-field-status-grid{grid-template-columns:1fr!important}
        }
      ` }} />
      <section
        data-testid='platform-v7-driver-field-first-screen'
        className="driver-field-first-screen"
        aria-label="Первый экран водителя"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(156px,1fr))',
          gap: 10,
          border: '1px solid var(--pc-border, #E4E6EA)',
          borderRadius: 24,
          background: '#fff',
          padding: 16,
          boxShadow: '0 14px 30px rgba(15,23,42,0.055)',
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <div style={{ ...firstScreenCard, gridColumn: '1 / -1', background: 'transparent', border: 'none', minHeight: 'auto', padding: '0 0 4px' }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--pc-text-primary, #0F1419)', letterSpacing: '-0.01em' }}>Полевой режим</span>
        </div>
        <div style={firstScreenCard}>
          <span style={firstScreenLabel}>Что произошло</span>
          <strong style={firstScreenValue}>рейс назначен водителю</strong>
        </div>
        <div style={firstScreenCard}>
          <span style={firstScreenLabel}>Что заблокировано</span>
          <strong style={firstScreenValue}>выгрузка ждёт фото и пломбу</strong>
        </div>
        <div style={firstScreenCard}>
          <span style={firstScreenLabel}>Финансовый доступ</span>
          <strong style={firstScreenValue}>нет доступа к денежному контуру</strong>
        </div>
        <div style={firstScreenCard}>
          <span style={firstScreenLabel}>Кто отвечает</span>
          <strong style={firstScreenValue}>водитель · полевой рейс</strong>
        </div>
        <div style={firstScreenCard}>
          <span style={firstScreenLabel}>Следующее действие</span>
          <strong style={firstScreenValue}>подтвердить прибытие</strong>
        </div>
        <div style={{ ...firstScreenCard, gap: 8 }}>
          <a href="#driver-next-action" style={compactAction}>Открыть действие</a>
          <a href="#driver-offline-events" style={compactGhostAction}>Проверить очередь</a>
        </div>
      </section>

      <CockpitHero
        className="driver-field-hero"
        eyebrow="Водитель · один рейс · одно действие"
        title="Текущий рейс"
        lead="На экране только маршрут, связь, прибытие, фото, пломба и отклонение. Остальной контекст разложен ниже по разделам."
        aside={
          <div style={{ border: '1px solid #CBD5E1', borderRadius: 999, background: '#fff', color: 'var(--pc-text-secondary, #475569)', padding: '6px 10px', fontSize: 12, fontWeight: 900, maxWidth: '100%', overflowWrap: 'anywhere' }}>
            controlled-pilot / pre-integration
          </div>
        }
      >
        <Link href="#driver-next-action" style={primaryAction}>
          Подтвердить следующее действие по рейсу
        </Link>

        <div className="driver-field-quick-links" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(128px,1fr))', gap: 8, minWidth: 0, maxWidth: '100%' }}>
          <a href="#driver-offline-events" style={secondaryChip}>Связь / очередь</a>
          <a href="#driver-photo-seal" style={secondaryChip}>Фото / пломба</a>
          <a href="#driver-route-status" style={secondaryChip}>Статус рейса</a>
        </div>
      </CockpitHero>

      <section id="driver-next-action" style={driverFieldSection}>
        <CollapsibleSection title='Статус рейса' summary='следующее · очередь · доступ' defaultOpen>
          <section className="driver-field-status-grid" aria-label="Полевой статус рейса" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, minWidth: 0, maxWidth: '100%' }}>
            <div style={miniStatusCard}>
              <span style={miniLabel}>следующее</span>
              <strong style={miniValue}>прибытие</strong>
            </div>
            <div style={miniStatusCard}>
              <span style={miniLabel}>очередь</span>
              <strong style={miniValue}>локально сохранится</strong>
            </div>
            <div style={miniStatusCard}>
              <span style={miniLabel}>доступ</span>
              <strong style={miniValue}>только свой рейс</strong>
            </div>
          </section>
        </CollapsibleSection>
      </section>

      <section id="driver-route-status" style={driverFieldSection}>
        <CollapsibleSection title='Маршрут и прогресс' summary='TRIP · точки · ETA' defaultOpen={false}>
          <DriverMissionRouteCard
            tripId={mission.tripId}
            route={mission.route}
            progressPercent={mission.progressPercent}
            stageLabel={mission.stageLabel}
            photoChecklist={mission.photoChecklist}
          />
        </CollapsibleSection>
      </section>

      <section id="driver-photo-seal" style={driverFieldSection}>
        <CollapsibleSection title='Фото, пломба и полевые действия' summary='доказательства · следующий факт' defaultOpen={false}>
          <div style={{ padding: '12px', fontSize: 13, color: 'var(--pc-text-secondary)', minWidth: 0, overflowWrap: 'anywhere' }}>Фото и пломба фиксируются в полевом режиме через мобильное приложение.</div>
        </CollapsibleSection>
      </section>

      <section id="driver-map" style={driverFieldSection}>
        <CollapsibleSection title='Маршрут на карте' summary='прогресс · точки · ETA' defaultOpen={false}>
          {(() => {
            const [from, to] = (mission.route ?? 'Тамбов → Воронеж').split(' → ');
            const currentKm = Math.round((mission.progressPercent / 100) * 142);
            return (
              <RouteMapStub
                from={from ?? 'Тамбов'}
                to={to ?? 'Воронеж'}
                currentKm={currentKm}
                totalKm={142}
                eta="14:30"
                vehiclePlate="А234-ВС-68"
              />
            );
          })()}
        </CollapsibleSection>
      </section>

      <section id="driver-offline-events" style={driverFieldSection}>
        <CollapsibleSection title='Фото рейса' summary='камера · галерея · прибытие · весовой талон' defaultOpen>
          <DriverCameraCapture tripId={mission.tripId} />
        </CollapsibleSection>
        <CollapsibleSection title='Офлайн-очередь' summary='IndexedDB · синхронизация при восстановлении сети' defaultOpen={false}>
          <DriverOfflineQueue tripId={mission.tripId} />
        </CollapsibleSection>
        <CollapsibleSection title='PWA Offline · Кэш и очередь действий' summary='Service Worker · IndexedDB · Background Sync · last-write-wins · конфликты' defaultOpen={false}>
          <PwaOfflinePanel />
        </CollapsibleSection>
        <CollapsibleSection title='Полевой runtime' summary='очередь · события · офлайн' defaultOpen={false}>
          <FieldDriverRuntime compact />
        </CollapsibleSection>
      </section>

      <RoleRouteHint role="driver" route="/platform-v7/driver/field" />
    </main>
  );
}

const primaryAction = {
  minHeight: 58,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 16,
  border: 'none',
  background: '#0A7A5F',
  color: '#fff',
  fontSize: 16,
  fontWeight: 950,
  textAlign: 'center',
  textDecoration: 'none',
  boxShadow: '0 14px 28px rgba(10,122,95,0.22)',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const;

const secondaryChip = {
  minHeight: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
  border: '1px solid #CBD5E1',
  background: '#fff',
  color: 'var(--pc-text-primary, #0F1419)',
  fontSize: 12,
  fontWeight: 900,
  textAlign: 'center',
  textDecoration: 'none',
  boxShadow: '0 8px 18px rgba(15,23,42,0.045)',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const;

const miniStatusCard = {
  display: 'grid',
  gap: 5,
  minHeight: 74,
  borderRadius: 18,
  border: '1px solid var(--pc-border, #E4E6EA)',
  background: '#fff',
  padding: 14,
  boxShadow: '0 10px 22px rgba(15,23,42,0.045)',
  minWidth: 0,
  overflow: 'hidden',
} as const;

const miniLabel = {
  color: 'var(--pc-text-muted, #64748B)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
} as const;

const miniValue = {
  color: 'var(--pc-text-primary, #0F1419)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
} as const;

const firstScreenCard = {
  display: 'grid',
  gap: 5,
  minHeight: 72,
  alignContent: 'center',
  borderRadius: 18,
  border: '1px solid #E2E8F0',
  background: '#F8FAFC',
  padding: 12,
  minWidth: 0,
  overflow: 'hidden',
} as const;

const firstScreenLabel = {
  color: 'var(--pc-text-muted, #64748B)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
} as const;

const firstScreenValue = {
  color: 'var(--pc-text-primary, #0F1419)',
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
} as const;

const compactAction = {
  minHeight: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
  background: '#0A7A5F',
  color: '#fff',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const;

const compactGhostAction = {
  ...compactAction,
  border: '1px solid #CBD5E1',
  background: '#fff',
  color: 'var(--pc-text-primary, #0F1419)',
} as const;

const driverFieldSection = {
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  scrollMarginTop: 92,
} as const;
