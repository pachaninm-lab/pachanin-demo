'use client';

import * as React from 'react';
import { useToast } from '@/components/v7r/Toast';

interface QueueItem {
  plate: string;
  deal: string;
  weight: number;
  arrived: string | null;
  status: string;
}

const INITIAL_QUEUE: QueueItem[] = [
  { plate: 'А777ВВ136', deal: 'DL-9103', weight: 150, arrived: '13:45', status: 'Ожидает допуска' },
  { plate: 'В123КК52',  deal: 'DL-9105', weight: 120, arrived: '14:10', status: 'Ожидает' },
  { plate: 'Е888ОО36',  deal: 'DL-9108', weight: 60,  arrived: null,   status: 'В пути · ETA 15:00' },
];

interface Reception {
  weight: string;
  start: string;
  end: string;
  sdiz: string;
  fgis: boolean;
}

export default function ElevatorPage() {
  const toast = useToast();
  const [queue, setQueue] = React.useState<QueueItem[]>(INITIAL_QUEUE);
  const [receptions, setReceptions] = React.useState<Record<string, Reception>>({});
  const [openReception, setOpenReception] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState<Set<string>>(new Set());

  function getReception(plate: string): Reception {
    return receptions[plate] ?? { weight: '', start: '', end: '', sdiz: '', fgis: false };
  }

  function updateReception(plate: string, patch: Partial<Reception>) {
    setReceptions(prev => ({ ...prev, [plate]: { ...getReception(plate), ...patch } }));
  }

  function handleAdmit(item: QueueItem) {
    setQueue(prev => prev.map(q => q.plate === item.plate ? { ...q, status: 'На разгрузке 🔄' } : q));
    setOpenReception(item.plate);
    toast(`${item.plate} допущен к разгрузке`, 'success');
  }

  function handleConfirmReception(item: QueueItem) {
    setCompleted(prev => new Set([...prev, item.plate]));
    setQueue(prev => prev.map(q => q.plate === item.plate ? { ...q, status: 'Завершена ✅' } : q));
    setOpenReception(null);
    toast(`Приёмка подтверждена · сделка ${item.deal} обновлена`, 'success');
  }

  const onUnloading = queue.filter(q => q.status.includes('На разгрузке')).length;
  const completedToday = 7 + completed.size;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 800, margin: '0 auto' }}>
      {/* Метрики */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          ['В очереди', String(queue.filter(q => !q.status.includes('Завершена')).length)],
          ['На разгрузке', String(onUnloading)],
          ['Завершено сегодня', String(completedToday)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F1419' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Очередь */}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Очередь машин</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {queue.map(item => (
            <div key={item.plate}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto',
                gap: 12, alignItems: 'center', padding: '12px 14px',
                borderRadius: 14,
                background: completed.has(item.plate) ? '#F0FDF4' : item.status.includes('На разгрузке') ? 'rgba(11,107,154,0.06)' : '#F8FAFB',
                border: `1px solid ${completed.has(item.plate) ? '#BBF7D0' : item.status.includes('На разгрузке') ? 'rgba(11,107,154,0.14)' : '#E4E6EA'}`,
              }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13 }}>{item.plate}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{item.deal} · {item.weight} т</div>
                  {item.arrived && <div style={{ fontSize: 11, color: '#6B778C' }}>Прибыл: {item.arrived}</div>}
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                  background: completed.has(item.plate) ? '#F0FDF4' : item.status.includes('На разгрузке') ? 'rgba(11,107,154,0.08)' : '#FFFBEB',
                  color: completed.has(item.plate) ? '#16A34A' : item.status.includes('На разгрузке') ? '#0B6B9A' : '#D97706',
                }}>
                  {item.status}
                </span>
                {item.status === 'Ожидает допуска' && (
                  <button onClick={() => handleAdmit(item)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Допустить
                  </button>
                )}
                {item.status.includes('На разгрузке') && !completed.has(item.plate) && (
                  <button onClick={() => setOpenReception(openReception === item.plate ? null : item.plate)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#F5F7F8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {openReception === item.plate ? 'Свернуть' : 'Форма приёмки'}
                  </button>
                )}
              </div>

              {openReception === item.plate && !completed.has(item.plate) && (
                <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 16, marginTop: 8, display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Форма приёмки — {item.plate}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['Весовая (т)', 'weight'],
                      ['СДИЗ №', 'sdiz'],
                      ['Начало разгрузки', 'start'],
                      ['Конец разгрузки', 'end'],
                    ].map(([label, field]) => (
                      <div key={field}>
                        <label style={{ fontSize: 11, color: '#6B778C', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                        <input
                          type="text"
                          value={(getReception(item.plate) as unknown as Record<string, string>)[field] ?? ''}
                          onChange={e => updateReception(item.plate, { [field]: e.target.value } as Partial<Reception>)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4E6EA', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={getReception(item.plate).fgis} onChange={e => updateReception(item.plate, { fgis: e.target.checked })} />
                    ФГИС ✅ — данные переданы в государственную систему
                  </label>
                  <button onClick={() => handleConfirmReception(item)} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                    ✅ Подтвердить приёмку
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Сводка дня */}
      <div style={{ background: 'linear-gradient(135deg, rgba(10,122,95,0.06) 0%, rgba(11,107,154,0.04) 100%)', border: '1px solid rgba(10,122,95,0.12)', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F', marginBottom: 4 }}>Сводка дня</div>
        <div style={{ fontSize: 13, color: '#374151' }}>
          Принято: {completedToday} рейсов · {980 + completed.size * 60} т · Выручка элеватора: {(147 + completed.size * 9).toLocaleString('ru')} тыс. ₽
        </div>
      </div>
    </div>
  );
}
