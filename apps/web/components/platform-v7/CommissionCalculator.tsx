'use client';

import { useState, useMemo } from 'react';

interface DealParams {
  volumeTons: string;
  pricePerTon: string;
  hasFaktoring: boolean;
  hasEdo: boolean;
}

const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

const SELLER_COMMISSION_PCT = 0.005;
const BUYER_COMMISSION_PCT = 0.005;
const EDO_FIXED_RUB = 1_200;
const NDS_PCT = 0.20;
const FAKTORING_PCT = 0.145;

function parseNum(s: string): number {
  const v = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return isNaN(v) || v < 0 ? 0 : v;
}

function fmt(rub: number, decimals = 0): string {
  if (rub === 0) return '0 ₽';
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(decimals > 0 ? decimals : 0)} тыс. ₽`;
  return `${Math.round(rub).toLocaleString('ru-RU')} ₽`;
}

function Row({ label: l, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'blue' }) {
  const color = highlight === 'green' ? '#0A7A5F' : highlight === 'red' ? '#DC2626' : highlight === 'blue' ? '#2563EB' : '#0F1419';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div>
        <span style={{ fontSize: 12, color: '#374151' }}>{l}</span>
        {sub && <div style={{ fontSize: 10, color: '#94A3B8' }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'var(--font-mono)', minWidth: 120, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function CommissionCalculator() {
  const [params, setParams] = useState<DealParams>({
    volumeTons: '500',
    pricePerTon: '14500',
    hasFaktoring: false,
    hasEdo: true,
  });
  const [role, setRole] = useState<'seller' | 'buyer'>('seller');

  const calc = useMemo(() => {
    const volume = parseNum(params.volumeTons);
    const price = parseNum(params.pricePerTon);
    const gmv = volume * price;
    const sellerComm = gmv * SELLER_COMMISSION_PCT;
    const buyerComm = gmv * BUYER_COMMISSION_PCT;
    const edoFee = params.hasEdo ? EDO_FIXED_RUB : 0;
    const sellerNds = sellerComm * NDS_PCT;
    const buyerNds = buyerComm * NDS_PCT;
    const faktoComm = params.hasFaktoring ? gmv * FAKTORING_PCT : 0;
    const sellerNet = gmv - sellerComm - sellerNds - edoFee - faktoComm;
    const buyerTotal = gmv + buyerComm + buyerNds + edoFee;
    const platformRevenue = sellerComm + buyerComm;
    return { gmv, sellerComm, buyerComm, edoFee, sellerNds, buyerNds, faktoComm, sellerNet, buyerTotal, platformRevenue };
  }, [params]);

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E4E6EA',
    fontSize: 13, fontWeight: 700, color: '#0F1419', background: '#F8FAFB', outline: 'none',
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <div>
          <div style={{ ...label, marginBottom: 4 }}>Объём (тонн)</div>
          <input
            type="number" min="1" step="1"
            value={params.volumeTons}
            onChange={(e) => setParams((p) => ({ ...p, volumeTons: e.target.value }))}
            style={inp}
          />
        </div>
        <div>
          <div style={{ ...label, marginBottom: 4 }}>Цена (₽/т)</div>
          <input
            type="number" min="1" step="100"
            value={params.pricePerTon}
            onChange={(e) => setParams((p) => ({ ...p, pricePerTon: e.target.value }))}
            style={inp}
          />
        </div>
      </div>

      {/* Options + Role toggle */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, background: '#F8FAFB', borderRadius: 999, padding: 3, border: '1px solid #E4E6EA' }}>
          {(['seller', 'buyer'] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, background: role === r ? '#0F1419' : 'transparent', color: role === r ? '#fff' : '#64748B' }}>
              {r === 'seller' ? 'Продавец' : 'Покупатель'}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={params.hasEdo} onChange={(e) => setParams((p) => ({ ...p, hasEdo: e.target.checked }))} />
          ЭДО (Диадок) +{fmt(EDO_FIXED_RUB)} фиксированно
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={params.hasFaktoring} onChange={(e) => setParams((p) => ({ ...p, hasFaktoring: e.target.checked }))} />
          Факторинг ({(FAKTORING_PCT * 100).toFixed(1)}% от суммы)
        </label>
      </div>

      {/* Result card */}
      <div style={{ border: '1px solid #E4E6EA', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '10px 14px', background: '#F8FAFB', borderBottom: '1px solid #E4E6EA', fontSize: 11, fontWeight: 900, color: '#64748B', textTransform: 'uppercase' }}>
          Расчёт {role === 'seller' ? 'продавца' : 'покупателя'} · {parseNum(params.volumeTons)} т × {parseNum(params.pricePerTon).toLocaleString('ru-RU')} ₽/т
        </div>
        <div style={{ padding: '0 14px' }}>
          <Row label="Сумма сделки (GMV)" value={fmt(calc.gmv)} />
          {role === 'seller' ? (
            <>
              <Row label="Комиссия платформы (продавец)" value={`−${fmt(calc.sellerComm)}`} sub={`${(SELLER_COMMISSION_PCT * 100).toFixed(1)}% от GMV`} highlight="red" />
              <Row label="НДС с комиссии (20%)" value={`−${fmt(calc.sellerNds)}`} highlight="red" />
              {params.hasEdo && <Row label="ЭДО (Диадок)" value={`−${fmt(calc.edoFee)}`} highlight="red" />}
              {params.hasFaktoring && <Row label="Факторинг" value={`−${fmt(calc.faktoComm)}`} sub={`${(FAKTORING_PCT * 100).toFixed(1)}% — авансирование под уступку`} highlight="red" />}
              <Row label="Итого к получению" value={fmt(calc.sellerNet)} highlight="green" />
            </>
          ) : (
            <>
              <Row label="Комиссия платформы (покупатель)" value={`+${fmt(calc.buyerComm)}`} sub={`${(BUYER_COMMISSION_PCT * 100).toFixed(1)}% от GMV`} highlight="red" />
              <Row label="НДС с комиссии (20%)" value={`+${fmt(calc.buyerNds)}`} highlight="red" />
              {params.hasEdo && <Row label="ЭДО (Диадок)" value={`+${fmt(calc.edoFee)}`} highlight="red" />}
              <Row label="Итого к оплате" value={fmt(calc.buyerTotal)} highlight="blue" />
            </>
          )}
        </div>
      </div>

      {/* Platform revenue */}
      <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={label}>Выручка платформы с одной сделки</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0A7A5F', marginTop: 2 }}>{fmt(calc.platformRevenue)}</div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>без НДС</div>
        </div>
        <div>
          <div style={label}>Take Rate</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0A7A5F', marginTop: 2 }}>{calc.gmv > 0 ? ((calc.platformRevenue / calc.gmv) * 100).toFixed(2) : '0.00'}%</div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. Комиссия: 0.5% продавец + 0.5% покупатель. ЭДО: фиксированный тариф Диадок. НДС 20% с комиссии. Факторинг: ставка ориентировочная. Реальный расчёт — перед подтверждением сделки.
      </div>
    </div>
  );
}
