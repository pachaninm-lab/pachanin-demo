import Link from 'next/link';

const METRICS = [
  { label: 'Сделки в наблюдаемом контуре', value: '31', note: 'Сделки, по которым ведётся единый цифровой контур исполнения.' },
  { label: 'Под контролем документов', value: '84%', note: 'Доля сделок, где есть документный контур и проверка статусов.' },
  { label: 'Спорные кейсы', value: '8%', note: 'Доля сделок, ушедших в спор и удержание.' },
  { label: 'Средний цикл', value: '4.8 дня', note: 'От фиксации сделки до выпуска денег.' },
];

const BLOCKS = [
  {
    title: 'Что показывает отчёт',
    body: 'Этот отчёт нужен не для маркетинга, а для управленческого и регуляторного обзора: сколько сделок проходит через прозрачный контур, где есть документы, где фиксируются споры и каков общий уровень контролируемости исполнения.',
  },
  {
    title: 'Что важно регулятору',
    body: 'Важен не просто объём, а качество исполнения: есть ли след логистики, подтверждены ли документы, где возникают споры, какова доля ручных вмешательств и где контур уже можно считать достаточно дисциплинированным для controlled pilot.',
  },
  {
    title: 'Честные ограничения',
    body: 'Часть данных в текущем отчёте формируется по пилотному и демо-контуру. Это полезно для логики и проектной настройки, но не должно выдаваться за окончательную государственную отчётность без боевых подтверждений и интеграционного закрытия.',
  },
];

const REGIONS = [
  { name: 'Тамбовская область', deals: '12', status: 'ядро пилота', control: 'высокий' },
  { name: 'Воронежская область', deals: '7', status: 'активная логистика', control: 'средний' },
  { name: 'Ростовская область', deals: '5', status: 'маршруты и приёмка', control: 'средний' },
  { name: 'Ставропольский край', deals: '3', status: 'расширение', control: 'базовый' },
];

export default function RegulatorReportPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Отчёт для регулятора</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Рабочий управленческий отчёт по прозрачности исполнения сделок. Показывает не только объём, но и качество контроля: документы, споры, логистику, долю ручного вмешательства и степень дисциплины контура.
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
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Регионы и степень контроля</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {REGIONS.map((region) => (
            <div key={region.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 80px 160px 120px', gap: 12, border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{region.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>{region.deals}</div>
              <div style={{ fontSize: 12, color: '#6B778C' }}>{region.status}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{region.control}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/reports/esg' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          ESG-отчёт
        </Link>
        <Link href='/platform-v7/roadmap' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Roadmap
        </Link>
      </div>
    </div>
  );
}
