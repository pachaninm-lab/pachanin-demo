'use client';

import { useState } from 'react';

type InboxPriority = 'critical' | 'high' | 'medium' | 'low';
type InboxCategory = 'deal' | 'dispute' | 'document' | 'logistics' | 'payment' | 'system';
type InboxStatus = 'new' | 'in_progress' | 'waiting' | 'resolved';

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  priority: InboxPriority;
  category: InboxCategory;
  status: InboxStatus;
  dealId?: string;
  responsibleRole: string;
  createdAt: string;
  deadline?: string;
  moneyRub?: number;
}

const DEMO_INBOX: InboxItem[] = [
  {
    id: 'INB-001', title: 'СДИЗ не подтверждён ФГИС «Зерно»', body: 'DL-9106 · LOT-2403 · 9,65 млн ₽ заблокировано. Продавец должен подтвердить СДИЗ.',
    priority: 'critical', category: 'deal', status: 'new', dealId: 'DL-9106', responsibleRole: 'продавец',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(), deadline: new Date(Date.now() + 3_600_000).toISOString(), moneyRub: 9_650_000,
  },
  {
    id: 'INB-002', title: 'ЭТрН ожидает подписи грузополучателя', body: 'ЭТрН-2024-003451 по DL-9106 · Без подписи деньги не переходят к следующему этапу.',
    priority: 'critical', category: 'document', status: 'in_progress', dealId: 'DL-9106', responsibleRole: 'грузополучатель',
    createdAt: new Date(Date.now() - 7_200_000).toISOString(), deadline: new Date(Date.now() + 7_200_000).toISOString(), moneyRub: 9_650_000,
  },
  {
    id: 'INB-003', title: 'Акт расхождения по весу не закрыт', body: 'DL-9102 · -1,2 т расхождение · Удержание 624 тыс. ₽ остаётся до подписания акта.',
    priority: 'high', category: 'dispute', status: 'in_progress', dealId: 'DL-9102', responsibleRole: 'оператор',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(), moneyRub: 624_000,
  },
  {
    id: 'INB-004', title: 'Протокол качества не получен от лаборатории', body: 'DL-9106 · Лаборатория ВРЖ-08 должна закрыть протокол качества по пшенице 3кл.',
    priority: 'high', category: 'document', status: 'waiting', dealId: 'DL-9106', responsibleRole: 'лаборатория',
    createdAt: new Date(Date.now() - 14_400_000).toISOString(),
  },
  {
    id: 'INB-005', title: 'Рейс ТМБ-14 прибыл на элеватор', body: 'Водитель Иванов С.П. подтвердил прибытие в Воронеже. Ожидается приёмка груза.',
    priority: 'medium', category: 'logistics', status: 'new', dealId: 'DL-9102', responsibleRole: 'элеватор',
    createdAt: new Date(Date.now() - 300_000).toISOString(),
  },
  {
    id: 'INB-006', title: 'Outbox: 12 банковских операций в очереди', body: 'Очередь исходящих операций накопилась. Проверить статус банковского адаптера.',
    priority: 'medium', category: 'payment', status: 'new', responsibleRole: 'оператор',
    createdAt: new Date(Date.now() - 1_800_000).toISOString(),
  },
  {
    id: 'INB-007', title: 'Новая сделка DL-9121 требует проверки', body: 'DL-9121 · Подсолнечник · 180 т · Контрагент ИП Кузнецов — первая сделка на платформе.',
    priority: 'low', category: 'deal', status: 'new', dealId: 'DL-9121', responsibleRole: 'оператор',
    createdAt: new Date(Date.now() - 10_800_000).toISOString(),
  },
];

const PRIORITY_CONFIG: Record<InboxPriority, { label: string; bg: string; border: string; color: string; dot: string }> = {
  critical: { label: 'Критический', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)', color: '#DC2626', dot: '#DC2626' },
  high:     { label: 'Высокий',    bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)', color: '#D97706', dot: '#F59E0B' },
  medium:   { label: 'Средний',    bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.15)', color: '#2563EB', dot: '#2563EB' },
  low:      { label: 'Низкий',     bg: 'var(--p7-color-surface-muted)', border: 'var(--p7-color-border)', color: 'var(--pc-text-muted)', dot: 'var(--pc-text-muted)' },
};

const CATEGORY_ICON: Record<InboxCategory, string> = {
  deal: '📋', dispute: '⚖️', document: '📄', logistics: '🚛', payment: '💰', system: '⚙️',
};

const STATUS_LABEL: Record<InboxStatus, string> = {
  new: 'Новое', in_progress: 'В работе', waiting: 'Ожидание', resolved: 'Закрыто',
};

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  if (mins < 60) return `${mins} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

function formatDeadline(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'Просрочено';
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} мин`;
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн`;
}

function formatMoney(rub: number): string {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
}

interface Props {
  items?: InboxItem[];
  compact?: boolean;
}

export function OperatorInboxPanel({ items = DEMO_INBOX, compact = false }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState<InboxPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<InboxStatus | 'all'>('all');
  const [statusMap, setStatusMap] = useState<Record<string, InboxStatus>>({});

  const filtered = items.filter((item) => {
    if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
    if (filterStatus !== 'all') {
      const current = statusMap[item.id] ?? item.status;
      if (current !== filterStatus) return false;
    }
    return true;
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((i) => i.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function bulkSetStatus(status: InboxStatus) {
    const updates: Record<string, InboxStatus> = { ...statusMap };
    selected.forEach((id) => { updates[id] = status; });
    setStatusMap(updates);
    clearSelection();
  }

  function setItemStatus(id: string, status: InboxStatus) {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }

  const criticalCount = items.filter((i) => i.priority === 'critical' && (statusMap[i.id] ?? i.status) !== 'resolved').length;
  const newCount = items.filter((i) => (statusMap[i.id] ?? i.status) === 'new').length;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {criticalCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', borderRadius: '8px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#DC2626' }}>{criticalCount} критических</span>
          </div>
        )}
        {newCount > 0 && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)', fontWeight: 600 }}>{newCount} новых задач</div>
        )}
        <div style={{ flex: 1 }} />
        {/* Filters */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as InboxPriority | 'all')}
          style={{ fontSize: '10px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--p7-color-border)', background: 'var(--p7-color-surface)', color: 'var(--pc-text-primary)', cursor: 'pointer' }}
        >
          <option value="all">Все приоритеты</option>
          <option value="critical">Критический</option>
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as InboxStatus | 'all')}
          style={{ fontSize: '10px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--p7-color-border)', background: 'var(--p7-color-surface)', color: 'var(--pc-text-primary)', cursor: 'pointer' }}
        >
          <option value="all">Все статусы</option>
          <option value="new">Новое</option>
          <option value="in_progress">В работе</option>
          <option value="waiting">Ожидание</option>
          <option value="resolved">Закрыто</option>
        </select>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#2563EB' }}>{selected.size} выбрано</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => bulkSetStatus('in_progress')} style={bulkBtn}>Взять в работу</button>
          <button onClick={() => bulkSetStatus('waiting')} style={bulkBtn}>Ожидание</button>
          <button onClick={() => bulkSetStatus('resolved')} style={bulkBtn}>Закрыть</button>
          <button onClick={clearSelection} style={{ ...bulkBtn, color: 'var(--pc-text-muted)' }}>Сбросить</button>
        </div>
      )}

      {/* Select all row */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.25rem' }}>
          <input
            type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={() => selected.size === filtered.length ? clearSelection() : selectAll()}
            style={{ cursor: 'pointer', accentColor: '#2563EB' }}
          />
          <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', fontWeight: 600 }}>
            {selected.size === filtered.length ? 'Снять всё' : `Выбрать все (${filtered.length})`}
          </span>
        </div>
      )}

      {/* Items list */}
      <div style={{ display: 'grid', gap: '0.375rem' }}>
        {filtered.map((item) => {
          const pCfg = PRIORITY_CONFIG[item.priority];
          const currentStatus = statusMap[item.id] ?? item.status;
          const isSelected = selected.has(item.id);
          const isResolved = currentStatus === 'resolved';

          return (
            <div
              key={item.id}
              style={{
                display: 'grid', gridTemplateColumns: '20px 1fr', gap: '0.75rem', alignItems: 'flex-start',
                padding: '0.75rem 0.875rem', borderRadius: '10px',
                background: isSelected ? 'rgba(37,99,235,0.06)' : isResolved ? 'var(--p7-color-surface-muted)' : pCfg.bg,
                border: `1px solid ${isSelected ? 'rgba(37,99,235,0.25)' : pCfg.border}`,
                opacity: isResolved ? 0.55 : 1,
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(item.id)}
                style={{ marginTop: '4px', cursor: 'pointer', accentColor: '#2563EB' }}
              />

              <div style={{ display: 'grid', gap: '0.375rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', flexShrink: 0 }}>{CATEGORY_ICON[item.category]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--pc-text-primary)', lineHeight: 1.3 }}>
                      {item.title}
                    </div>
                    {!compact && (
                      <div style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                        {item.body}
                      </div>
                    )}
                  </div>

                  {/* Priority dot + label */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '2px 8px', borderRadius: '999px', background: pCfg.bg, border: `1px solid ${pCfg.border}`, fontSize: '10px', fontWeight: 700, color: pCfg.color, flexShrink: 0 }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: pCfg.dot, flexShrink: 0 }} />
                    {pCfg.label}
                  </span>
                </div>

                {/* Meta row */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {item.dealId && (
                    <a href={`/platform-v7/deals/${item.dealId}/clean`} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--p7-color-brand)', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>
                      {item.dealId}
                    </a>
                  )}
                  {item.moneyRub && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: item.priority === 'critical' ? '#DC2626' : 'var(--pc-text-muted)' }}>
                      {formatMoney(item.moneyRub)}
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>→ {item.responsibleRole}</span>
                  {item.deadline && !isResolved && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: new Date(item.deadline).getTime() < Date.now() ? '#DC2626' : '#D97706' }}>
                      ⏱ {formatDeadline(item.deadline)}
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)', marginLeft: 'auto' }}>{formatAge(item.createdAt)}</span>

                  {/* Status dropdown */}
                  <select
                    value={currentStatus}
                    onChange={(e) => setItemStatus(item.id, e.target.value as InboxStatus)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--p7-color-border)', background: 'var(--p7-color-surface)', color: 'var(--pc-text-muted)', cursor: 'pointer' }}
                  >
                    <option value="new">Новое</option>
                    <option value="in_progress">В работе</option>
                    <option value="waiting">Ожидание</option>
                    <option value="resolved">Закрыто</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--pc-text-muted)', fontSize: 'var(--text-sm)' }}>
            Нет задач по выбранным фильтрам
          </div>
        )}
      </div>
    </div>
  );
}

const bulkBtn: React.CSSProperties = {
  padding: '0.25rem 0.625rem',
  borderRadius: '6px',
  border: '1px solid rgba(37,99,235,0.3)',
  background: 'rgba(37,99,235,0.1)',
  color: '#2563EB',
  fontSize: '10px',
  fontWeight: 700,
  cursor: 'pointer',
};
