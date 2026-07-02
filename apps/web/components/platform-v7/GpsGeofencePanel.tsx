'use client';

import { useState } from 'react';

type VehicleStatus = 'moving' | 'idle' | 'loading' | 'unloading' | 'offline';
type GeofenceEvent = 'enter' | 'exit' | 'overdue' | 'deviation' | 'idle_alert';

interface Vehicle {
  id: string;
  plate: string;
  driver: string;
  dealId: string;
  status: VehicleStatus;
  speedKmh: number;
  lat: number;
  lng: number;
  location: string;
  lastUpdate: string;
  adapter: 'glonass' | 'driver_app' | 'yandex';
}

interface GeofenceZone {
  id: string;
  name: string;
  type: 'loading' | 'unloading' | 'elevator' | 'port';
  dealId: string;
  radiusM: number;
  active: boolean;
}

interface GeoEvent {
  vehicleId: string;
  plate: string;
  event: GeofenceEvent;
  zone: string;
  dealId: string;
  time: string;
  detail: string;
}

const VEHICLES: Vehicle[] = [
  { id: 'v-001', plate: 'А•••ВС•••', driver: 'Иванов И.И.', dealId: 'DL-9095', status: 'moving',    speedKmh: 82, lat: 47.23, lng: 39.71, location: 'М4 Дон, 892 км → Новороссийск', lastUpdate: '2024-03-20T11:22:00Z', adapter: 'glonass' },
  { id: 'v-002', plate: 'В•••КР••',  driver: 'Петров С.В.', dealId: 'DL-9095', status: 'unloading',  speedKmh: 0,  lat: 44.72, lng: 37.77, location: 'Новороссийский КХП', lastUpdate: '2024-03-20T10:55:00Z', adapter: 'glonass' },
  { id: 'v-003', plate: 'Е•••МН••',  driver: 'Сидоров К.А.', dealId: 'DL-9110', status: 'loading',   speedKmh: 0,  lat: 46.55, lng: 39.32, location: 'Элеватор Кущёвская, Краснодарский кр.', lastUpdate: '2024-03-20T11:15:00Z', adapter: 'driver_app' },
  { id: 'v-004', plate: 'К•••РО••',  driver: 'Козлов А.П.', dealId: 'DL-9118', status: 'idle',       speedKmh: 0,  lat: 47.45, lng: 40.12, location: 'АЗС Лукойл, М4 930 км', lastUpdate: '2024-03-20T09:30:00Z', adapter: 'driver_app' },
  { id: 'v-005', plate: 'Т•••УФ••',  driver: 'Морозов Д.И.', dealId: 'DL-9095', status: 'moving',   speedKmh: 76, lat: 47.10, lng: 39.85, location: 'Ростов-на-Дону → Краснодар', lastUpdate: '2024-03-20T11:20:00Z', adapter: 'glonass' },
];

const GEOFENCES: GeofenceZone[] = [
  { id: 'gz-001', name: 'Загрузка: АгроХолдинг пос. Зерновой', type: 'loading',   dealId: 'DL-9095', radiusM: 500, active: true },
  { id: 'gz-002', name: 'Выгрузка: Новороссийский КХП',         type: 'unloading', dealId: 'DL-9095', radiusM: 300, active: true },
  { id: 'gz-003', name: 'Элеватор Кущёвская',                   type: 'elevator',  dealId: 'DL-9110', radiusM: 400, active: true },
  { id: 'gz-004', name: 'Порт Новороссийск причал 7',           type: 'port',      dealId: 'DL-9095', radiusM: 200, active: true },
  { id: 'gz-005', name: 'Элеватор Зерноград',                   type: 'elevator',  dealId: 'DL-9118', radiusM: 400, active: false },
];

const GEO_EVENTS: GeoEvent[] = [
  { vehicleId: 'v-002', plate: 'В•••КР••', event: 'enter', zone: 'Новороссийский КХП', dealId: 'DL-9095', time: '2024-03-20T10:55:00Z', detail: 'Въезд на выгрузку — статус ТС обновлён автоматически' },
  { vehicleId: 'v-003', plate: 'Е•••МН••', event: 'enter', zone: 'Элеватор Кущёвская', dealId: 'DL-9110', time: '2024-03-20T11:10:00Z', detail: 'Начало погрузки — уведомление отправлено менеджеру' },
  { vehicleId: 'v-004', plate: 'К•••РО••', event: 'idle_alert', zone: 'М4 930 км', dealId: 'DL-9118', time: '2024-03-20T09:30:00Z', detail: 'Простой > 2 часов — уведомление отправлено диспетчеру' },
  { vehicleId: 'v-001', plate: 'А•••ВС•••', event: 'deviation', zone: 'Маршрут М4', dealId: 'DL-9095', time: '2024-03-19T14:20:00Z', detail: 'Отклонение 7 км от маршрута на 12 мин — восстановлен' },
];

const STATUS_CFG: Record<VehicleStatus, { label: string; bg: string; color: string; icon: string }> = {
  moving:    { label: 'В движении', bg: '#D1FAE5', color: '#065F46', icon: '→' },
  idle:      { label: 'Простой',    bg: '#FEF3C7', color: '#92400E', icon: '○' },
  loading:   { label: 'Погрузка',   bg: '#EFF6FF', color: '#1E40AF', icon: '↑' },
  unloading: { label: 'Выгрузка',   bg: '#F5F3FF', color: '#5B21B6', icon: '↓' },
  offline:   { label: 'Оффлайн',   bg: '#F1F5F9', color: '#64748B', icon: '—' },
};

const EVENT_CFG: Record<GeofenceEvent, { color: string; icon: string }> = {
  enter:     { color: '#065F46', icon: '⦿' },
  exit:      { color: '#1E40AF', icon: '⊗' },
  overdue:   { color: '#DC2626', icon: '⏱' },
  deviation: { color: '#92400E', icon: '⚡' },
  idle_alert:{ color: '#B45309', icon: '⏸' },
};

const ADAPTER_LABEL: Record<Vehicle['adapter'], string> = {
  glonass:    'ГЛОНАСС',
  driver_app: 'Driver App',
  yandex:     'Яндекс',
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'vehicles' | 'geofences' | 'events';

export function GpsGeofencePanel() {
  const [tab, setTab] = useState<Tab>('vehicles');

  const moving = VEHICLES.filter(v => v.status === 'moving').length;
  const alertVehicles = VEHICLES.filter(v => v.status === 'idle').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'ТС в мониторинге', value: VEHICLES.length,   color: '#0F1419' },
          { label: 'В движении',       value: moving,            color: '#065F46' },
          { label: 'Геозон активных',  value: GEOFENCES.filter(g => g.active).length, color: '#1E40AF' },
          { label: 'Простой/Внимание', value: alertVehicles,    color: alertVehicles > 0 ? '#92400E' : '#065F46' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        GPS: ГЛОНАСС + Driver App + Яндекс.Телематика · Polling 30 сек · Геозоны из адресов сделки (авто) · Автотриггер статуса ТС · Уведомления: опоздание > 30 мин, отклонение > 5 км, простой > 2 ч
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['vehicles', 'ТС онлайн'], ['geofences', 'Геозоны'], ['events', 'События']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'vehicles' && (
        <div style={{ display: 'grid', gap: 5 }}>
          {VEHICLES.map((v) => {
            const st = STATUS_CFG[v.status];
            return (
              <div key={v.id} style={{ padding: '8px 12px', borderRadius: 10, background: v.status === 'idle' ? '#FFFBEB' : '#F8FAFB', border: `1px solid ${v.status === 'idle' ? '#FDE68A' : '#E4E6EA'}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                  <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{v.plate}</code>
                  <span style={{ fontSize: 9, color: '#64748B', flex: 1 }}>{v.driver}</span>
                  <span style={{ fontSize: 8, color: '#64748B' }}>{ADAPTER_LABEL[v.adapter]}</span>
                  <span style={{ fontSize: 9, color: '#374151' }}>{v.dealId}</span>
                  {v.speedKmh > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#065F46' }}>{v.speedKmh} км/ч</span>}
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
                  {v.location} · {new Date(v.lastUpdate).toLocaleTimeString('ru-RU')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'geofences' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Автогенерация из адресов сделки · Автотриггер статуса ТС</div>
          {GEOFENCES.map((gz) => {
            const typeIcon = gz.type === 'loading' ? '↑' : gz.type === 'unloading' ? '↓' : gz.type === 'port' ? '⚓' : '△';
            return (
              <div key={gz.id} style={{ padding: '7px 10px', borderRadius: 8, background: gz.active ? '#F8FAFB' : '#F1F5F9', border: `1px solid ${gz.active ? '#E4E6EA' : '#CBD5E1'}`, opacity: gz.active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#1E40AF' }}>{typeIcon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{gz.name}</span>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: gz.active ? '#D1FAE5' : '#E2E8F0', color: gz.active ? '#065F46' : '#64748B' }}>{gz.active ? 'ACTIVE' : 'INACTIVE'}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{gz.dealId} · Радиус: {gz.radiusM} м</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'events' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={lbl}>Геозонные события — уведомления в реальном времени</div>
          {GEO_EVENTS.map((e, i) => {
            const ev = EVENT_CFG[e.event];
            return (
              <div key={i} style={{ padding: '7px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: ev.color }}>{ev.icon}</span>
                  <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{e.plate}</code>
                  <span style={{ fontSize: 9, color: ev.color, fontWeight: 700, flex: 1 }}>{e.zone}</span>
                  <span style={{ fontSize: 8, color: '#94A3B8' }}>{new Date(e.time).toLocaleString('ru-RU')}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{e.detail}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        GPS: ГЛОНАСС + Driver App · Геозоны из адресов сделки · Observable GeofenceEvent · Автостатус ТС · Уведомления Telegram · Демо-данные.
      </div>
    </div>
  );
}
