import Link from 'next/link';
import { RoleRouteHint } from '@/components/platform-v7/RoleRouteHint';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';

export default function DriverFieldPage() {
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
      <section
        style={{
          background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#EEF6F3 100%)',
          border: '1px solid #E4E6EA',
          borderRadius: 24,
          padding: 18,
          display: 'grid',
          gap: 14,
          boxShadow: '0 18px 44px rgba(15,23,42,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 7, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Водитель · один рейс · одно действие
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px,8vw,40px)', lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 950, color: '#0F1419' }}>
              Текущий рейс
            </h1>
          </div>
          <div style={{ border: '1px solid #CBD5E1', borderRadius: 999, background: '#fff', color: '#475569', padding: '6px 10px', fontSize: 12, fontWeight: 900 }}>
            field mode
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#475569' }}>
          На экране только маршрут, связь, прибытие, фото, пломба и отклонение. Денежный, банковый и чужой контекст скрыт.
        </p>

        <Link href="#driver-next-action" style={primaryAction}>
          Подтвердить следующее действие по рейсу
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(128px,1fr))', gap: 8 }}>
          <a href="#driver-offline-events" style={secondaryChip}>Связь / очередь</a>
          <a href="#driver-photo-seal" style={secondaryChip}>Фото / пломба</a>
          <a href="#driver-route-status" style={secondaryChip}>Статус рейса</a>
        </div>
      </section>

      <section aria-label="Полевой статус рейса" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
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

      <RoleRouteHint role="driver" route="/platform-v7/driver/field" />
      <FieldDriverRuntime compact />
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
  color: '#0F1419',
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
  border: '1px solid #E4E6EA',
  background: '#fff',
  padding: 14,
  boxShadow: '0 10px 22px rgba(15,23,42,0.045)',
} as const;

const miniLabel = {
  color: '#64748B',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
} as const;

const miniValue = {
  color: '#0F1419',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
} as const;
