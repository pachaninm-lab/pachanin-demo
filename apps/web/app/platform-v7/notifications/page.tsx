'use client';

import * as React from 'react';
import Link from 'next/link';

type InboxItem = {
  id: string;
  type: 'critical' | 'sla' | 'bank' | 'logistics' | 'deal';
  title: string;
  note: string;
  action: string;
  bucket: 'Критичные' | 'SLA' | 'Сделки' | 'Банк' | 'Логистика';
};

const INITIAL_ITEMS: InboxItem[] = [
  { id: 'N-101', type: 'critical', title: 'DL-9102: выпуск денег заблокирован', note: 'Открыт спор по качеству и не хватает пакета доказательств.', action: '/platform-v7/disputes/DSP-104', bucket: 'Критичные' },
  { id: 'N-102', type: 'sla', title: 'DL-9107: истекает SLA оператора', note: 'До дедлайна осталось менее 4 часов.', action: '/platform-v7/control-tower', bucket: 'SLA' },
  { id: 'N-103', type: 'bank', title: 'CB-441: банк подтвердил release', note: 'Деньги по сделке готовы к финальному отражению.', action: '/platform-v7/bank/events/CB-441', bucket: 'Банк' },
  { id: 'N-104', type: 'logistics', title: 'ТМБ-14: водитель подтвердил прибытие', note: 'Можно переходить к приёмке и акту.', action: '/platform-v7/logistics/%D0%A2%D0%9C%D0%91-14', bucket: 'Логистика' },
  { id: 'N-105', type: 'deal', title: 'LOT-2403: лот переведён в PASS', note: 'Документы и source reference прошли проверку.', action: '/platform-v7/lots/LOT-2403', bucket: 'Сделки' },
];

const FILTERS = ['Все', 'Критичные', 'SLA', 'Сделки', 'Банк', 'Логистика'] as const;
type FilterValue = (typeof FILTERS)[number];

function tone(type: InboxItem['type']) {
  if (type === 'critical') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'Критично' };
  if (type === 'sla') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'SLA' };
  if (type === 'bank') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'Банк' };
  if (type === 'logistics') return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB', label: 'Логистика' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569', label: 'Сделка' };
}

export default function NotificationsPage() {
  const [items, setItems] = React.useState<InboxItem[]>(INITIAL_ITEMS);
  const [activeFilter, setActiveFilter] = React.useState<FilterValue>('Все');
  const [search, setSearch] = React.useState('');
  const [pinned, setPinned] = React.useState<string[]>(['N-101']);
  const [archived, setArchived] = React.useState<string[]>([]);
  const [snoozed, setSnoozed] = React.useState<string[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleItems = items
    .filter((item) => !archived.includes(item.id))
    .filter((item) => activeFilter === 'Все' ? true : item.bucket === activeFilter)
    .filter((item) => {
      const q = search.trim().toLowerCase();
      return !q || [item.id, item.title, item.note, item.bucket].some((field) => field.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const aPinned = pinned.includes(a.id) ? 1 : 0;
      const bPinned = pinned.includes(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });

  const unreadCount = items.filter((item) => !archived.includes(item.id)).length;
  const snoozedCount = snoozed.filter((id) => !archived.includes(id)).length;

  function pinCritical() {
    const criticalIds = items.filter((item) => item.bucket === 'Критичные' && !archived.includes(item.id)).map((item) => item.id);
    setPinned((prev) => Array.from(new Set([...criticalIds, ...prev])));
    setToast(`Закреплены критичные: ${criticalIds.length}`);
  }

  function archiveRead() {
    const nextArchive = visibleItems.filter((item) => !pinned.includes(item.id)).map((item) => item.id);
    setArchived((prev) => Array.from(new Set([...prev, ...nextArchive])));
    setToast(`Архивировано: ${nextArchive.length}`);
  }

  function snoozeHour() {
    const nextSnooze = visibleItems.filter((item) => item.bucket !== 'Критичные').map((item) => item.id);
    setSnoozed((prev) => Array.from(new Set([...prev, ...nextSnooze])));
    setToast(`Отложено на 1 час: ${nextSnooze.length}`);
  }

  function togglePin(id: string) {
    setPinned((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]);
    setToast(prev => prev ? prev : `Статус pin обновлён: ${id}`);
  }

  function toggleSnooze(id: string) {
    setSnoozed((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setToast(`Snooze обновлён: ${id}`);
  }

  function archiveItem(id: string) {
    setArchived((prev) => Array.from(new Set([...prev, id])));
    setToast(`Архивировано: ${id}`);
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Уведомления</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Единый inbox по критичным событиям: сделки, банк, логистика, SLA и контур документов. Это рабочий центр внимания, а не декоративный список.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Metric title='Активные' value={String(unreadCount)} note='Неперемещённые в архив сигналы.' />
        <Metric title='Закреплены' value={String(pinned.filter((id) => !archived.includes(id)).length)} note='Верхние блокеры и приоритеты.' />
        <Metric title='Отложены' value={String(snoozedCount)} note='Не критичные сигналы, снятые на паузу.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Inbox-центр</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Фильтры, поиск и быстрые действия работают прямо на странице. Это уже не статичный слой, а рабочий экран оператора и ролей.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Поиск: DL-9102, CB-441, логистика…'
            aria-label='Поиск по уведомлениям'
            style={{ flex: '1 1 280px', minWidth: 220, padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 13 }}
          />
          {search ? (
            <button onClick={() => setSearch('')} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12, fontWeight: 700, color: '#6B778C', cursor: 'pointer' }}>
              Сбросить
            </button>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 999,
                background: activeFilter === filter ? 'rgba(10,122,95,0.08)' : '#F8FAFB',
                border: activeFilter === filter ? '1px solid rgba(10,122,95,0.18)' : '1px solid #E4E6EA',
                color: activeFilter === filter ? '#0A7A5F' : '#475569',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <ActionCard title='Архивировать прочитанные' note='Очистить шум и оставить только активные сигналы.' onClick={archiveRead} />
          <ActionCard title='Pin критичные' note='Закрепить верхние блокеры до снятия риска.' onClick={pinCritical} />
          <ActionCard title='Snooze на 1 час' note='Отложить неключевые события без потери контекста.' onClick={snoozeHour} />
        </div>
      </section>

      {toast ? (
        <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 12, color: '#0A7A5F', fontSize: 12, fontWeight: 700 }}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {visibleItems.length ? visibleItems.map((item) => {
          const t = tone(item.type);
          const isPinned = pinned.includes(item.id);
          const isSnoozed = snoozed.includes(item.id);
          return (
            <article key={item.id} style={{ background: '#fff', border: isPinned ? '1px solid rgba(10,122,95,0.24)' : '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 10, boxShadow: isPinned ? '0 0 0 2px rgba(10,122,95,0.06) inset' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{item.id}</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 800 }}>{item.bucket}</span>
                    {isPinned ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>Pin</span> : null}
                    {isSnoozed ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#B45309', fontSize: 11, fontWeight: 800 }}>Snooze</span> : null}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 800 }}>
                  {t.label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{item.note}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={item.action} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
                  Открыть
                </Link>
                <button onClick={() => togglePin(item.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: isPinned ? '#0A7A5F' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {isPinned ? 'Снять pin' : 'Pin'}
                </button>
                <button onClick={() => toggleSnooze(item.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: isSnoozed ? '#B45309' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {isSnoozed ? 'Снять snooze' : 'Snooze'}
                </button>
                <button onClick={() => archiveItem(item.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  В архив
                </button>
              </div>
            </article>
          );
        }) : (
          <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 24, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Ничего не найдено</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>Сбрось фильтры, архив или поиск, чтобы снова увидеть активные сигналы.</div>
          </section>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Control Tower
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Сделки
        </Link>
      </div>
    </div>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{note}</div>
    </section>
  );
}

function ActionCard({ title, note, onClick }: { title: string; note: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', display: 'grid', gap: 8, padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', cursor: 'pointer' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F1419' }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{note}</div>
    </button>
  );
}
