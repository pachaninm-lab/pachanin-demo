'use client';

import { useState } from 'react';

type TicketStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

interface SupportTicket {
  id: string;
  title: string;
  dealId: string | null;
  orgName: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  assignee: string | null;
  description: string;
  actions: { label: string; ts: string; actor: string }[];
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; color: string }> = {
  open:        { label: 'Открыт',      bg: '#DBEAFE', color: '#1E40AF' },
  in_progress: { label: 'В работе',    bg: '#FEF3C7', color: '#92400E' },
  escalated:   { label: 'Эскалирован', bg: '#FEE2E2', color: '#991B1B' },
  resolved:    { label: 'Решён',       bg: '#D1FAE5', color: '#065F46' },
  closed:      { label: 'Закрыт',      bg: '#F1F5F9', color: '#64748B' },
};

const PRIORITY_CONFIG: Record<TicketPriority, { color: string; bg: string }> = {
  P1: { color: '#fff', bg: '#DC2626' },
  P2: { color: '#fff', bg: '#D97706' },
  P3: { color: '#0F1419', bg: '#FEF3C7' },
  P4: { color: '#64748B', bg: '#F1F5F9' },
};

const DEMO_TICKETS: SupportTicket[] = [
  {
    id: 'TKT-2024-0441', title: 'Не могу подписать акт УКЭП — ошибка КриптоПро',
    dealId: 'DL-9095', orgName: 'ООО «АгроТрейд Юг»', category: 'ЭЦП / УКЭП',
    priority: 'P1', status: 'escalated',
    createdAt: '2024-03-20T09:00:00Z', updatedAt: '2024-03-20T11:30:00Z',
    assignee: 'Иванов Д.А.',
    description: 'При попытке подписать акт приёмки сертификат не отображается в списке. КриптоПро CSP 5.0.13000.',
    actions: [
      { label: 'Тикет создан', ts: '2024-03-20T09:00:00Z', actor: 'Система' },
      { label: 'Назначен Иванов Д.А.', ts: '2024-03-20T09:15:00Z', actor: 'Support L1' },
      { label: 'Эскалирован в Support L2', ts: '2024-03-20T11:30:00Z', actor: 'Иванов Д.А.' },
    ],
  },
  {
    id: 'TKT-2024-0440', title: 'Деньги удержаны, но спор закрыт — не выпускаются',
    dealId: 'DL-9110', orgName: 'АО «МаслоПресс»', category: 'Финансы / Escrow',
    priority: 'P1', status: 'in_progress',
    createdAt: '2024-03-19T14:00:00Z', updatedAt: '2024-03-20T08:00:00Z',
    assignee: 'Сидорова Е.В.',
    description: 'Спор DK-2024-91 закрыт 18.03, но удержание 312 000 ₽ всё ещё активно в системе.',
    actions: [
      { label: 'Тикет создан', ts: '2024-03-19T14:00:00Z', actor: 'Система' },
      { label: 'Назначен Сидорова Е.В.', ts: '2024-03-19T14:30:00Z', actor: 'Support L1' },
      { label: 'Проверка ledger — ожидается ручной release', ts: '2024-03-20T08:00:00Z', actor: 'Сидорова Е.В.' },
    ],
  },
  {
    id: 'TKT-2024-0438', title: 'Запрос на сброс пароля администратора организации',
    dealId: null, orgName: 'КФХ «Ивановское»', category: 'Аккаунт / Доступ',
    priority: 'P2', status: 'resolved',
    createdAt: '2024-03-18T10:00:00Z', updatedAt: '2024-03-18T10:45:00Z',
    assignee: 'Петров М.С.',
    description: 'Пользователь потерял доступ к почте для восстановления. Нужно подтверждение через СМС или видео-верификацию.',
    actions: [
      { label: 'Тикет создан', ts: '2024-03-18T10:00:00Z', actor: 'Пользователь' },
      { label: 'Верификация по видео пройдена', ts: '2024-03-18T10:30:00Z', actor: 'Петров М.С.' },
      { label: 'Пароль сброшен', ts: '2024-03-18T10:45:00Z', actor: 'Петров М.С.' },
    ],
  },
  {
    id: 'TKT-2024-0435', title: 'Вопрос: как подключить факторинг к сделке?',
    dealId: 'DL-9088', orgName: 'ООО «АгроЭкспорт»', category: 'Консультация',
    priority: 'P4', status: 'closed',
    createdAt: '2024-03-15T11:00:00Z', updatedAt: '2024-03-15T11:30:00Z',
    assignee: 'Козлова И.Д.',
    description: 'Клиент хочет подключить факторинговое финансирование к активной сделке. Уточнение процесса.',
    actions: [
      { label: 'Тикет создан', ts: '2024-03-15T11:00:00Z', actor: 'Пользователь' },
      { label: 'Ответ отправлен (инструкция + ссылка)', ts: '2024-03-15T11:30:00Z', actor: 'Козлова И.Д.' },
    ],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function SupportOpsPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');

  const visible = DEMO_TICKETS.filter((t) => filterStatus === 'all' || t.status === filterStatus);

  const open = DEMO_TICKETS.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'escalated').length;
  const p1 = DEMO_TICKETS.filter((t) => t.priority === 'P1').length;
  const avgMinutes = 28;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Тикетов',    value: DEMO_TICKETS.length, color: '#0F1419' },
          { label: 'Открытых',   value: open,                color: open > 0 ? '#D97706' : '#0A7A5F' },
          { label: 'P1',         value: p1,                  color: p1 > 0 ? '#DC2626' : '#0A7A5F' },
          { label: 'Avg time',   value: `${avgMinutes} мин`, color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'open', 'in_progress', 'escalated', 'resolved', 'closed'] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '4px 10px', borderRadius: 6, border: filterStatus === s ? 'none' : '1px solid #E4E6EA', background: filterStatus === s ? '#0F1419' : '#F8FAFB', color: filterStatus === s ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {s === 'all' ? 'Все' : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {visible.map((t) => {
          const cfg = STATUS_CONFIG[t.status];
          const prCfg = PRIORITY_CONFIG[t.priority];
          const isOpen = selected === t.id;
          return (
            <div key={t.id} style={{ borderRadius: 12, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden', background: isOpen ? '#F0FDF4' : '#F8FAFB' }}>
              <button onClick={() => setSelected(isOpen ? null : t.id)} style={{ width: '100%', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 6px', borderRadius: 4, background: prCfg.bg, color: prCfg.color, flexShrink: 0, marginTop: 1 }}>{t.priority}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{t.id}</code>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize: 9, color: '#94A3B8', padding: '1px 5px', borderRadius: 4, background: '#F1F5F9' }}>{t.category}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', marginTop: 4 }}>{t.title}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{t.orgName}{t.dealId && <> · <a href={`/platform-v7/deals/${t.dealId}/clean`} onClick={e => e.stopPropagation()} style={{ color: '#0A7A5F', fontWeight: 700, fontFamily: 'monospace', textDecoration: 'none' }}>{t.dealId}</a></>} · {t.assignee ?? 'Не назначен'}</div>
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0, textAlign: 'right' }}>
                  {new Date(t.updatedAt).toLocaleDateString('ru-RU')}
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '12px 14px', background: '#fff', display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{t.description}</div>
                  <div>
                    <div style={{ ...lbl, marginBottom: 6 }}>История действий</div>
                    {t.actions.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: i < t.actions.length - 1 ? '1px solid #F1F5F9' : 'none', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 56 }}>{new Date(a.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span style={{ fontSize: 10, color: '#0F1419', flex: 1 }}>{a.label}</span>
                        <span style={{ fontSize: 9, color: '#64748B' }}>{a.actor}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {t.dealId && (
                      <a href={`/platform-v7/deals/${t.dealId}/clean`} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#0A7A5F', fontWeight: 700, textDecoration: 'none' }}>
                        Просмотр сделки
                      </a>
                    )}
                    {(t.status === 'open' || t.status === 'in_progress') && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>
                        Эскалировать
                      </button>
                    )}
                    {t.status !== 'resolved' && t.status !== 'closed' && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>
                        Отметить решённым
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Support Ops Queue · P1 SLA: 30 мин · P2: 2 ч · P3/P4: 1 день · Просмотр сделки (read-only) · Audit-запись каждого действия оператора · Демо-данные.
      </div>
    </div>
  );
}
