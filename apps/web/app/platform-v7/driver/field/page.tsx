import Link from 'next/link';
import { RoleRouteHint } from '@/components/platform-v7/RoleRouteHint';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';
import { DriverBigTileIsland } from '@/components/platform-v7/visual/DriverBigTileIsland';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { DriverMissionRouteCard } from '@/components/platform-v7/DriverMissionRouteCard';
import { getPlatformV7DriverCockpitState } from '@/lib/platform-v7/runtime/driver-cockpit-state';
import { CockpitHero, OfflineSyncBanner } from '@/components/platform-v7/premium';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { getShipments, activeShipmentCount, shipmentsWithBlockers } from '@/lib/logistics-server';

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
      data-platform-v7-driver-mobile-pass="true"
      style={{
        display: 'grid',
        gap: 14,
        maxWidth: 760,
        margin: '0 auto',
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
        @media(max-width:767px){
          [data-testid='platform-v7-driver-field-shell']{gap:10px!important;padding-top:0!important}
          .driver-field-hero{padding:16px!important;border-radius:24px!important;gap:10px!important}
          .driver-field-hero p{display:none!important}
          .driver-field-quick-links{grid-template-columns:1fr!important}
          .driver-field-status-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}
        }
      ` }} />
      <CockpitHero
        className="driver-field-hero"
        eyebrow="Водитель · один рейс · одно действие"
        title="Текущий рейс"
        lead="На экране только маршрут, связь, прибытие, фото, пломба и отклонение. Остальной контекст разложен ниже по разделам."
        aside={
          <div style={{ border: '1px solid #CBD5E1', borderRadius: 999, background: '#fff', color: 'var(--pc-text-secondary, #475569)', padding: '6px 10px', fontSize: 12, fontWeight: 900 }}>
            Полевой режим
          </div>
        }
      >
        <Link href="#driver-next-action" style={primaryAction}>
          Подтвердить следующее действие по рейсу
        </Link>

        <div className="driver-field-quick-links" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(128px,1fr))', gap: 8 }}>
          <a href="#driver-offline-events" style={secondaryChip}>Связь / очередь</a>
          <a href="#driver-photo-seal" style={secondaryChip}>Фото / пломба</a>
          <a href="#driver-route-status" style={secondaryChip}>Статус рейса</a>
        </div>
      </CockpitHero>

      <CollapsibleSection title='Статус рейса' summary='следующее · очередь · доступ' defaultOpen>
        <section className="driver-field-status-grid" aria-label="Полевой статус рейса" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
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

      <CollapsibleSection title='Маршрут и прогресс' summary='TRIP · точки · ETA' defaultOpen={false}>
        <DriverMissionRouteCard
          tripId={mission.tripId}
          route={mission.route}
          progressPercent={mission.progressPercent}
          stageLabel={mission.stageLabel}
          photoChecklist={mission.photoChecklist}
        />
      </CollapsibleSection>

      <CollapsibleSection title='Фото, пломба и полевые действия' summary='доказательства · следующий факт' defaultOpen={false}>
        <DriverBigTileIsland />
      </CollapsibleSection>

      <CollapsibleSection title='Полевой runtime и синхронизация' summary='очередь · события · офлайн' defaultOpen={false}>
        <FieldDriverRuntime compact />
      </CollapsibleSection>

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
} as const;

const secondaryChip = {
  minHeight: 42,
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
} as const;

const miniLabel = {
  color: 'var(--pc-text-muted, #64748B)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
} as const;

const miniValue = {
  color: 'var(--pc-text-primary, #0F1419)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
} as const;
