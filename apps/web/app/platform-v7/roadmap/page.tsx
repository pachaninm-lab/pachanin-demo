import Link from 'next/link';

const ROADMAP = [
  {
    quarter: 'Q2 2026',
    title: 'Добив пилотного контура',
    status: 'В работе',
    items: [
      'Закрыть операторский контур: сделки, документы, споры, деньги',
      'Довести логистику, приёмку и акт до единой цепочки',
      'Стабилизировать bank mock и события release',
    ],
  },
  {
    quarter: 'Q3 2026',
    title: 'Интеграции и банк',
    status: 'Следующий этап',
    items: [
      'Углубить интеграцию с банком и контуром выпуска денег',
      'Расширить документный и доказательный слой',
      'Подготовить controlled pilot с якорным клиентом',
    ],
  },
  {
    quarter: 'Q4 2026',
    title: 'Масштабирование и внешний контур',
    status: 'План',
    items: [
      'Усилить региональный и банковый сценарий',
      'Сделать внешний пакет для новых регионов и крупных клиентов',
      'Подготовить масштабирование контуров ролей и отчётности',
    ],
  },
];

function tone(status: string) {
  if (status === 'В работе') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (status === 'Следующий этап') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' };
}

export default function RoadmapPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Roadmap</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Короткая и честная карта движения проекта: сначала добиваем исполнение сделки, потом углубляем интеграции, затем масштабируем внешний контур.
        </div>
      </section>

      <div style={{ display: 'grid', gap: 14 }}>
        {ROADMAP.map((stage) => {
          const t = tone(stage.status);
          return (
            <section key={stage.quarter} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stage.quarter}</div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: '#0F1419' }}>{stage.title}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 800 }}>
                  {stage.status}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {stage.items.map((item) => (
                  <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 900 }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/investor' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Инвесторский режим
        </Link>
        <Link href='/platform-v7/about' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          О проекте
        </Link>
      </div>
    </div>
  );
}
