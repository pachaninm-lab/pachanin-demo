import Link from 'next/link';

const METRICS = [
  { label: 'Прозрачные сделки', value: '78%', note: 'Доля сделок, прошедших через единый контур исполнения.' },
  { label: 'Контролируемая логистика', value: '64%', note: 'Рейсы, по которым есть маршрут, прибытие и фиксация событий.' },
  { label: 'Отечественные культуры', value: '92%', note: 'Доля партий, идущих по внутреннему агроконтуру.' },
  { label: 'Экспорт / внутренний рынок', value: '18 / 82', note: 'Соотношение по текущему демо-портфелю.' },
];

const BLOCKS = [
  {
    title: 'Что показывает ESG-отчёт',
    body: 'Это не декоративный зелёный отчёт. Он нужен, чтобы показать, какая доля сделок проходит в прозрачном контуре, где есть документы, маршруты, приёмка, доказательства и контроль денег.',
  },
  {
    title: 'Почему это полезно региону',
    body: 'Регион видит не просто оборот, а качество исполнения: где сделки контролируются, где есть логистический след, где документы не уходят в тень и где спорность снижается за счёт единого контура.',
  },
  {
    title: 'Границы честности',
    body: 'Часть показателей в текущем контуре агрегируется на основе пилотных и демо-данных. Это полезно для логики и упаковки, но не должно выдаваться за финальную официальную отчётность без боевых подтверждений.',
  },
];

const REGIONS = [
  { name: 'Тамбовская область', share: '32%', status: 'ядро пилота' },
  { name: 'Воронежская область', share: '18%', status: 'сделки и логистика' },
  { name: 'Ростовская область', share: '14%', status: 'маршруты и приёмка' },
  { name: 'Ставропольский край', share: '11%', status: 'потенциал расширения' },
];

export default function EsgReportPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>ESG-отчёт</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Рабочая страница для региона и внешнего контура. Показывает не общие слова, а то, какая доля сделок проходит через прозрачный и доказуемый контур исполнения.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {METRICS.map((metric) => (
          <section key={metric.label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{metric.label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{metric.value}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{metric.note}</div>
          </section>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {BLOCKS.map((block) => (
          <section key={block.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{block.title}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{block.body}</div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Регионы в контуре</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {REGIONS.map((region) => (
            <div key={region.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 160px', gap: 12, border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{region.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>{region.share}</div>
              <div style={{ fontSize: 12, color: '#6B778C' }}>{region.status}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/reports/regulator' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Отчёт для регулятора
        </Link>
        <Link href='/platform-v7/roadmap' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Roadmap
        </Link>
      </div>
    </div>
  );
}
