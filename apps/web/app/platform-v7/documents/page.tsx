import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Документы',
  description: 'Документный слой сделки: документы, подписи, споры и влияние на выпуск денег.',
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
              { name: 'Договор поставки', state: 'Подписан', href: '/platform-v7/deals/DL-9102/clean' },
              { name: 'Протокол лаборатории', state: 'Есть расхождение', href: '/platform-v7/disputes/DK-2024-89' },
              { name: 'Комплект на выпуск денег', state: 'Не хватает 1 файла', href: '/platform-v7/bank/release-safety' },
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
            status: 'Проверка выплаты',
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

const controlCards = [
  { label: 'Сделка', value: 'DL-9102', href: '/platform-v7/deals/DL-9102/clean' },
  { label: 'Деньги', value: 'выпуск остановлен', href: '/platform-v7/bank/release-safety' },
  { label: 'Спор', value: 'лабораторное расхождение', href: '/platform-v7/disputes/DK-2024-89' },
  { label: 'Приёмка', value: 'вес и качество', href: '/platform-v7/elevator' },
] as const;

function badgeTone(state: string) {
  if (state.includes('Не хватает') || state.includes('расхождение') || state.includes('неполный')) return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  if (state.includes('В банке') || state.includes('Проверка') || state.includes('остановлен')) return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
}

export default function PlatformV7DocumentsPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 62%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 9, maxWidth: 840 }}>
            <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Документы как условие выплаты
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 4.8vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.045em', color: '#0F1419', fontWeight: 950 }}>
              Неполный пакет документов должен сразу останавливать деньги
            </h1>
            <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.7 }}>
              Документный слой показывает не архив файлов, а влияние каждого документа на сделку: можно ли выпускать деньги, есть ли спор, где не хватает основания и кто должен закрыть следующий шаг.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/bank/release-safety' style={primary}>Проверка выплаты</Link>
            <Link href='/platform-v7/deals/DL-9102/clean' style={secondary}>Сделка DL-9102</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {controlCards.map((item) => (
            <Link key={item.label} href={item.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 7 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
              <strong style={{ color: '#0F1419', fontSize: 15 }}>{item.value}</strong>
            </Link>
          ))}
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
        <Link href='/platform-v7/deals' style={primary}>
          Сделки
        </Link>
        <Link href='/platform-v7/disputes' style={secondary}>
          Споры
        </Link>
      </div>
    </div>
  );
}

const primary = { textDecoration: 'none', padding: '10px 14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: 12, background: '#0F172A', border: '1px solid #0F172A', color: '#fff', fontSize: 13, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA' } as const;
