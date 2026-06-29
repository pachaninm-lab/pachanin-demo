'use client';

import { useState } from 'react';

type WagonStatus = 'loading' | 'in_transit' | 'arrived' | 'unloading' | 'returned' | 'delay';

interface RzdShipment {
  id: string;
  etranId: string;
  dealId: string;
  culture: string;
  volumeTons: number;
  wagonCount: number;
  departureStation: string;
  destinationStation: string;
  departedAt: string;
  etaAt: string;
  status: WagonStatus;
  distanceKm: number;
  completedPct: number;
  wagons: { num: string; tonnage: number; status: WagonStatus }[];
}

const STATUS_CONFIG: Record<WagonStatus, { label: string; bg: string; color: string }> = {
  loading:    { label: 'Погрузка',        bg: '#EDE9FE', color: '#5B21B6' },
  in_transit: { label: 'В пути',          bg: '#DBEAFE', color: '#1E40AF' },
  arrived:    { label: 'Прибыл',          bg: '#D1FAE5', color: '#065F46' },
  unloading:  { label: 'Выгрузка',        bg: '#FEF3C7', color: '#92400E' },
  returned:   { label: 'Возврат порожних', bg: '#F1F5F9', color: '#475569' },
  delay:      { label: 'Задержка',        bg: '#FEE2E2', color: '#991B1B' },
};

const DEMO_SHIPMENTS: RzdShipment[] = [
  {
    id: 'rzd-001',
    etranId: 'ЭТ-2024-091456',
    dealId: 'DL-9095',
    culture: 'Пшеница 3 кл',
    volumeTons: 4320,
    wagonCount: 54,
    departureStation: 'Кочетовка (Тамбов)',
    destinationStation: 'Новороссийск-Экспорт',
    departedAt: '2024-03-10T06:00:00Z',
    etaAt: '2024-03-14T18:00:00Z',
    status: 'in_transit',
    distanceKm: 1240,
    completedPct: 68,
    wagons: [
      { num: '56231004', tonnage: 80, status: 'in_transit' },
      { num: '56231012', tonnage: 80, status: 'in_transit' },
      { num: '56231020', tonnage: 80, status: 'delay' },
      { num: '56231038', tonnage: 80, status: 'in_transit' },
    ],
  },
  {
    id: 'rzd-002',
    etranId: 'ЭТ-2024-089213',
    dealId: 'DL-9088',
    culture: 'Ячмень 2 кл',
    volumeTons: 2160,
    wagonCount: 27,
    departureStation: 'Мичуринск-Уральский',
    destinationStation: 'Азов-Порт',
    departedAt: '2024-03-08T12:00:00Z',
    etaAt: '2024-03-12T08:00:00Z',
    status: 'arrived',
    distanceKm: 920,
    completedPct: 100,
    wagons: [
      { num: '58441100', tonnage: 80, status: 'arrived' },
      { num: '58441118', tonnage: 80, status: 'arrived' },
      { num: '58441126', tonnage: 80, status: 'arrived' },
    ],
  },
  {
    id: 'rzd-003',
    etranId: 'ЭТ-2024-093701',
    dealId: 'DL-9110',
    culture: 'Кукуруза',
    volumeTons: 1840,
    wagonCount: 23,
    departureStation: 'Лиски (Воронеж)',
    destinationStation: 'Ростов-Товарный',
    departedAt: '2024-03-14T14:00:00Z',
    etaAt: '2024-03-16T20:00:00Z',
    status: 'loading',
    distanceKm: 380,
    completedPct: 0,
    wagons: [
      { num: '60112204', tonnage: 80, status: 'loading' },
      { num: '60112212', tonnage: 80, status: 'loading' },
    ],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function EtranRzdPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const shipment = DEMO_SHIPMENTS.find((s) => s.id === selected);

  const active = DEMO_SHIPMENTS.filter((s) => s.status === 'in_transit' || s.status === 'loading').length;
  const delayed = DEMO_SHIPMENTS.filter((s) => s.status === 'delay').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Всего ж/д отправок', value: DEMO_SHIPMENTS.length, color: '#0F1419' },
          { label: 'В движении', value: active, color: '#2563EB' },
          { label: 'Задержки', value: delayed, color: delayed > 0 ? '#DC2626' : '#059669' },
          { label: 'Вагонов всего', value: DEMO_SHIPMENTS.reduce((s, r) => s + r.wagonCount, 0), color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Shipment list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {DEMO_SHIPMENTS.map((s) => {
          const cfg = STATUS_CONFIG[s.status];
          const isSelected = selected === s.id;
          return (
            <div key={s.id} style={{ borderRadius: 12, border: `1px solid ${isSelected ? '#2563EB' : '#E4E6EA'}`, background: isSelected ? '#EFF6FF' : '#F8FAFB', overflow: 'hidden' }}>
              <button
                onClick={() => setSelected(isSelected ? null : s.id)}
                style={{ width: '100%', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#2563EB', fontWeight: 900 }}>{s.etranId}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <a href={`/platform-v7/deals/${s.dealId}/clean`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 9, color: '#0A7A5F', fontFamily: 'monospace', textDecoration: 'none', fontWeight: 700 }}>{s.dealId}</a>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{s.culture} · {s.volumeTons.toLocaleString('ru-RU')} т · {s.wagonCount} вагонов</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{s.departureStation} → {s.destinationStation} · {s.distanceKm} км</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: '#0F1419', fontWeight: 700 }}>
                    {s.status === 'arrived' ? 'Прибыл' : `ETA: ${new Date(s.etaAt).toLocaleDateString('ru-RU')}`}
                  </div>
                </div>
              </button>

              {/* Progress bar */}
              {(s.status === 'in_transit' || s.status === 'arrived') && (
                <div style={{ margin: '0 14px 8px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                  <span style={{ color: '#64748B', minWidth: 60 }}>{s.departureStation.split(' ')[0]}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E4E6EA', overflow: 'hidden' }}>
                    <div style={{ width: `${s.completedPct}%`, height: '100%', background: s.completedPct === 100 ? '#0A7A5F' : '#2563EB', borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ color: '#2563EB', fontWeight: 700, minWidth: 36 }}>{s.completedPct}%</span>
                  <span style={{ color: '#64748B', minWidth: 60, textAlign: 'right' }}>{s.destinationStation.split(' ')[0]}</span>
                </div>
              )}

              {/* Expanded wagon list */}
              {isSelected && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '10px 14px', background: '#fff' }}>
                  <div style={{ ...lbl, marginBottom: 8 }}>Вагоны (показаны {s.wagons.length} из {s.wagonCount})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 6 }}>
                    {s.wagons.map((w) => {
                      const wcfg = STATUS_CONFIG[w.status];
                      return (
                        <div key={w.num} style={{ padding: '8px 10px', borderRadius: 8, background: wcfg.bg + '44', border: `1px solid ${wcfg.color}33` }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{w.num}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10 }}>
                            <span style={{ color: '#64748B' }}>{w.tonnage} т</span>
                            <span style={{ color: wcfg.color, fontWeight: 700 }}>{wcfg.label}</span>
                          </div>
                        </div>
                      );
                    })}
                    {s.wagonCount > s.wagons.length && (
                      <div style={{ padding: '8px 10px', borderRadius: 8, background: '#F1F5F9', border: '1px solid #E4E6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748B' }}>
                        +{s.wagonCount - s.wagons.length} вагонов
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      ЭТрН PDF
                    </button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Акт ГУ-12
                    </button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Претензия ж/д
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        РЖД ЭТРАН · ж/д накладная (форма ГУ-29у) · Трекинг вагонов по ОКПО и номеру вагона · Интеграция требует договора с РЖД ГВЦ · Демо-данные.
      </div>
    </div>
  );
}
