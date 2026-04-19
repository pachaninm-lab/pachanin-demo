'use client';

const METRICS = [
  { label: 'GMV (апрель)',       value: '118 млн ₽',  sub: '+30% к марту' },
  { label: 'Take-rate',          value: '1,8%',        sub: 'Комиссия платформы' },
  { label: 'Активных сделок',    value: '31',          sub: 'Пик по текущему ряду' },
  { label: 'Средний цикл',       value: '8,3 дн.',     sub: 'От контракта до расчёта' },
];

const REGIONS = [
  { name: 'Тамбовская',    deals: 8,  gmv: 38.4,  color: '#0A7A5F' },
  { name: 'Воронежская',   deals: 7,  gmv: 32.1,  color: '#0B6B9A' },
  { name: 'Курская',       deals: 5,  gmv: 22.1,  color: '#2563EB' },
  { name: 'Белгородская',  deals: 4,  gmv: 17.2,  color: '#7C3AED' },
  { name: 'Ставропольский',deals: 4,  gmv: 43.5,  color: '#D97706' },
  { name: 'Ростовская',    deals: 3,  gmv: 12.6,  color: '#DC2626' },
];

const ROADMAP = [
  'ФГИС-интеграция в prod-контур (Q2 2026)',
  'Пилот с 3 агрохолдингами ЮФО (Q2 2026)',
  'Мобильное приложение для водителей и элеваторов (Q3 2026)',
  'API-доступ для банков-партнёров (Q3 2026)',
  'Расширение на 15 регионов (Q4 2026)',
];

const TRUST = [
  { label: 'Просрочка по сделкам', value: '0%', good: true },
  { label: 'Спорность',            value: '8%', good: true },
  { label: 'ФГИС-покрытие',        value: '100%', good: true },
  { label: 'Активных сделок',       value: '31', good: true },
];

export default function InvestorPage() {
  const maxGmv = Math.max(...REGIONS.map(r => r.gmv));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: 0, borderLeft: '4px solid #0A7A5F', paddingLeft: 12 }}>
          Инвестор / Раунд
        </h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4, paddingLeft: 16 }}>
          Trust metrics · Операционные показатели · Roadmap
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {METRICS.map(({ label, value, sub }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0F1419', marginTop: 8, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Распределение по регионам</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {REGIONS.map(r => (
              <div key={r.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: '#6B778C' }}>{r.deals} сделок · {r.gmv} млн ₽</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#F1F3F5', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: r.color, width: `${(r.gmv / maxGmv) * 100}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Trust metrics</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {TRUST.map(({ label, value, good }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: good ? 'rgba(10,122,95,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${good ? 'rgba(10,122,95,0.14)' : 'rgba(220,38,38,0.14)'}` }}>
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: good ? '#0A7A5F' : '#B91C1C' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Roadmap · 90 дней</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {ROADMAP.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 999, background: '#0A7A5F', color: '#fff', fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', borderRadius: 16, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Запросить питч-дек</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Детальные финансовые модели и стратегия роста</div>
        </div>
        <a href="mailto:invest@pachanin.ru" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 12, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
          Написать →
        </a>
      </div>
    </div>
  );
}
