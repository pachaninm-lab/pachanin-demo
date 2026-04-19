import Link from 'next/link';

const HOTLIST = [
  {
    id: 'HL-01',
    title: 'DL-9102 · спор + документы',
    note: 'Нужно одновременно закрыть пакет доказательств и документный blocker.',
    primary: '/platform-v7/disputes/DSP-104',
    secondary: '/platform-v7/deals/DL-9102/documents',
  },
  {
    id: 'HL-02',
    title: 'DL-9107 · выпуск денег',
    note: 'Сделка почти готова, нужен финальный проход через bank-contour.',
    primary: '/platform-v7/bank',
    secondary: '/platform-v7/deals/DL-9107',
  },
  {
    id: 'HL-03',
    title: 'DL-9111 · интеграционный стоп',
    note: 'Сделка упёрлась в ФГИС / ЕСИА и требует проверки связки.',
    primary: '/platform-v7/connectors',
    secondary: '/platform-v7/deals/DL-9111',
  },
];

export default function ControlTowerHotlistPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Горячий список Control Tower</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Быстрый экран для оператора: только самые срочные кейсы, которые нельзя терять в общей очереди. Это рабочий short-list, а не декоративная страница.
        </div>
      </section>

      <div style={{ display: 'grid', gap: 10 }}>
        {HOTLIST.map((item) => (
          <article key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{item.id}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item.note}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={item.primary} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
                Основное действие
              </Link>
              <Link href={item.secondary} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
                Открыть кейс
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Control Tower
        </Link>
        <Link href='/platform-v7/notifications' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Уведомления
        </Link>
      </div>
    </div>
  );
}
