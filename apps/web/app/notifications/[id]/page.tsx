'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api-client';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { SourceNote } from '../../../components/source-note';
import { DetailHero } from '../../../components/detail-hero';
import { CriticalBlockersPanel } from '../../../components/critical-blockers-panel';
import { NextStepBar } from '../../../components/next-step-bar';
import { OperationalStatePanel } from '../../../components/operational-state-panel';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../../lib/route-roles';
import { CardSkeleton } from '../../../components/skeleton';

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

function NotificationsDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<Notif | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const list = await api.get<Notif[]>('/notifications');
    const items = Array.isArray(list) ? list : [];
    const match = items.find((entry) => entry.id === params.id) || null;
    setItem(match);
    if (match && !match.isRead) {
      await api.patch(`/notifications/${match.id}/read`, {}).catch(() => null);
      setItem({ ...match, isRead: true });
    }
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Не удалось загрузить уведомление'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const blockers = useMemo(() => [
    item?.overdue ? 'действие по уведомлению просрочено' : null,
    !item?.actionHref ? 'не определён связанный раздел для закрытия действия' : null,
    error ? `ошибка: ${error}` : null
  ].filter(Boolean) as string[], [item, error]);

  if (loading) {
    return (
      <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Уведомление доступно после входа" subtitle="Карточка сигнала доступна только авторизованным ролям.">
        <PageFrame title={`Уведомление · ${params.id}`} subtitle="Загрузка карточки уведомления.">
          <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
        </PageFrame>
      </PageAccessGuard>
    );
  }

  return (
    <PageAccessGuard allowedRoles={[...ALL_AUTHENTICATED_ROLES]} title="Уведомление доступно после входа" subtitle="Карточка сигнала доступна только авторизованным ролям.">
      <PageFrame
        title={`Уведомление · ${params.id}`}
        subtitle="Сигнал должен вести в рабочий раздел и заканчиваться конкретным owner action."
        breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/notifications', label: 'Уведомления' }, { label: params.id }]} />}
      >
        {!item ? (
          <OperationalStatePanel
            source="canonical.notifications.actionable"
            title="Уведомление не найдено"
            detail={error || 'Очередь уведомлений не вернула этот signal id. Вернись в общий список и обнови runtime.'}
            primary={{ href: '/notifications', label: 'Вернуться в уведомления' }}
            secondary={[{ href: '/cabinet', label: 'Открыть кабинет' }]}
          />
        ) : (
          <div className="space-y-6 mobile-page-bottom-space">
            <SourceNote source={item.source || 'canonical.notifications.actionable'} updatedAt={item.createdAt} warning={item.overdue ? 'Дедлайн уже нарушен. Нужно открыть связанный раздел и закрыть действие.' : 'После открытия карточки уведомление считается просмотренным, но действие всё равно должно быть закрыто в связанном модуле.'} compact />

            <DetailHero
              kicker="Notification workspace"
              title={item.title}
              description={item.body}
              chips={[
                <span key="severity">{item.severity || 'normal'}</span>,
                <span key="entity">{item.linkedEntity || '—'}</span>,
                <span key="channel">{item.channel || 'IN_APP'}</span>
              ]}
              nextStep={item.nextAction || 'Открыть связанный модуль и закрыть сигнал'}
              owner="текущая роль / владелец действия"
              blockers={blockers.join(' · ') || 'критических блокеров нет'}
              actions={item.actionHref ? [{ href: item.actionHref, label: 'Открыть связанный раздел' }, { href: '/notifications', label: 'Вернуться в список', variant: 'secondary' }] : [{ href: '/notifications', label: 'Вернуться в список' }]}
              status={item.isRead ? 'READ' : 'UNREAD'}
              deadline={item.dueAt ? String(item.dueAt).slice(0, 16).replace('T', ' ') : '—'}
            />

            <CriticalBlockersPanel items={blockers} emptyLabel="Блокеров по уведомлению не видно." />

            <div className="info-grid-2">
              <div className="section-card">
                <div className="section-title">Контекст сигнала</div>
                <div className="info-grid-2" style={{ marginTop: 12 }}>
                  <div className="info-card"><div className="label">Создано</div><div className="value">{item.createdAt ? String(item.createdAt).slice(0, 16).replace('T', ' ') : '—'}</div></div>
                  <div className="info-card"><div className="label">Due at</div><div className="value">{item.dueAt ? String(item.dueAt).slice(0, 16).replace('T', ' ') : '—'}</div></div>
                  <div className="info-card"><div className="label">Связанный раздел</div><div className="value">{item.actionHref || '—'}</div></div>
                  <div className="info-card"><div className="label">Состояние</div><div className="value">{item.overdue ? 'Просрочено' : item.isRead ? 'Прочитано' : 'Новое'}</div></div>
                </div>
              </div>
              <div className="section-card">
                <div className="section-title">Рабочие переходы</div>
                <div className="nav-chip-row" style={{ marginTop: 12 }}>
                  {item.actionHref ? <Link href={item.actionHref} className="nav-chip">Связанный раздел</Link> : null}
                  <Link href="/notifications" className="nav-chip">Все уведомления</Link>
                  <Link href="/support" className="nav-chip">Поддержка</Link>
                  <Link href="/cabinet" className="nav-chip">Мой кабинет</Link>
                </div>
                <div className="muted tiny" style={{ marginTop: 12 }}>Уведомление само по себе не завершает работу. Оно должно приводить в модуль, где owner закрывает причину сигнала.</div>
              </div>
            </div>

            <NextStepBar
              title={item.nextAction || 'Открыть связанный модуль и закрыть действие'}
              detail="После перехода в связанный раздел владелец должен снять причину уведомления: оплатить, одобрить, проверить доказательства, закрыть спор или завершить модерацию."
              primary={item.actionHref ? { href: item.actionHref, label: 'Перейти к действию' } : { href: '/notifications', label: 'Вернуться в список' }}
              secondary={[{ href: '/support', label: 'Поддержка' }]}
            />
          </div>
        )}
      </PageFrame>
    </PageAccessGuard>
  );
}

export default NotificationsDetailPage;
