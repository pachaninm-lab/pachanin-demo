'use client';

import { useState } from 'react';

type WagonOwnership = 'own' | 'rented' | 'attracted';
type WagonStatus = 'loading' | 'en_route' | 'unloading' | 'idle' | 'repair';

interface Wagon {
  id: string;
  number: string;
  type: 'hopper' | 'covered' | 'platform';
  ownership: WagonOwnership;
  status: WagonStatus;
  capacity: number;
  currentLoad: number;
  location: string;
  eta: string | null;
  dealId: string | null;
  demurrageDays: number;
  normDays: number;
}

interface Gu12Request {
  id: string;
  dealId: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  from: string;
  to: string;
  cultureCode: string;
  wagonsCount: number;
  submittedAt: string;
  approvedAt: string | null;
  etranRef: string | null;
}

const WAGONS: Wagon[] = [
  { id: 'w-001', number: '52134789', type: 'hopper', ownership: 'own', status: 'en_route', capacity: 68, currentLoad: 65.4, location: 'Ростов-на-Дону → Новороссийск', eta: '2024-03-22', dealId: 'DL-9095', demurrageDays: 0, normDays: 3 },
  { id: 'w-002', number: '54219876', type: 'hopper', ownership: 'rented', status: 'loading', capacity: 68, currentLoad: 32.0, location: 'ст. Каменоломни', eta: null, dealId: 'DL-9110', demurrageDays: 1, normDays: 2 },
  { id: 'w-003', number: '58901234', type: 'covered', ownership: 'attracted', status: 'idle', capacity: 62, currentLoad: 0, location: 'ст. Тихорецкая', eta: null, dealId: null, demurrageDays: 4, normDays: 2 },
  { id: 'w-004', number: '51782345', type: 'hopper', ownership: 'own', status: 'unloading', capacity: 68, currentLoad: 68.0, location: 'ст. Новороссийск-порт', eta: null, dealId: 'DL-9095', demurrageDays: 0, normDays: 3 },
  { id: 'w-005', number: '53498712', type: 'hopper', ownership: 'rented', status: 'repair', capacity: 68, currentLoad: 0, location: 'Ростовский ВРЗ', eta: null, dealId: null, demurrageDays: 0, normDays: 0 },
];

const GU12_REQUESTS: Gu12Request[] = [
  { id: 'gu-001', dealId: 'DL-9095', status: 'approved', from: 'ст. Каменоломни (Ростовская обл.)', to: 'ст. Новороссийск-порт', cultureCode: 'Пшеница 3кл ГОСТ 9353', wagonsCount: 8, submittedAt: '2024-03-15T09:00:00Z', approvedAt: '2024-03-15T14:32:00Z', etranRef: 'ЭТРАН-2024-03-441892' },
  { id: 'gu-002', dealId: 'DL-9110', status: 'sent', from: 'ст. Кущёвская (Краснодарский кр.)', to: 'ст. Краснодар-Сортировочный', cultureCode: 'Ячмень ГОСТ 28672', wagonsCount: 4, submittedAt: '2024-03-19T11:15:00Z', approvedAt: null, etranRef: 'ЭТРАН-2024-03-449107' },
  { id: 'gu-003', dealId: 'DL-9118', status: 'draft', from: 'ст. Зерноград (Ростовская обл.)', to: 'ст. Ейск', cultureCode: 'Подсолнечник ГОСТ Р 52385', wagonsCount: 6, submittedAt: '', approvedAt: null, etranRef: null },
];

const OWN_LABELS: Record<WagonOwnership, { label: string; bg: string; color: string }> = {
  own:       { label: 'Собственный',   bg: '#D1FAE5', color: '#065F46' },
  rented:    { label: 'Арендованный',  bg: '#EFF6FF', color: '#1E40AF' },
  attracted: { label: 'Привлечённый',  bg: '#F5F3FF', color: '#5B21B6' },
};

const STATUS_LABELS: Record<WagonStatus, { label: string; bg: string; color: string }> = {
  loading:   { label: 'Погрузка',    bg: '#FEF3C7', color: '#92400E' },
  en_route:  { label: 'В пути',      bg: '#D1FAE5', color: '#065F46' },
  unloading: { label: 'Выгрузка',    bg: '#EFF6FF', color: '#1E40AF' },
  idle:      { label: 'Простой',     bg: '#FEE2E2', color: '#991B1B' },
  repair:    { label: 'Ремонт',      bg: '#F1F5F9', color: '#64748B' },
};

const GU_STATUS: Record<Gu12Request['status'], { label: string; bg: string; color: string }> = {
  draft:    { label: 'Черновик',   bg: '#F1F5F9', color: '#64748B' },
  sent:     { label: 'Отправлена', bg: '#FEF3C7', color: '#92400E' },
  approved: { label: 'Одобрена',   bg: '#D1FAE5', color: '#065F46' },
  rejected: { label: 'Отклонена',  bg: '#FEE2E2', color: '#991B1B' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'wagons' | 'gu12' | 'demurrage';

function calcDemurrageCost(days: number, normDays: number) {
  const excess = Math.max(0, days - normDays);
  return excess * 1800;
}

export function RailwayLogisticsPanel() {
  const [tab, setTab] = useState<Tab>('wagons');

  const totalWagons = WAGONS.length;
  const enRoute = WAGONS.filter(w => w.status === 'en_route').length;
  const demurrageWagons = WAGONS.filter(w => w.demurrageDays > w.normDays);
  const totalDemurrage = demurrageWagons.reduce((s, w) => s + calcDemurrageCost(w.demurrageDays, w.normDays), 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Вагонов',       value: totalWagons,        color: '#0F1419' },
          { label: 'В пути',        value: enRoute,            color: '#065F46' },
          { label: 'Заявок ГУ-12',  value: GU12_REQUESTS.length, color: '#1E40AF' },
          { label: 'Демередж (₽)',  value: totalDemurrage > 0 ? `${totalDemurrage.toLocaleString('ru-RU')} ₽` : '0', color: totalDemurrage > 0 ? '#DC2626' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ЭТРАН info */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        РЖД ЭТРАН API v3 · ГУ-12 (заявка на перевозку) · ГУ-29 (ж/д накладная) · Отслеживание ЭТРАН/ГВЦ ОАО «РЖД» · RFID-теги на вагонах · Демередж: авторасчёт при простое &gt; нормы
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['wagons', 'Вагонный парк'], ['gu12', 'Заявки ГУ-12'], ['demurrage', 'Демередж']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'wagons' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {WAGONS.map((w) => {
            const own = OWN_LABELS[w.ownership];
            const st = STATUS_LABELS[w.status];
            const demurrage = calcDemurrageCost(w.demurrageDays, w.normDays);
            return (
              <div key={w.id} style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${demurrage > 0 ? '#FECACA' : '#E4E6EA'}`, background: demurrage > 0 ? '#FEF2F2' : '#F8FAFB' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>№{w.number}</code>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: own.bg, color: own.color }}>{own.label}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                  {w.dealId && <span style={{ fontSize: 8, color: '#6B7280' }}>→ {w.dealId}</span>}
                  {demurrage > 0 && <span style={{ fontSize: 9, fontWeight: 900, color: '#DC2626' }}>⚠ Демередж: {demurrage.toLocaleString('ru-RU')} ₽</span>}
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
                  {w.location}{w.eta ? ` · ETA: ${w.eta}` : ''} · Загрузка: {w.currentLoad}/{w.capacity} т
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'gu12' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {GU12_REQUESTS.map((r) => {
            const st = GU_STATUS[r.status];
            return (
              <div key={r.id} style={{ borderRadius: 10, border: '1px solid #E4E6EA', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#F8FAFB', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{r.id.toUpperCase()}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ fontSize: 9, color: '#64748B' }}>{r.dealId} · {r.wagonsCount} ваг.</span>
                  {r.etranRef && <code style={{ fontSize: 8, color: '#1E40AF' }}>{r.etranRef}</code>}
                </div>
                <div style={{ padding: '6px 12px', background: '#fff', fontSize: 9, color: '#374151', display: 'grid', gap: 2 }}>
                  <div><span style={lbl}>Откуда: </span>{r.from}</div>
                  <div><span style={lbl}>Куда: </span>{r.to}</div>
                  <div><span style={lbl}>Груз: </span>{r.cultureCode}</div>
                  {r.submittedAt && <div><span style={lbl}>Отправлена: </span>{new Date(r.submittedAt).toLocaleString('ru-RU')}</div>}
                  {r.approvedAt && <div><span style={lbl}>Одобрена: </span>{new Date(r.approvedAt).toLocaleString('ru-RU')}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {r.status === 'draft' && <button style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', fontWeight: 700, color: '#065F46' }}>Отправить в ЭТРАН</button>}
                    <button style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>ГУ-29 PDF</button>
                  </div>
                </div>
              </div>
            );
          })}
          <button style={{ padding: '6px 14px', borderRadius: 8, border: '1px dashed #1E40AF', background: 'transparent', color: '#1E40AF', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            + Новая заявка ГУ-12
          </button>
        </div>
      )}

      {tab === 'demurrage' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={lbl}>Простой вагонов сверх нормы — авторасчёт демереджа (1 800 ₽/ваг·сут)</div>
          {WAGONS.map((w) => {
            const excess = Math.max(0, w.demurrageDays - w.normDays);
            const cost = excess * 1800;
            return (
              <div key={w.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: cost > 0 ? '#FEF2F2' : '#F8FAFB', border: `1px solid ${cost > 0 ? '#FECACA' : '#E4E6EA'}` }}>
                <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', minWidth: 90 }}>№{w.number}</code>
                <span style={{ fontSize: 9, color: '#64748B', flex: 1 }}>{w.location}</span>
                <span style={{ fontSize: 9, color: '#374151', minWidth: 110 }}>Простой: {w.demurrageDays} сут / норма {w.normDays} сут</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: cost > 0 ? '#DC2626' : '#065F46', minWidth: 90, textAlign: 'right' }}>{cost > 0 ? `${cost.toLocaleString('ru-RU')} ₽` : 'Без штрафа'}</span>
              </div>
            );
          })}
          {totalDemurrage > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#991B1B' }}>Итого демередж к начислению</span>
              <span style={{ fontWeight: 900, fontSize: 14, color: '#DC2626' }}>{totalDemurrage.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        РЖД ЭТРАН · ГУ-12 (заявка на перевозку) · ГУ-29 (накладная) · ГВЦ ОАО «РЖД» · Демередж авторасчёт · Собственный/арендованный/привлечённый парк · Демо-данные.
      </div>
    </div>
  );
}
