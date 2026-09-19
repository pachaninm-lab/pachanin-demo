'use client';

import { useState } from 'react';

interface InvoiceData {
  dealId: string;
  sellerName: string;
  sellerInn: string;
  buyerName: string;
  buyerInn: string;
  culture: string;
  volumeTons: number;
  pricePerTon: number;
  vatPct: number;
}

const DEMO: InvoiceData = {
  dealId: 'DL-9102',
  sellerName: 'ООО «АгроТамбов»',
  sellerInn: '6829012345',
  buyerName: 'ООО «ЗернаТрейд»',
  buyerInn: '3664567890',
  culture: 'Пшеница 4 класса',
  volumeTons: 120,
  pricePerTon: 12500,
  vatPct: 10,
};

function rub(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function rubWords(n: number) {
  // Simplified: just return formatted string for demo
  return `${n.toLocaleString('ru-RU')} рублей 00 копеек`;
}

export function InvoiceGenerator({ dealId = 'DL-9102' }: { dealId?: string }) {
  const data: InvoiceData = { ...DEMO, dealId };
  const [generated, setGenerated] = useState(false);
  const [format, setFormat] = useState<'pdf' | 'xlsx' | 'xml'>('pdf');

  const subtotal = data.volumeTons * data.pricePerTon;
  const vat = Math.round(subtotal * data.vatPct / 100);
  const total = subtotal + vat;
  const invoiceNum = `СФ-${dealId}-001`;
  const today = new Date().toLocaleDateString('ru-RU');

  function generate() {
    setGenerated(true);
    setTimeout(() => setGenerated(false), 4000);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Format selector */}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        {(['pdf', 'xlsx', 'xml'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
              background: format === f ? '#2563EB' : 'transparent',
              color: format === f ? '#fff' : 'var(--pc-text-muted)',
              border: `1px solid ${format === f ? 'transparent' : 'var(--p7-color-border)'}`,
              textTransform: 'uppercase',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Invoice preview */}
      <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {/* Header */}
        <div style={{ background: '#F8FAFB', borderBottom: '2px solid #0A7A5F', padding: '1rem 1.25rem', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Счёт-фактура</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0F1419', marginTop: 2 }}>{invoiceNum}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>от {today}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748B' }}>По сделке</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F', fontFamily: 'var(--font-mono)' }}>{dealId}</div>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid #E4E6EA' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderRight: '1px solid #E4E6EA' }}>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Продавец</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419' }}>{data.sellerName}</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>ИНН: {data.sellerInn}</div>
          </div>
          <div style={{ padding: '0.875rem 1.25rem' }}>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Покупатель</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419' }}>{data.buyerName}</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>ИНН: {data.buyerInn}</div>
          </div>
        </div>

        {/* Items table */}
        <div style={{ padding: '0.875rem 1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E6EA' }}>
                {['Наименование', 'Кол-во (т)', 'Цена (₽/т)', 'Сумма (₽)'].map((h) => (
                  <th key={h} style={{ padding: '6px 4px', textAlign: 'left', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px 4px', color: '#0F1419', fontWeight: 600 }}>{data.culture}</td>
                <td style={{ padding: '8px 4px', color: '#0F1419' }}>{data.volumeTons}</td>
                <td style={{ padding: '8px 4px', color: '#0F1419' }}>{data.pricePerTon.toLocaleString('ru-RU')}</td>
                <td style={{ padding: '8px 4px', color: '#0F1419', fontWeight: 700 }}>{subtotal.toLocaleString('ru-RU')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: '0 1.25rem 0.875rem', display: 'grid', gap: 4, borderTop: '1px solid #E4E6EA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', padding: '6px 0' }}>
            <span>Итого без НДС:</span>
            <span>{rub(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', padding: '6px 0', borderBottom: '1px solid #E4E6EA' }}>
            <span>НДС ({data.vatPct}%):</span>
            <span>{rub(vat)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: '#0F1419', padding: '8px 0' }}>
            <span>Итого к оплате:</span>
            <span style={{ color: '#0A7A5F' }}>{rub(total)}</span>
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>
            Сумма прописью: {rubWords(total)}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={generate}
        style={{
          padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: generated ? '#059669' : '#2563EB', color: '#fff',
          fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
          transition: 'background 200ms',
        }}
      >
        {generated ? '✓ Счёт-фактура сформирована' : `Сформировать ${format.toUpperCase()}`}
      </button>

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '4px 8px', borderRadius: 6, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Демо-превью. В боевом контуре — формат УПД/СФ по приказу ФНС ММВ-7-15/820@, подписывается КЭП через СБИС или Диадок.
      </div>
    </div>
  );
}
