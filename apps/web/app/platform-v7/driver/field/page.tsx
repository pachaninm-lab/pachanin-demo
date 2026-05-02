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
      <section style={{ background: '#0F172A', borderRadius: 20, padding: 18, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.68)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Полевой режим · только рейс
        </div>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.08, fontWeight: 950, color: '#fff' }}>
          Рейс водителя
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.74)' }}>
          Здесь нет ставок, банковских действий, инвесторского режима и общего контроля сделки. Только маршрут, связь, прибытие и проблема по рейсу.
        </p>
      </section>
      <RoleRouteHint role="driver" route="/platform-v7/driver/field" />
      <FieldDriverRuntime compact />
    </main>
  );
}
