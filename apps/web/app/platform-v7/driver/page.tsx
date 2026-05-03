import Link from 'next/link';
import { FieldDriverRuntime } from '@/components/v7r/FieldDriverRuntime';

const steps = [
  { number: '1', title: 'Склад продавца', state: 'пройдено', done: true },
  { number: '2', title: 'Погрузка', state: 'подтверждена', done: true },
  { number: '3', title: 'В пути', state: '62%', done: true },
  { number: '4', title: 'Элеватор ВРЖ-08', state: 'следующий пункт', done: false },
] as const;

const yandexRouteUrl = 'https://yandex.ru/maps/?rtext=52.721246%2C41.452238~52.632233%2C41.443594&rtt=auto';
const yandexMapWidgetUrl = 'https://yandex.ru/map-widget/v1/?ll=41.447916%2C52.676740&mode=routes&rtext=52.721246%2C41.452238~52.632233%2C41.443594&rtt=auto&z=10';

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

      <YandexMapCard />

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

function YandexMapCard() {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 12px 28px rgba(15,20,25,0.04)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(210px, 260px)', gap: 12, alignItems: 'start' }}>
        <div>
          <div style={microLabel}>Яндекс.Карты</div>
          <h2 style={{ margin: '5px 0 0', color: '#0F1419', fontSize: 26, lineHeight: 1.08, fontWeight: 950 }}>Маршрут рейса ТМБ-14</h2>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>Склад продавца → Элеватор ВРЖ-08 · текущая точка показана в пилотном режиме</p>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <a href={yandexRouteUrl} target='_blank' rel='noreferrer' style={{ ...buttonLink, background: '#FFDD2D', borderColor: '#E8C600', color: '#0F1419' }}>
            Открыть в Яндекс.Картах
          </a>
          <div style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 5 }}>
            <div style={{ ...microLabel, color: '#0A7A5F' }}>Симуляция локации водителя</div>
            <strong style={{ color: '#0F1419', fontSize: 15, lineHeight: 1.2 }}>52.6671, 41.4479</strong>
            <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.35 }}>62% пути · обновлено 14:28</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', minHeight: 300, borderRadius: 20, overflow: 'hidden', border: '1px solid #DDE5EC', background: '#EEF6F3' }}>
        <iframe
          title='Яндекс.Карта маршрута рейса ТМБ-14'
          src={yandexMapWidgetUrl}
          width='100%'
          height='320'
          loading='lazy'
          referrerPolicy='no-referrer-when-downgrade'
          style={{ display: 'block', width: '100%', height: 320, border: 0 }}
        />
        <div aria-label='Симулированная точка водителя на маршруте' style={{ position: 'absolute', left: '58%', top: '45%', transform: 'translate(-50%, -50%)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <span style={{ width: 46, height: 46, borderRadius: 999, background: 'rgba(10,122,95,0.16)', border: '1px solid rgba(10,122,95,0.22)', display: 'inline-grid', placeItems: 'center' }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: '#0A7A5F', border: '4px solid #fff', boxShadow: '0 8px 22px rgba(15,20,25,0.32)' }} />
          </span>
        </div>
        <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'grid', gap: 6, maxWidth: 'calc(100% - 24px)' }}>
          <div style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '8px 11px', background: 'rgba(15,20,25,0.88)', color: '#fff', fontSize: 13, fontWeight: 900 }}>62% пути · ETA 14:28</div>
          <div style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '7px 10px', background: 'rgba(255,255,255,0.94)', color: '#0F1419', fontSize: 12, fontWeight: 850, border: '1px solid #E4E6EA' }}>Симулированная точка водителя на маршруте</div>
        </div>
      </div>
    </section>
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
