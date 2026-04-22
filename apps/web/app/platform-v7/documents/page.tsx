import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Документы',
  description: 'Древовидный документный слой сделки: год, месяц, сделка и статус документов.',
};

const DOCUMENT_TREE = [
  {
    year: '2026',
    months: [
      {
        month: 'Апрель',
        deals: [
          {
            id: 'DL-9102',
            status: 'Пакет неполный',
            documents: [
              { name: 'Договор поставки', state: 'Подписан', href: '/platform-v7/deals/DL-9102' },
              { name: 'Протокол лаборатории', state: 'Есть расхождение', href: '/platform-v7/disputes/DK-2024-89' },
              { name: 'Комплект на выпуск денег', state: 'Не хватает 1 файла', href: '/platform-v7/deals/DL-9102' },
            ],
          },
          {
            id: 'DL-9109',
            status: 'Пакет готов',
            documents: [
              { name: 'Договор поставки', state: 'Подписан', href: '/platform-v7/deals/DL-9109' },
              { name: 'Транспортный пакет', state: 'Подписан', href: '/platform-v7/deals/DL-9109' },
              { name: 'Пакет на выпуск', state: 'В банке', href: '/platform-v7/bank' },
            ],
          },
        ],
      },
      {
        month: 'Март',
        deals: [
          {
            id: 'DL-9116',
            status: 'Release review',
            documents: [
              { name: 'Договор поставки', state: 'Подписан', href: '/platform-v7/deals/DL-9116' },
              { name: 'Акт приёмки', state: 'Подписан', href: '/platform-v7/deals/DL-9116' },
            ],
          },
        ],
      },
    ],
  },
];

function badgeTone(state: string) {
  if (state.includes('Не хватает') || state.includes('расхождение')) return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  if (state.includes('В банке') || state.includes('review')) return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
}

export default function PlatformV7DocumentsPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0F1419' }}>Документы</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Древовидный документный слой сделки: год → месяц → сделка → документ. Сразу видно, где пакет полный, где спор, а где деньги ещё держит банковая проверка.
        </div>
      </section>

      {DOCUMENT_TREE.map((year) => (
        <section key={year.year} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0F1419' }}>{year.year}</div>

          {year.months.map((month) => (
            <div key={month.month} style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, background: '#F8FAFB', display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{month.month}</div>

              <div style={{ display: 'grid', gap: 12 }}>
                {month.deals.map((deal) => {
                  const dealTone = badgeTone(deal.status);
                  return (
                    <article key={deal.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, background: '#fff', padding: 14, display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{deal.id}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>Документный пакет сделки</div>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: dealTone.bg, border: `1px solid ${dealTone.border}`, color: dealTone.color, fontSize: 11, fontWeight: 800 }}>
                          {deal.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gap: 8 }}>
                        {deal.documents.map((doc) => {
                          const tone = badgeTone(doc.state);
                          return (
                            <Link key={doc.name} href={doc.href} style={{ textDecoration: 'none', border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', background: '#F8FAFB' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{doc.name}</div>
                                <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>Открыть связанный контур →</div>
                              </div>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                                {doc.state}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Сделки
        </Link>
        <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Споры
        </Link>
      </div>
    </div>
  );
}
