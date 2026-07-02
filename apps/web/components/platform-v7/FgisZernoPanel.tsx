'use client';

import { useState } from 'react';

type LotStatus = 'registered' | 'in_transit' | 'accepted' | 'rejected' | 'expired';
type ApiStatus = 'success' | 'error' | 'pending' | 'timeout';

interface FgisLot {
  id: string;
  fgisLotId: string;
  dealId: string;
  culture: string;
  volumeTons: number;
  qualityClass: string;
  status: LotStatus;
  certificateNum: string | null;
  registeredAt: string;
  expiresAt: string;
  sdizId: string | null;
}

interface FgisApiCall {
  id: string;
  method: string;
  endpoint: string;
  lotId: string;
  status: ApiStatus;
  httpCode: number | null;
  durationMs: number;
  retries: number;
  calledAt: string;
  error: string | null;
}

const LOTS: FgisLot[] = [
  { id: 'fl-001', fgisLotId: 'ФГИС-2024-РО-441892', dealId: 'DL-9095', culture: 'Пшеница мягкая 3кл', volumeTons: 424, qualityClass: '3', status: 'accepted', certificateNum: 'СДС-2024-РО-98712', registeredAt: '2024-03-01T08:00:00Z', expiresAt: '2024-09-01', sdizId: 'СДИЗ-2024-441892' },
  { id: 'fl-002', fgisLotId: 'ФГИС-2024-КК-449107', dealId: 'DL-9110', culture: 'Ячмень кормовой', volumeTons: 150, qualityClass: 'Кормовой', status: 'rejected', certificateNum: null, registeredAt: '2024-03-10T09:00:00Z', expiresAt: '2024-09-10', sdizId: null },
  { id: 'fl-003', fgisLotId: 'ФГИС-2024-РО-451200', dealId: 'DL-9118', culture: 'Подсолнечник', volumeTons: 186, qualityClass: 'ГОСТ Р 52385', status: 'registered', certificateNum: null, registeredAt: '2024-03-18T10:00:00Z', expiresAt: '2024-09-18', sdizId: 'СДИЗ-2024-451200' },
  { id: 'fl-004', fgisLotId: 'ФГИС-2024-РО-438000', dealId: 'DL-8901', culture: 'Пшеница мягкая 4кл', volumeTons: 320, qualityClass: '4', status: 'accepted', certificateNum: 'СДС-2024-РО-96400', registeredAt: '2024-02-10T07:30:00Z', expiresAt: '2024-08-10', sdizId: 'СДИЗ-2024-438000' },
];

const API_CALLS: FgisApiCall[] = [
  { id: 'ac-001', method: 'POST', endpoint: '/api/v2/lots/register', lotId: 'ФГИС-2024-РО-441892', status: 'success', httpCode: 200, durationMs: 342, retries: 0, calledAt: '2024-03-01T08:00:12Z', error: null },
  { id: 'ac-002', method: 'GET',  endpoint: '/api/v2/lots/certificate', lotId: 'ФГИС-2024-РО-441892', status: 'success', httpCode: 200, durationMs: 218, retries: 0, calledAt: '2024-03-01T08:05:00Z', error: null },
  { id: 'ac-003', method: 'POST', endpoint: '/api/v2/shipments/confirm', lotId: 'ФГИС-2024-РО-441892', status: 'success', httpCode: 200, durationMs: 455, retries: 0, calledAt: '2024-03-20T09:30:00Z', error: null },
  { id: 'ac-004', method: 'GET',  endpoint: '/api/v2/lots/status', lotId: 'ФГИС-2024-КК-449107', status: 'error', httpCode: 200, durationMs: 312, retries: 0, calledAt: '2024-03-15T14:00:00Z', error: 'aflatoxin B1 превышает ПДК: 8.2 мкг/кг (норма ≤ 5 мкг/кг)' },
  { id: 'ac-005', method: 'POST', endpoint: '/api/v2/lots/register', lotId: 'ФГИС-2024-РО-451200', status: 'timeout', httpCode: null, durationMs: 30000, retries: 2, calledAt: '2024-03-18T10:00:00Z', error: 'ФГИС API timeout после 30с — retry 2/3' },
  { id: 'ac-006', method: 'POST', endpoint: '/api/v2/lots/register', lotId: 'ФГИС-2024-РО-451200', status: 'success', httpCode: 200, durationMs: 521, retries: 0, calledAt: '2024-03-18T10:00:45Z', error: null },
];

const LOT_STATUS_CFG: Record<LotStatus, { label: string; bg: string; color: string }> = {
  registered: { label: 'Зарегистрирован', bg: '#EFF6FF', color: '#1E40AF' },
  in_transit:  { label: 'В transit',      bg: '#FEF3C7', color: '#92400E' },
  accepted:    { label: 'Принят',         bg: '#D1FAE5', color: '#065F46' },
  rejected:    { label: 'Отклонён ФГИС',  bg: '#FEE2E2', color: '#991B1B' },
  expired:     { label: 'Истёк срок',     bg: '#F1F5F9', color: '#64748B' },
};

const API_STATUS_CFG: Record<ApiStatus, { label: string; color: string; icon: string }> = {
  success: { label: 'OK',      color: '#065F46', icon: '✓' },
  error:   { label: 'Ошибка',  color: '#DC2626', icon: '✗' },
  pending: { label: 'Ожидание',color: '#92400E', icon: '⏳' },
  timeout: { label: 'Timeout', color: '#B45309', icon: '⏱' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'lots' | 'api' | 'crops';

const FGIS_CROPS = [
  { code: '0101', name: 'Пшеница мягкая', classes: ['1кл', '2кл', '3кл', '4кл', '5кл', 'Фуражный'] },
  { code: '0102', name: 'Пшеница твёрдая', classes: ['1кл', '2кл', '3кл'] },
  { code: '0201', name: 'Рожь', classes: ['1кл', '2кл', '3кл', '4кл'] },
  { code: '0301', name: 'Ячмень', classes: ['Пивоваренный', 'Кормовой'] },
  { code: '0401', name: 'Кукуруза', classes: ['3кл', 'Кормовая'] },
  { code: '0501', name: 'Подсолнечник', classes: ['ГОСТ Р 52385'] },
];

export function FgisZernoPanel() {
  const [tab, setTab] = useState<Tab>('lots');

  const accepted = LOTS.filter(l => l.status === 'accepted').length;
  const rejected = LOTS.filter(l => l.status === 'rejected').length;
  const totalVol = LOTS.reduce((s, l) => s + l.volumeTons, 0);
  const apiErrors = API_CALLS.filter(c => c.status === 'error' || c.status === 'timeout').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Партий ФГИС', value: LOTS.length,   color: '#0F1419' },
          { label: 'Принято',     value: accepted,       color: '#065F46' },
          { label: 'Отклонено',   value: rejected,       color: rejected > 0 ? '#DC2626' : '#065F46' },
          { label: 'Ошибок API',  value: apiErrors,      color: apiErrors > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ФГИС info */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 9, color: '#065F46', fontWeight: 700, lineHeight: 1.6 }}>
        ФГИС «Зерно» Минсельхоз РФ · FgisZernoAdapter (Mock→Live) · REST API v2 · Регистрация партий · СДИЗ · checkCertificate · confirmShipment · Adapter Pattern · Retry с exponential backoff
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['lots', 'Партии'], ['api', 'API Вызовы'], ['crops', 'Классификатор']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'lots' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {LOTS.map((lot) => {
            const st = LOT_STATUS_CFG[lot.status];
            return (
              <div key={lot.id} style={{ padding: '8px 12px', borderRadius: 10, background: lot.status === 'rejected' ? '#FEF2F2' : '#F8FAFB', border: `1px solid ${lot.status === 'rejected' ? '#FECACA' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 9, fontWeight: 700, color: '#1E40AF' }}>{lot.fgisLotId}</code>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ fontSize: 9, color: '#64748B', flex: 1 }}>{lot.culture} · {lot.qualityClass}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#0F1419' }}>{lot.volumeTons} т</span>
                  <span style={{ fontSize: 8, color: '#94A3B8' }}>{lot.dealId}</span>
                </div>
                {lot.certificateNum && (
                  <div style={{ fontSize: 9, color: '#065F46', marginTop: 3 }}>Сертификат: {lot.certificateNum}</div>
                )}
                {lot.sdizId && (
                  <div style={{ fontSize: 9, color: '#1E40AF', marginTop: 1 }}>СДИЗ: {lot.sdizId}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'api' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>FgisZernoAdapter · Mock→Live · Retry exponential backoff</div>
          {API_CALLS.map((call) => {
            const st = API_STATUS_CFG[call.status];
            return (
              <div key={call.id} style={{ padding: '7px 10px', borderRadius: 8, background: call.status === 'error' || call.status === 'timeout' ? '#FEF2F2' : '#F8FAFB', border: `1px solid ${call.status === 'error' || call.status === 'timeout' ? '#FECACA' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 3, background: '#E4E6EA', color: '#374151' }}>{call.method}</span>
                  <code style={{ fontSize: 9, color: '#1E40AF', flex: 1 }}>{call.endpoint}</code>
                  <span style={{ fontSize: 9, fontWeight: 900, color: st.color }}>{st.icon} {st.label}</span>
                  <span style={{ fontSize: 9, color: '#64748B' }}>{call.durationMs}мс</span>
                  {call.httpCode && <span style={{ fontSize: 8, color: '#374151' }}>HTTP {call.httpCode}</span>}
                  {call.retries > 0 && <span style={{ fontSize: 8, color: '#92400E' }}>retry {call.retries}x</span>}
                </div>
                {call.error && <div style={{ fontSize: 9, color: '#991B1B', marginTop: 3 }}>{call.error}</div>}
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 2 }}>{call.lotId}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'crops' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Классификатор культур ФГИС «Зерно» · getCrops() API</div>
          {FGIS_CROPS.map((c) => (
            <div key={c.code} style={{ padding: '6px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 9, color: '#1E40AF', minWidth: 50 }}>{c.code}</code>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{c.name}</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {c.classes.map((cls) => (
                  <span key={cls} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#EFF6FF', color: '#1E40AF', fontWeight: 700 }}>{cls}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        ФГИС «Зерно» · FgisZernoAdapter · checkCertificate · registerLot · confirmShipment · confirmAcceptance · getCrops · Retry backoff · Демо-данные.
      </div>
    </div>
  );
}
