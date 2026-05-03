import Link from 'next/link';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';

const steps = [
  { number: '1', title: 'Склад продавца', state: 'пройдено', done: true },
  { number: '2', title: 'Погрузка', state: 'подтверждена', done: true },
  { number: '3', title: 'В пути', state: '62%', done: true },
  { number: '4', title: 'Элеватор ВРЖ-08', state: 'следующий пункт', done: false },
] as const;

export default function DriverPage() {
  return (
    <main style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 760, margin: '0 auto', padding: '4px 0 18px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14, boxShadow: '0 12px 28px rgba(15,20,25,0.04)' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
            Рейс водителя
          </div>
          <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px, 8vw, 44px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>
            ТМБ-14 · склад продавца → элеватор ВРЖ-08
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.5 }}>
            Водитель видит только свой рейс, маршрут и полевые действия. Деньги, ставки и контрагенты скрыты.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
          <Info label='Рейс' value='TRIP-SIM-001' />
          <Info label='Сделка' value='DL-9106' />
          <Info label='Статус' value='В пути · 62%' accent />
          <Info label='ETA' value='14:28' />
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14, boxShadow: '0 12px 28px rgba(15,20,25,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={microLabel}>Маршрут</div>
            <h2 style={{ margin: '5px 0 0', color: '#0F1419', fontSize: 26, lineHeight: 1.08, fontWeight: 950 }}>62% пути</h2>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '8px 12px', background: '#0F1419', color: '#fff', fontSize: 13, fontWeight: 900 }}>в пути</span>
        </div>

        <div style={{ border: '1px solid #DDE5EC', borderRadius: 20, background: 'linear-gradient(135deg,#EAF7F1,#F8FBFF)', padding: 14, display: 'grid', gap: 10 }}>
          {steps.map((step) => (
            <div key={step.number} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 10, alignItems: 'center', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 12 }}>
              <span style={{ width: 30, height: 30, borderRadius: 999, display: 'inline-grid', placeItems: 'center', background: step.done ? '#0A7A5F' : '#CBD5E1', color: '#fff', fontSize: 14, fontWeight: 950 }}>{step.number}</span>
              <span style={{ display: 'grid', gap: 2 }}>
                <strong style={{ color: '#0F1419', fontSize: 15, lineHeight: 1.2 }}>{step.title}</strong>
                <span style={{ color: '#64748B', fontSize: 12 }}>{step.state}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#ECFDF3', border: '1px solid #9AF5BB', borderRadius: 22, padding: 18, display: 'grid', gap: 5 }}>
        <h2 style={{ margin: 0, color: '#15803D', fontSize: 'clamp(24px, 6.8vw, 34px)', lineHeight: 1.08, fontWeight: 950 }}>Прибытие зафиксировано в 14:28</h2>
        <p style={{ margin: 0, color: '#16A34A', fontSize: 14 }}>Рейс ТМБ-14 · сделка DL-9106</p>
      </section>

      <FieldDriverRuntime compact />

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 12 }}>
        <div style={microLabel}>Связанные действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/elevator' style={buttonLink}>Приёмка</Link>
          <Link href='/platform-v7/logistics/inbox' style={buttonLink}>Заявка логистики</Link>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? 'rgba(10,122,95,0.08)' : '#F8FAFB', border: `1px solid ${accent ? 'rgba(10,122,95,0.18)' : '#E4E6EA'}`, borderRadius: 16, padding: 13, display: 'grid', gap: 6 }}>
      <span style={microLabel}>{label}</span>
      <strong style={{ color: accent ? '#0A7A5F' : '#0F1419', fontSize: 15, lineHeight: 1.2 }}>{value}</strong>
    </div>
  );
}

const microLabel = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const buttonLink = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
