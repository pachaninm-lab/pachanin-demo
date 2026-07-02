'use client';

import { useState } from 'react';

type WeighingStatus = 'ok' | 'discrepancy' | 'pending';

interface WeighingRecord {
  id: string;
  actId: string;
  dealId: string;
  vehicleType: 'truck' | 'wagon' | 'ship';
  vehicleNum: string;
  culture: string;
  claimedTons: number;
  actualTons: number;
  moisturePct: number;
  dockStation: string;
  weighedAt: string;
  status: WeighingStatus;
  deviceModel: string;
  operator: string;
  photoCount: number;
}

const STATUS_CONFIG: Record<WeighingStatus, { label: string; bg: string; color: string }> = {
  ok:           { label: 'Принято',         bg: '#D1FAE5', color: '#065F46' },
  discrepancy:  { label: 'Расхождение',     bg: '#FEE2E2', color: '#991B1B' },
  pending:      { label: 'Ожидает подп.',   bg: '#FEF3C7', color: '#92400E' },
};

const VEHICLE_ICON: Record<WeighingRecord['vehicleType'], string> = {
  truck: '🚛',
  wagon: '🚃',
  ship:  '🚢',
};

const DEMO_RECORDS: WeighingRecord[] = [
  { id: 'w-001', actId: 'ACT-2024-0891', dealId: 'DL-9095', vehicleType: 'truck', vehicleNum: 'ТМБ-14', culture: 'Пшеница 3 кл', claimedTons: 48.2, actualTons: 48.05, moisturePct: 12.4, dockStation: 'Элеватор «Тамбовский»', weighedAt: '2024-01-16T09:15:00Z', status: 'ok',          deviceModel: 'Тензо-М Т-500', operator: 'Михайлов А.В.', photoCount: 3 },
  { id: 'w-002', actId: 'ACT-2024-0892', dealId: 'DL-9110', vehicleType: 'wagon', vehicleNum: '56231084', culture: 'Кукуруза',    claimedTons: 68.5, actualTons: 65.9,  moisturePct: 13.1, dockStation: 'Воронежский ХПК', weighedAt: '2024-03-13T11:30:00Z', status: 'discrepancy', deviceModel: 'Весы ВА-60',    operator: 'Петров С.И.', photoCount: 5 },
  { id: 'w-003', actId: 'ACT-2024-0893', dealId: 'DL-9088', vehicleType: 'truck', vehicleNum: 'СТВ-22',  culture: 'Ячмень 2 кл',  claimedTons: 52.0, actualTons: 51.8,  moisturePct: 11.8, dockStation: 'Ставропольский ЗАТ', weighedAt: '2024-02-09T08:00:00Z', status: 'pending',      deviceModel: 'Мера ВТ-200',   operator: 'Козлов Д.Р.', photoCount: 2 },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function diff(rec: WeighingRecord) {
  return +(rec.actualTons - rec.claimedTons).toFixed(2);
}

export function IoTWeighingPanel() {
  const [selected, setSelected] = useState<string | null>(null);

  const totalDiscrepancy = DEMO_RECORDS
    .filter((r) => r.status === 'discrepancy')
    .reduce((s, r) => s + Math.abs(diff(r)), 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'Актов взвеш.', value: DEMO_RECORDS.length, color: '#0F1419' },
          { label: 'Принято',      value: DEMO_RECORDS.filter(r => r.status === 'ok').length, color: '#0A7A5F' },
          { label: 'Расхождений', value: DEMO_RECORDS.filter(r => r.status === 'discrepancy').length, color: DEMO_RECORDS.some(r => r.status === 'discrepancy') ? '#DC2626' : '#0A7A5F' },
          { label: 'Суммар. расх.', value: `${totalDiscrepancy.toFixed(1)} т`, color: totalDiscrepancy > 0 ? '#DC2626' : '#0A7A5F' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Records */}
      <div style={{ display: 'grid', gap: 8 }}>
        {DEMO_RECORDS.map((r) => {
          const cfg = STATUS_CONFIG[r.status];
          const d = diff(r);
          const isOpen = selected === r.id;
          return (
            <div key={r.id} style={{ borderRadius: 12, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden', background: isOpen ? '#F0FDF4' : '#F8FAFB' }}>
              <button onClick={() => setSelected(isOpen ? null : r.id)} style={{ width: '100%', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{VEHICLE_ICON[r.vehicleType]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{r.actId}</code>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    {r.status === 'discrepancy' && <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 6px', borderRadius: 4 }}>{d > 0 ? '+' : ''}{d} т</span>}
                    <a href={`/platform-v7/deals/${r.dealId}/clean`} onClick={e => e.stopPropagation()} style={{ fontSize: 9, color: '#0A7A5F', fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none' }}>{r.dealId}</a>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{r.culture} · {r.vehicleNum} · {r.dockStation}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Заявлено: {r.claimedTons} т · Факт: {r.actualTons} т · Влажность: {r.moisturePct}%</div>
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'right', flexShrink: 0 }}>
                  {new Date(r.weighedAt).toLocaleDateString('ru-RU')}
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '12px 14px', background: '#fff', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                    {[
                      { label: 'Весовое устройство', value: r.deviceModel },
                      { label: 'Оператор', value: r.operator },
                      { label: 'Фото-фиксация', value: `${r.photoCount} снимка` },
                      { label: 'Расхождение', value: d === 0 ? '0 т' : `${d > 0 ? '+' : ''}${d} т (${((Math.abs(d)/r.claimedTons)*100).toFixed(1)}%)` },
                    ].map((s) => (
                      <div key={s.label}>
                        <div style={lbl}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {r.status === 'discrepancy' && (
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 10, color: '#991B1B', fontWeight: 700 }}>
                      ⚠ Расхождение {Math.abs(d)} т ({((Math.abs(d)/r.claimedTons)*100).toFixed(1)}%) превышает допуск 0.5%. Требуется акт пересчёта или пересогласование.
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Акт PDF
                    </button>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>
                      Фото ({r.photoCount})
                    </button>
                    {r.status === 'pending' && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>
                        Подписать УКЭП
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Device status */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Весовое оборудование · статус интеграции</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 6 }}>
          {[
            { model: 'Тензо-М Т-500', type: 'Автомобильные весы', status: 'online', protocol: 'TCP/RS-485' },
            { model: 'Весы ВА-60',    type: 'Вагонные весы',      status: 'online', protocol: 'Файл CSV (Мера)' },
            { model: 'Мера ВТ-200',   type: 'Автомобильные весы', status: 'manual', protocol: 'Ручной ввод + фото' },
          ].map((d) => (
            <div key={d.model} style={{ padding: '8px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: d.status === 'online' ? '#0A7A5F' : '#D97706', flexShrink: 0 }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{d.model}</div>
              </div>
              <div style={{ fontSize: 9, color: '#64748B' }}>{d.type}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{d.protocol}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Весовые: Тензо-М / Мера / ВА · Протоколы: TCP / RS-485 / CSV · Фото-фиксация · УКЭП элеватора · Допуск 0.5% · Интеграция требует оборудования · Демо-данные.
      </div>
    </div>
  );
}
