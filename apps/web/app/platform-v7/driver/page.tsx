import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

const driverSteps = [
  { label: 'Рейс', value: 'TRIP-SIM-001' },
  { label: 'Прибытие', value: '16:10' },
  { label: 'Пломба', value: 'фото и номер' },
  { label: 'Гео', value: 'точка события' },
] as const;

const routePoints = ['Склад продавца', 'Погрузка подтверждена', 'В пути · 62%', 'Элеватор ВРЖ-08'];

export default function DriverPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 62%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
          <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
            Полевой экран водителя · симуляция рейса
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4.8vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.045em', color: '#0F1419', fontWeight: 950 }}>
            Водитель видит назначенный рейс, маршрут и события без доступа к деньгам
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>
            После назначения логистической компанией рейс появляется здесь. Карта ниже — визуальная симуляция маршрута, не live-интеграция с внешним провайдером.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {driverSteps.map((item) => (
            <div key={item.label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <p style={{ margin: 0, color: '#64748B', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' }}>Трекер маршрута</p>
          <h2 style={{ margin: '5px 0 0', color: '#0F1419' }}>Склад продавца → Элеватор ВРЖ-08</h2>
        </div>
        <div style={{ minHeight: 260, borderRadius: 22, border: '1px solid #DDE5EC', background: 'linear-gradient(135deg,#E8F4EF,#F8FBFF)', position: 'relative', overflow: 'hidden', padding: 18 }}>
          <div style={{ position: 'absolute', inset: 22, border: '2px dashed rgba(10,122,95,.35)', borderRadius: 28 }} />
          <div style={{ position: 'relative', display: 'grid', gap: 14, maxWidth: 360 }}>
            {routePoints.map((point, index) => (
              <div key={point} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: 999, background: index < 3 ? '#0A7A5F' : '#CBD5E1', color: '#fff', display: 'inline-grid', placeItems: 'center', fontWeight: 900 }}>{index + 1}</span>
                <strong style={{ color: '#0F1419', fontSize: 13 }}>{point}</strong>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', right: 24, bottom: 24, borderRadius: 999, background: '#0F1419', color: '#fff', padding: '10px 14px', fontWeight: 900 }}>62% пути</div>
        </div>
      </section>

      <RoleExecutionSummary role="driver" />
      <RoleContinuityPanel role="driver" compact />
      <FieldDriverRuntime />
    </div>
  );
}
