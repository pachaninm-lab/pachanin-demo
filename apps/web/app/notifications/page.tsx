'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api-client';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { SourceNote } from '../../components/source-note';
import { DetailHero } from '../../components/detail-hero';
import { CriticalBlockersPanel } from '../../components/critical-blockers-panel';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

type Notif = {
  id: string;
  title: string;
  body: string;
  channel?: string;
  isRead?: boolean;
  createdAt?: string;
  actionHref?: string;
  severity?: string;
  linkedEntity?: string;
  source?: string;
  dueAt?: string;
  overdue?: boolean;
  nextAction?: string;
};

function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'overdue'>('all');

  const load = async () => {
    const list = await api.get<Notif[]>('/notifications');
    setItems(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Не удалось загрузить уведомления'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((item) => !item.isRead);
    if (filter === 'overdue') return items.filter((item) => item.overdue);
    return items;
  }, [items, filter]);

  const summary = useMemo(() => ({
    total: items.length,
    unread: items.filter((item) => !item.isRead).length,
    overdue: items.filter((item) => item.overdue).length,
  }), [items]);

  const blockers = [
    summary.overdue > 0 ? `просрочены действия: ${summary.overdue}` : null,
    error ? `ошибка: ${error}` : null
  ].filter(Boolean) as string[];

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`, {});
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, isRead: true } : item));
  }

  return (
    <PageFrame title="Уведомления" subtitle="Каждый signal должен вести в рабочий модуль и owner action, а не быть отдельной лентой событий." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Уведомления' }]} />}>
      <SourceNote source={items[0]?.source || 'canonical.notifications.actionable'} warning="Уведомление нужно не для галочки. Оно должно открывать связанный объект и заканчиваться действием владельца процесса." compact />

      <DetailHero
        kicker="Actionable notification rail"
        title="Очередь рабочих сигналов"
        description="Здесь остаются только сигналы, которые требуют реакции: unread, overdue или ведущие в связанный объект сделки, денег, спора, логистики или модерации."
        chips={[
          <span key="all">Всего {summary.total}</span>,
          <span key="unread">Новых {summary.unread}</span>,
          <span key="overdue">Просрочено {summary.overdue}</span>
        ]}
        nextStep={filtered[0]?.nextAction || (summary.overdue ? 'Открыть просроченные сигналы и закрыть действия' : 'Проверить новые сигналы и перейти в связанный модуль')}
        owner="активная роль / владелец действия"
        blockers={blockers.join(' · ') || 'критических блокеров нет'}
        actions={[
          { href: '/notifications', label: 'Обновить список' },
          { href: '/support', label: 'Поддержка', variant: 'secondary' },
          { href: '/cabinet', label: 'Мой кабинет', variant: 'secondary' }
        ]}
      />

      <CriticalBlockersPanel items={blockers} emptyLabel="Критические блокеры по уведомлениям не обнаружены." />

      <div className="mobile-filter-bar">
        <button className={`filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Все</button>
        <button className={`filter-pill ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Новые</button>
        <button className={`filter-pill ${filter === 'overdue' ? 'active' : ''}`} onClick={() => setFilter('overdue')}>Просроченные</button>
      </div>

      <div className="space-y-3">
        {loading ? <div className="mobile-list-card muted">Загрузка…</div> : null}
        {!loading && error ? <div className="mobile-list-card text-red-600">{error}</div> : null}
        {!loading && !error && (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="mobile-list-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Link href={`/notifications/${item.id}`} className="font-medium text-sm hover:underline">{item.title}</Link>
                    <div className="text-sm text-muted-foreground">{item.body}</div>
                    <div className="text-xs text-muted-foreground">Канал: {item.channel || 'IN_APP'} · severity {item.severity || 'normal'} · entity {item.linkedEntity || '—'} · due {item.dueAt ? String(item.dueAt).slice(0, 16).replace('T', ' ') : '—'}</div>
                    {item.nextAction ? <div className="text-xs text-muted-foreground">Следующий шаг: {item.nextAction}</div> : null}
                    {item.overdue ? <div className="text-xs text-red-600">Уведомление просрочено</div> : null}
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">{item.createdAt ? String(item.createdAt).slice(0, 16).replace('T', ' ') : '—'}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link href={`/notifications/${item.id}`} className="button secondary compact">Открыть карточку</Link>
                  {!item.isRead ? <button onClick={() => markRead(item.id)} className="button secondary compact">Отметить прочитанным</button> : null}
                  {item.actionHref ? <Link href={item.actionHref} className="button ghost compact">Связанный раздел</Link> : null}
                </div>
              </div>
            ))}
            {!items.length ? <div className="empty-state"><p className="text-muted-foreground">Уведомлений пока нет.</p></div> : null}
          </div>
        )}
      </div>
    </PageFrame>
  );
}

export default function NotificationsPageGuarded(props: any) {
  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Уведомления доступны только после входа" subtitle="Очередь уведомлений имеет смысл только после авторизации и привязки роли.">
      <NotificationsPage {...props} />
    </PageAccessGuard>
  );
}
