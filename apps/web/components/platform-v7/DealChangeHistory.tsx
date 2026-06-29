'use client';

import { useState } from 'react';

type ChangeActor = 'seller' | 'buyer' | 'operator' | 'bank' | 'lab' | 'system' | 'driver';

interface DealChange {
  id: string;
  ts: string;
  actor: ChangeActor;
  actorName: string;
  event: string;
  detail: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  critical?: boolean;
}

const ACTOR_COLORS: Record<ChangeActor, { bg: string; border: string; text: string; label: string }> = {
  seller:   { bg: 'rgba(10,122,95,0.08)',  border: 'rgba(10,122,95,0.2)',  text: '#0A7A5F', label: 'Продавец' },
  buyer:    { bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.2)',  text: '#2563EB', label: 'Покупатель' },
  operator: { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', text: '#7C3AED', label: 'Оператор' },
  bank:     { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.2)',  text: '#B45309', label: 'Банк' },
  lab:      { bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.2)',  text: '#0891B2', label: 'Лаборатория' },
  system:   { bg: 'rgba(100,116,139,0.08)',border: 'rgba(100,116,139,0.2)',text: '#475569', label: 'Система' },
  driver:   { bg: 'rgba(5,150,105,0.08)',  border: 'rgba(5,150,105,0.2)',  text: '#059669', label: 'Водитель' },
};

const DEMO_HISTORY: DealChange[] = [
  {
    id: 'ch-001', ts: '2024-03-01T08:02:00Z', actor: 'system', actorName: 'GrainFlow',
    event: 'Сделка создана', detail: 'Лот LOT-2401 принят в исполнение. Статус: Договор подписан.',
  },
  {
    id: 'ch-002', ts: '2024-03-01T09:15:00Z', actor: 'bank', actorName: 'РСХБ Эскроу',
    event: 'Средства зарезервированы', detail: 'Банк подтвердил резервирование 9 675 000 ₽ на эскроу-счёте.',
    fieldChanged: 'reservedAmount', oldValue: '0', newValue: '9 675 000 ₽',
  },
  {
    id: 'ch-003', ts: '2024-03-01T10:30:00Z', actor: 'seller', actorName: 'ООО «АгроТамбов»',
    event: 'Документ загружен', detail: 'Добавлен ТТН-2024-003451 (Накладная на отгрузку). Статус: Ожидает подписи.',
    fieldChanged: 'documents', newValue: 'ТТН-2024-003451',
  },
  {
    id: 'ch-004', ts: '2024-03-01T11:00:00Z', actor: 'driver', actorName: 'Иванов С.П.',
    event: 'Рейс принят', detail: 'Водитель принял рейс ТМБ-14. Маршрут: Тамбов → Воронеж · 142 км.',
  },
  {
    id: 'ch-005', ts: '2024-03-01T14:20:00Z', actor: 'driver', actorName: 'Иванов С.П.',
    event: 'Прибытие подтверждено', detail: 'Водитель зафиксировал прибытие на элеватор ЭЛВ-ТМБ-03. Фото прикреплено.',
  },
  {
    id: 'ch-006', ts: '2024-03-01T15:05:00Z', actor: 'lab', actorName: 'Лаборатория ЭЛВ-ТМБ-03',
    event: 'Пробоотбор выполнен', detail: 'Отобраны пробы из 3 точек. Протокол ЛАБ-0042 создан.',
  },
  {
    id: 'ch-007', ts: '2024-03-01T17:40:00Z', actor: 'lab', actorName: 'Лаборатория ЭЛВ-ТМБ-03',
    event: 'Расхождение по качеству', detail: 'Протеин 11.2% (договор 12.5%). Клейковина 22% (договор 25%). Создан блокер выплаты.',
    fieldChanged: 'qualityStatus', oldValue: 'Ожидает', newValue: 'Расхождение',
    critical: true,
  },
  {
    id: 'ch-008', ts: '2024-03-02T09:10:00Z', actor: 'operator', actorName: 'Оператор Краснова А.',
    event: 'Спор открыт', detail: 'Открыт спор DK-2024-89. Основание: отклонение качественных показателей. Удержание 580 000 ₽.',
    fieldChanged: 'holdAmount', oldValue: '0', newValue: '580 000 ₽',
    critical: true,
  },
  {
    id: 'ch-009', ts: '2024-03-03T11:30:00Z', actor: 'seller', actorName: 'ООО «АгроТамбов»',
    event: 'Доказательный пакет загружен', detail: 'Прикреплены: акт контрольной пробы, заключение независимой лаборатории.',
  },
  {
    id: 'ch-010', ts: '2024-03-04T14:00:00Z', actor: 'operator', actorName: 'Оператор Краснова А.',
    event: 'Скидка согласована', detail: 'Стороны согласовали скидку 3.2% от суммы. Скорректированный платёж: 9 365 700 ₽.',
    fieldChanged: 'releaseAmount', oldValue: '9 675 000', newValue: '9 365 700 ₽',
  },
  {
    id: 'ch-011', ts: '2024-03-04T16:45:00Z', actor: 'bank', actorName: 'РСХБ Эскроу',
    event: 'Выплата выполнена', detail: 'Банк перечислил 9 365 700 ₽ на счёт продавца. Сделка закрыта.',
    fieldChanged: 'status', oldValue: 'Спор', newValue: 'Закрыта',
  },
];

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const ALL_ACTORS: ChangeActor[] = ['seller', 'buyer', 'operator', 'bank', 'lab', 'system', 'driver'];

interface Props {
  dealId?: string;
  compact?: boolean;
}

export function DealChangeHistory({ dealId: _dealId, compact = false }: Props) {
  const [filterActor, setFilterActor] = useState<ChangeActor | 'all'>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const activeActors = [...new Set(DEMO_HISTORY.map((c) => c.actor))];

  const filtered = DEMO_HISTORY.filter((c) => {
    if (filterActor !== 'all' && c.actor !== filterActor) return false;
    if (showCriticalOnly && !c.critical) return false;
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: '0.875rem' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setFilterActor('all')}
          style={filterBtn(filterActor === 'all')}
        >
          Все
        </button>
        {activeActors.map((actor) => {
          const col = ACTOR_COLORS[actor];
          const isActive = filterActor === actor;
          return (
            <button
              key={actor}
              onClick={() => setFilterActor(isActive ? 'all' : actor)}
              style={{
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                background: isActive ? col.text : 'transparent',
                color: isActive ? '#fff' : col.text,
                border: `1px solid ${isActive ? 'transparent' : col.border}`,
              }}
            >
              {col.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowCriticalOnly(!showCriticalOnly)}
          style={{
            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
            background: showCriticalOnly ? '#B91C1C' : 'transparent',
            color: showCriticalOnly ? '#fff' : '#B91C1C',
            border: `1px solid ${showCriticalOnly ? 'transparent' : 'rgba(185,28,28,0.3)'}`,
            marginLeft: 'auto',
          }}
        >
          Только критичные
        </button>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 15, top: 8, bottom: 8,
          width: 2, background: 'rgba(10,122,95,0.15)', borderRadius: 1,
        }} />

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {filtered.map((change, idx) => {
            const col = ACTOR_COLORS[change.actor];
            return (
              <div key={change.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                {/* Dot */}
                <div style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
                  background: change.critical ? '#B91C1C' : col.text,
                  border: `2px solid ${change.critical ? 'rgba(185,28,28,0.3)' : col.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: '#fff', fontWeight: 900, zIndex: 1,
                  position: 'relative',
                }}>
                  {change.actor === 'system' ? '⚙' : change.actor === 'bank' ? '₽' : change.actor === 'lab' ? '🔬' : change.actor === 'driver' ? '🚛' : idx + 1}
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, border: `1px solid ${change.critical ? 'rgba(185,28,28,0.2)' : col.border}`,
                  background: change.critical ? 'rgba(185,28,28,0.04)' : col.bg,
                  borderRadius: 12, padding: compact ? '8px 10px' : '10px 12px',
                  display: 'grid', gap: '0.25rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: change.critical ? '#B91C1C' : col.text }}>
                      {change.critical && '⚠ '}{change.event}
                    </span>
                    <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{formatTs(change.ts)}</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>{change.actorName} · {col.label}</span>
                  {!compact && (
                    <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{change.detail}</span>
                  )}
                  {change.fieldChanged && !compact && (
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      <span style={{ background: 'rgba(100,116,139,0.1)', padding: '1px 5px', borderRadius: 4, color: '#64748B' }}>{change.fieldChanged}</span>
                      {change.oldValue && <>
                        <span style={{ color: '#94A3B8' }}>{change.oldValue}</span>
                        <span style={{ color: '#0A7A5F' }}>→</span>
                      </>}
                      {change.newValue && <span style={{ color: '#0F1419', fontWeight: 700 }}>{change.newValue}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: 13 }}>
          Нет событий по выбранному фильтру
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '5px 9px', borderRadius: 7, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Демо-данные. В боевом контуре каждое изменение сохраняется с IP, hash запроса и подписью оператора.
      </div>
    </div>
  );
}

function filterBtn(active: boolean) {
  return {
    fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
    background: active ? 'var(--p7-color-brand, #0A7A5F)' : 'transparent',
    color: active ? '#fff' : 'var(--pc-text-muted)',
    border: `1px solid ${active ? 'transparent' : 'var(--p7-color-border)'}`,
  } as const;
}
