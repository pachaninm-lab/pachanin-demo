import Link from 'next/link';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const blue = '#2563EB';
const green = '#0A7A5F';
const amber = '#B45309';

const RFQ_DETAIL: Record<string, {
  grain: string; cropClass: string; volumeTons: number; region: string;
  maxPrice: string; basis: string; deliveryFrom: string; deliveryTo: string;
  moisture: number; gluten: number; comment: string; matchCount: number;
}> = {
  'RFQ-B-2401': { grain: 'Пшеница', cropClass: '4 кл.', volumeTons: 400, region: 'ЦФО', maxPrice: '16 200 ₽/т', basis: 'EXW', deliveryFrom: '15.06.2026', deliveryTo: '30.06.2026', moisture: 14.0, gluten: 23.0, comment: 'Нужен СДИЗ и протокол лаборатории.', matchCount: 3 },
  'RFQ-B-2402': { grain: 'Ячмень', cropClass: '2 кл.', volumeTons: 200, region: 'ЮФО', maxPrice: '12 500 ₽/т', basis: 'CPT', deliveryFrom: '20.06.2026', deliveryTo: '10.07.2026', moisture: 14.0, gluten: 0, comment: '', matchCount: 1 },
  'RFQ-B-2403': { grain: 'Подсолнечник', cropClass: '', volumeTons: 500, region: 'ЦФО', maxPrice: '34 000 ₽/т', basis: 'FCA', deliveryFrom: '01.07.2026', deliveryTo: '20.07.2026', moisture: 8.0, gluten: 0, comment: 'Можно рассмотреть CPT.', matchCount: 0 },
};

const DEFAULT_DETAIL = { grain: 'Зерновая культура', cropClass: '', volumeTons: 300, region: 'ЦФО', maxPrice: '14 000 ₽/т', basis: 'EXW', deliveryFrom: '01.07.2026', deliveryTo: '31.07.2026', moisture: 14.0, gluten: 22.0, comment: '', matchCount: 0 };

export default function PlatformV7RfqByIdPage({ params }: { params: { rfqId: string } }) {
  const { rfqId } = params;
  const d = RFQ_DETAIL[rfqId] ?? DEFAULT_DETAIL;

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Покупатель · {rfqId}
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>
              {d.grain} {d.cropClass}
            </h1>
          </div>
          <Link href='/platform-v7/buyer/rfq' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            ← Мои запросы
          </Link>
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Параметры запроса</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {[
            { label: 'Объём', value: `${d.volumeTons} т` },
            { label: 'Регион', value: d.region },
            { label: 'Базис', value: d.basis },
            { label: 'Максимальная цена', value: d.maxPrice },
            { label: 'Поставка с', value: d.deliveryFrom },
            { label: 'Поставка до', value: d.deliveryTo },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: text, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
        {(d.moisture > 0 || d.gluten > 0) && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 8 }}>Требования к качеству</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {d.moisture > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}`, fontSize: 12 }}>
                  Влажность макс: <strong>{d.moisture}%</strong>
                </div>
              )}
              {d.gluten > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}`, fontSize: 12 }}>
                  Клейковина мин: <strong>{d.gluten}%</strong>
                </div>
              )}
            </div>
          </div>
        )}
        {d.comment && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}`, fontSize: 13, color: muted }}>
            {d.comment}
          </div>
        )}
      </section>

      {d.matchCount > 0 && (
        <div style={{ padding: 14, borderRadius: 14, background: 'rgba(10,122,95,0.05)', border: '1px solid rgba(10,122,95,0.14)', fontSize: 13, color: green, fontWeight: 700 }}>
          Найдено совпадений с партиями: {d.matchCount}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/buyer/matches' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: d.matchCount > 0 ? green : blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          {d.matchCount > 0 ? `Совпадения (${d.matchCount})` : 'Найти партии'}
        </Link>
        <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Изменить запрос
        </Link>
        <Link href='/platform-v7/buyer/rfq' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Все запросы
        </Link>
      </div>
    </div>
  );
}
