import Link from 'next/link';
import { RoleRouteHint } from '@/components/platform-v7/RoleRouteHint';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';

export default function DriverFieldPage() {
  return (
    <main
      data-testid="platform-v7-driver-field-shell"
      style={{
        display: 'grid',
        gap: 16,
        maxWidth: 760,
        margin: '0 auto',
        padding: '8px 0 24px',
      }}
    >
      <section style={{ background: 'linear-gradient(135deg,#0F172A 0%,#111827 58%,#0A7A5F 140%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 20, display: 'grid', gap: 12, boxShadow: '0 18px 44px rgba(15,23,42,0.22)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.68)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Полевой режим · только рейс
        </div>
        <h1 style={{ margin: 0, fontSize: 'clamp(30px,8vw,40px)', lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 950, color: '#fff' }}>
          Рейс водителя
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)' }}>
          Только текущий рейс: маршрут, связь, прибытие, фото, вес, пломба и проблема по рейсу.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          <Link href="#driver-next-action" style={fieldChip}>Следующее действие</Link>
          <Link href="#driver-offline-events" style={fieldChip}>Офлайн-события</Link>
          <Link href="#driver-photo-seal" style={fieldChip}>Фото и пломба</Link>
        </div>
      </section>
      <RoleRouteHint role="driver" route="/platform-v7/driver/field" />
      <FieldDriverRuntime compact />
    </main>
  );
}

const fieldChip = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.88)',
  fontSize: 13,
  fontWeight: 900,
  textAlign: 'center',
  textDecoration: 'none',
} as const;
