'use client';

import { useState, useMemo } from 'react';

type Incoterm = 'EXW' | 'FCA' | 'FOB' | 'CFR' | 'CIF' | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP';
type Currency = 'RUB' | 'USD' | 'EUR' | 'CNY';

interface IncotermInfo {
  code: Incoterm;
  name: string;
  transfer: string;
  risk: string;
  typical: string;
  sellerCostPct: number;
}

const INCOTERMS: IncotermInfo[] = [
  { code: 'EXW', name: 'Ex Works', transfer: 'Склад продавца', risk: 'Покупатель несёт все расходы от склада', typical: 'Внутренние поставки, небольшие партии', sellerCostPct: 0 },
  { code: 'FCA', name: 'Free Carrier', transfer: 'У первого перевозчика', risk: 'Переход после передачи перевозчику', typical: 'Мультимодальный, контейнер', sellerCostPct: 3 },
  { code: 'FOB', name: 'Free on Board', transfer: 'На борту судна', risk: 'После погрузки на борт', typical: 'Морские насыпные грузы (зерно, ЖМК)', sellerCostPct: 8 },
  { code: 'CFR', name: 'Cost and Freight', transfer: 'На борту судна', risk: 'Фрахт до порта назначения за продавца', typical: 'Зерно: CFR Новороссийск → Стамбул', sellerCostPct: 14 },
  { code: 'CIF', name: 'Cost Insurance Freight', transfer: 'На борту судна', risk: 'CFR + страхование груза', typical: 'Экспортные контракты зерна', sellerCostPct: 15 },
  { code: 'CPT', name: 'Carriage Paid To', transfer: 'У первого перевозчика', risk: 'Перевозка до места назначения за продавца', typical: 'Ж/д поставки (РЖД ЭТРАН)', sellerCostPct: 12 },
  { code: 'CIP', name: 'Carriage and Insurance Paid', transfer: 'У первого перевозчика', risk: 'CPT + страхование', typical: 'Контейнерный экспорт', sellerCostPct: 13 },
  { code: 'DAP', name: 'Delivered at Place', transfer: 'Место назначения', risk: 'Продавец доставляет, таможня покупателя', typical: 'Ближнее зарубежье (Казахстан, Азербайджан)', sellerCostPct: 18 },
  { code: 'DPU', name: 'Delivered at Place Unloaded', transfer: 'После разгрузки', risk: 'Продавец разгружает в точке назначения', typical: 'Элеватор страны-покупателя', sellerCostPct: 20 },
  { code: 'DDP', name: 'Delivered Duty Paid', transfer: 'Место назначения', risk: 'Продавец несёт все расходы включая таможню', typical: 'Максимальная ответственность продавца', sellerCostPct: 25 },
];

const EXCHANGE_RATES: Record<Currency, number> = { RUB: 1, USD: 90.5, EUR: 98.2, CNY: 12.6 };
const CUSTOMS_DUTY_PCT = 0.10;
const VAT_EXPORT_PCT = 0;

const DESTINATION_PORTS = [
  { label: 'Стамбул (Турция)', distKm: 860, freightUsdTon: 22 },
  { label: 'Александрия (Египет)', distKm: 2100, freightUsdTon: 35 },
  { label: 'Бейрут (Ливан)', distKm: 1650, freightUsdTon: 28 },
  { label: 'Джакарта (Индонезия)', distKm: 9400, freightUsdTon: 68 },
  { label: 'Тяньцзинь (Китай)', distKm: 7200, freightUsdTon: 55 },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function parseNum(s: string) {
  const v = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return isNaN(v) || v < 0 ? 0 : v;
}

function fmtCurrency(rub: number, cur: Currency): string {
  const rate = EXCHANGE_RATES[cur];
  const val = rub / rate;
  const sym = { RUB: '₽', USD: '$', EUR: '€', CNY: '¥' }[cur];
  if (cur === 'RUB') {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} млн ₽`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)} тыс. ₽`;
    return `${Math.round(val).toLocaleString('ru-RU')} ₽`;
  }
  return `${sym} ${val.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}

export function IncotermsExportWidget() {
  const [volumeTons, setVolumeTons] = useState('500');
  const [pricePerTonRub, setPricePerTonRub] = useState('14500');
  const [selectedIncoterm, setSelectedIncoterm] = useState<Incoterm>('FOB');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [portIdx, setPortIdx] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const info = INCOTERMS.find((i) => i.code === selectedIncoterm)!;
  const port = DESTINATION_PORTS[portIdx];

  const calc = useMemo(() => {
    const vol = parseNum(volumeTons);
    const priceRub = parseNum(pricePerTonRub);
    const gmvRub = vol * priceRub;

    const sellerCostRub = gmvRub * (info.sellerCostPct / 100);
    const freightRub = port.freightUsdTon * EXCHANGE_RATES.USD * vol;
    const customsDutyRub = selectedIncoterm === 'DDP' ? gmvRub * CUSTOMS_DUTY_PCT : 0;
    const insuranceRub = ['CIF', 'CIP'].includes(selectedIncoterm) ? gmvRub * 0.005 : 0;
    const vatExportRub = gmvRub * VAT_EXPORT_PCT;

    const totalSellerCostRub = sellerCostRub + (selectedIncoterm !== 'EXW' && selectedIncoterm !== 'FCA' ? freightRub : 0) + insuranceRub + customsDutyRub;
    const netRevenueRub = gmvRub - totalSellerCostRub;

    return { gmvRub, sellerCostRub, freightRub, customsDutyRub, insuranceRub, vatExportRub, totalSellerCostRub, netRevenueRub };
  }, [volumeTons, pricePerTonRub, info, port, selectedIncoterm]);

  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E4E6EA', fontSize: 13, fontWeight: 700, color: '#0F1419', background: '#F8FAFB', outline: 'none' };
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <div>
          <div style={{ ...lbl, marginBottom: 4 }}>Объём (тонн)</div>
          <input type="number" min="1" value={volumeTons} onChange={(e) => setVolumeTons(e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ ...lbl, marginBottom: 4 }}>Цена (₽/т)</div>
          <input type="number" min="1" value={pricePerTonRub} onChange={(e) => setPricePerTonRub(e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ ...lbl, marginBottom: 4 }}>Валюта расчёта</div>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} style={sel}>
            <option value="RUB">₽ RUB ({EXCHANGE_RATES.RUB})</option>
            <option value="USD">$ USD ({EXCHANGE_RATES.USD})</option>
            <option value="EUR">€ EUR ({EXCHANGE_RATES.EUR})</option>
            <option value="CNY">¥ CNY ({EXCHANGE_RATES.CNY})</option>
          </select>
        </div>
        <div>
          <div style={{ ...lbl, marginBottom: 4 }}>Порт назначения</div>
          <select value={portIdx} onChange={(e) => setPortIdx(Number(e.target.value))} style={sel}>
            {DESTINATION_PORTS.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Incoterms selector */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Базис поставки (Incoterms 2020)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {INCOTERMS.map((inc) => (
            <button
              key={inc.code}
              onClick={() => setSelectedIncoterm(inc.code)}
              style={{ padding: '5px 12px', borderRadius: 8, border: selectedIncoterm === inc.code ? 'none' : '1px solid #E4E6EA', background: selectedIncoterm === inc.code ? '#0F1419' : '#F8FAFB', color: selectedIncoterm === inc.code ? '#fff' : '#64748B', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
            >
              {inc.code}
            </button>
          ))}
        </div>
      </div>

      {/* Selected incoterm info */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#0C4A6E' }}>{info.code} — {info.name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginTop: 8 }}>
          <div>
            <div style={lbl}>Переход риска</div>
            <div style={{ fontSize: 11, color: '#0F1419', marginTop: 2 }}>{info.transfer}</div>
          </div>
          <div>
            <div style={lbl}>Суть</div>
            <div style={{ fontSize: 11, color: '#0F1419', marginTop: 2 }}>{info.risk}</div>
          </div>
          <div>
            <div style={lbl}>Типичный сценарий</div>
            <div style={{ fontSize: 11, color: '#0F1419', marginTop: 2 }}>{info.typical}</div>
          </div>
        </div>
      </div>

      {/* Calculation */}
      <div style={{ border: '1px solid #E4E6EA', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '10px 14px', background: '#F8FAFB', borderBottom: '1px solid #E4E6EA', fontSize: 11, fontWeight: 900, color: '#64748B', textTransform: 'uppercase' }}>
          Расчёт экспортной сделки · {parseNum(volumeTons)} т · {info.code} · {port.label}
        </div>
        <div style={{ padding: '4px 14px 8px' }}>
          {[
            { label: 'Стоимость партии (GMV)', value: fmtCurrency(calc.gmvRub, currency), color: '#0F1419' },
            { label: `Затраты продавца (${info.sellerCostPct}% — логистика, порт)`, value: `−${fmtCurrency(calc.sellerCostRub, currency)}`, color: '#DC2626' },
            ...(calc.freightRub > 0 && !['EXW', 'FCA'].includes(selectedIncoterm) ? [{ label: `Фрахт ${port.label} (${port.freightUsdTon} $/т)`, value: `−${fmtCurrency(calc.freightRub, currency)}`, color: '#DC2626' }] : []),
            ...(calc.insuranceRub > 0 ? [{ label: 'Страхование груза (0.5%)', value: `−${fmtCurrency(calc.insuranceRub, currency)}`, color: '#DC2626' }] : []),
            ...(calc.customsDutyRub > 0 ? [{ label: 'Таможенная пошлина (10% DDP)', value: `−${fmtCurrency(calc.customsDutyRub, currency)}`, color: '#DC2626' }] : []),
            { label: 'НДС при экспорте', value: '0% (ставка 0)', color: '#059669' },
            { label: 'Выручка продавца нетто', value: fmtCurrency(calc.netRevenueRub, currency), color: '#0A7A5F' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: i < 5 ? '1px solid #F1F5F9' : 'none' }}>
              <span style={{ fontSize: 12, color: '#374151' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: row.color, fontFamily: 'monospace', minWidth: 120, textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange rates */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ ...lbl }}>Курс ЦБ РФ (демо)</div>
        {Object.entries(EXCHANGE_RATES).filter(([k]) => k !== 'RUB').map(([cur, rate]) => (
          <div key={cur} style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>
            {cur}: <span style={{ color: '#2563EB' }}>{rate} ₽</span>
          </div>
        ))}
        <div style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>Обновление: ежедневно в 11:30 МСК</div>
      </div>

      {/* Incoterms quick compare */}
      <button onClick={() => setShowDetails(!showDetails)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E4E6EA', background: '#F8FAFB', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#64748B', textAlign: 'left' }}>
        {showDetails ? '▲ Скрыть сравнение' : '▼ Сравнить все базисы по затратам продавца'}
      </button>
      {showDetails && (
        <div style={{ display: 'grid', gap: 4 }}>
          {INCOTERMS.map((inc) => {
            const pct = inc.sellerCostPct;
            const color = pct <= 5 ? '#059669' : pct <= 15 ? '#D97706' : '#DC2626';
            return (
              <div key={inc.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ fontWeight: 900, minWidth: 32, color: selectedIncoterm === inc.code ? '#0A7A5F' : '#64748B' }}>{inc.code}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E4E6EA', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(pct * 4, 2)}%`, height: '100%', background: color, borderRadius: 3 }} />
                </div>
                <span style={{ color, minWidth: 30, fontWeight: 700 }}>{pct}%</span>
                <span style={{ color: '#94A3B8', fontSize: 10 }}>{inc.name}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-расчёт. Incoterms® 2020 ICC. НДС 0% при экспорте (ст. 164 НК РФ). Таможня: ставки ФТС, демо. Фрахт: рыночные индикативы. Курс ЦБ РФ: демо. Реальный контракт согласовывается отдельно.
      </div>
    </div>
  );
}
