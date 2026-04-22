import Link from 'next/link';
import { DEALS } from '@/lib/v7r/data';
import { formatMoney, statusLabel } from '@/lib/v7r/helpers';

export default function DealsComparePage({ searchParams }: { searchParams?: { ids?: string } }) {
  const ids = (searchParams?.ids ?? '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 3);
  const deals = ids.map((id) => DEALS.find((item) => item.id === id)).filter(Boolean);

  if (deals.length < 2) {
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 960, margin: '0 auto' }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419' }}>Сравнение сделок</div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>Для сравнения нужно минимум 2 сделки. Вернись в реестр, выбери нужные строки и снова нажми «Сравнить».</div>
        </section>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>Вернуться в сделки</Link>
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Статус', get: (item: typeof deals[number]) => statusLabel(item!.status) },
    { label: 'Лот', get: (item: typeof deals[number]) => item!.lotId ?? '—' },
    { label: 'Маршрут', get: (item: typeof deals[number]) => item!.routeId ?? '—' },
    { label: 'Сумма', get: (item: typeof deals[number]) => formatMoney(item!.reservedAmount) },
    { label: 'Удержано', get: (item: typeof deals[number]) => formatMoney(item!.holdAmount) },
    { label: 'Риск', get: (item: typeof deals[number]) => String(item!.riskScore) },
    { label: 'Покупатель', get: (item: typeof deals[number]) => item!.buyer.name },
    { label: 'Продавец', get: (item: typeof deals[number]) => item!.seller.name },
    { label: 'ETA', get: (item: typeof deals[number]) => item!.routeEta ?? '—' },
    { label: 'Блокеры', get: (item: typeof deals[number]) => item!.blockers.length ? item!.blockers.join(' · ') : 'Нет' },
  ];

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419' }}>Сравнение сделок</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>Сравнение по деньгам, риску, маршруту, статусу, блокерам и сторонам сделки. Это возвращённая функция, которая выпала после mobile-рефакторинга.</div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: '#F8FAFB', textAlign: 'left' }}>
              <th style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA', fontSize: 11, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Параметр</th>
              {deals.map((deal) => (
                <th key={deal!.id} style={{ padding: '12px 14px', borderBottom: '1px solid #E4E6EA' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{deal!.id}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{deal!.grain} · {deal!.quantity} {deal!.unit}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderTop: '1px solid #E4E6EA' }}>
                <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B778C', fontWeight: 700 }}>{row.label}</td>
                {deals.map((deal) => (
                  <td key={`${row.label}-${deal!.id}`} style={{ padding: '12px 14px', fontSize: 13, color: '#0F1419', fontWeight: 700, verticalAlign: 'top' }}>{row.get(deal)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>Вернуться в сделки</Link>
        {deals.map((deal) => (
          <Link key={deal!.id} href={`/platform-v7/deals/${deal!.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>{deal!.id}</Link>
        ))}
      </div>
    </div>
  );
}
