'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { Surface } from '@pc/design-system-v8';
import styles from './notifications.module.css';

type NotificationItem = {
  id: string;
  message: string;
  type: string;
  title: string;
  dealId?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: NotificationItem[] }
  | { kind: 'error'; message: string };

function validNotification(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<NotificationItem>;
  return typeof item.id === 'string'
    && typeof item.title === 'string'
    && typeof item.message === 'string'
    && typeof item.type === 'string'
    && typeof item.read === 'boolean'
    && typeof item.createdAt === 'string'
    && (item.dealId === undefined || typeof item.dealId === 'string');
}

function parseItems(payload: unknown): NotificationItem[] | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) return null;
  const items = (payload as { items: unknown[] }).items;
  return items.every(validNotification) ? items : null;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Время не указано';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function typeLabel(type: string): string {
  if (type.startsWith('deal:')) return 'Сделка';
  if (type.startsWith('shipment:') || type.startsWith('etn:')) return 'Перевозка';
  if (type.startsWith('document:') || type.startsWith('edo:')) return 'Документы';
  if (type.startsWith('kyc:')) return 'Проверка';
  if (type.startsWith('factoring:')) return 'Финансирование';
  if (type.startsWith('support:')) return 'Поддержка';
  return 'Система';
}

export default function NotificationsPage() {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const [actionError, setActionError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setState({ kind: 'loading' });
    setActionError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch('/api/proxy/notifications', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState({
          kind: 'error',
          message: response.status === 401 || response.status === 403
            ? 'Сессия не подтверждена. Войди в платформу заново.'
            : 'Не удалось получить уведомления.',
        });
        return;
      }
      const items = parseItems(payload);
      if (!items) {
        setState({ kind: 'error', message: 'Сервер вернул уведомления в неизвестном формате.' });
        return;
      }
      setState({ kind: 'ready', items });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof DOMException && error.name === 'AbortError'
          ? 'Сервер не ответил вовремя. Повтори загрузку.'
          : 'Не удалось получить уведомления.',
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const markRead = React.useCallback(async (id: string) => {
    setActionError(null);
    setBusyIds((current) => new Set(current).add(id));
    try {
      const response = await fetch(`/api/proxy/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('mark_read_failed');
      setState((current) => current.kind === 'ready'
        ? {
            kind: 'ready',
            items: current.items.map((item) => item.id === id
              ? { ...item, read: true, readAt: new Date().toISOString() }
              : item),
          }
        : current);
    } catch {
      setActionError('Не удалось сохранить отметку. Уведомление осталось непрочитанным.');
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const markAllRead = React.useCallback(async () => {
    const unreadIds = state.kind === 'ready'
      ? state.items.filter((item) => !item.read).map((item) => item.id)
      : [];
    if (!unreadIds.length) return;
    setActionError(null);
    setBusyIds(new Set(unreadIds));
    try {
      const response = await fetch('/api/proxy/notifications/read-all', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('mark_all_failed');
      setState((current) => current.kind === 'ready'
        ? {
            kind: 'ready',
            items: current.items.map((item) => ({
              ...item,
              read: true,
              readAt: item.readAt ?? new Date().toISOString(),
            })),
          }
        : current);
    } catch {
      setActionError('Не удалось отметить все уведомления. Попробуй ещё раз.');
    } finally {
      setBusyIds(new Set());
    }
  }, [state]);

  if (state.kind === 'loading') {
    return (
      <main className={styles.page}>
        <Surface className={styles.stateCard} aria-live='polite'>
          <RefreshCw className={styles.spin} aria-hidden='true' />
          <h1>Загружаем уведомления</h1>
          <p>Покажем только события, полученные для твоего аккаунта.</p>
        </Surface>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className={styles.page}>
        <Surface className={styles.stateCard} role='alert'>
          <AlertTriangle className={styles.errorIcon} aria-hidden='true' />
          <h1>Уведомления недоступны</h1>
          <p>{state.message}</p>
          <button className={styles.primaryButton} type='button' onClick={() => void load()}>
            <RefreshCw aria-hidden='true' />Повторить
          </button>
        </Surface>
      </main>
    );
  }

  const unreadCount = state.items.filter((item) => !item.read).length;
  const visibleItems = unreadOnly ? state.items.filter((item) => !item.read) : state.items;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroIcon}><Bell aria-hidden='true' /></div>
        <div>
          <h1>Уведомления</h1>
          <p>{unreadCount ? `Непрочитанных: ${unreadCount}` : 'Новых уведомлений нет'}</p>
        </div>
      </header>

      <Surface variant='plain' padded={false} className={styles.controls} aria-label='Настройки списка уведомлений'>
        <label className={styles.switchLabel}>
          <input type='checkbox' checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
          <span>Только непрочитанные</span>
        </label>
        <button className={styles.secondaryButton} type='button' disabled={!unreadCount || busyIds.size > 0} onClick={() => void markAllRead()}>
          <CheckCheck aria-hidden='true' />Прочитать все
        </button>
      </Surface>

      {actionError ? (
        <Surface variant='subtle' className={styles.controls} role='alert'>
          <AlertTriangle className={styles.errorIcon} aria-hidden='true' />
          <span>{actionError}</span>
        </Surface>
      ) : null}

      {visibleItems.length === 0 ? (
        <Surface className={styles.emptyCard}>
          <Check className={styles.successIcon} aria-hidden='true' />
          <h2>{unreadOnly ? 'Все уведомления прочитаны' : 'Уведомлений пока нет'}</h2>
          <p>Здесь появятся только фактические события твоего аккаунта и доступных сделок.</p>
        </Surface>
      ) : (
        <section className={styles.list} aria-label='Список уведомлений'>
          {visibleItems.map((item) => {
            const busy = busyIds.has(item.id);
            return (
              <Surface className={styles.item} data-read={item.read ? 'true' : 'false'} key={item.id} role='article'>
                <div className={styles.itemTop}>
                  <span className={styles.typeLabel}>{typeLabel(item.type)}</span>
                  <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                </div>
                <div className={styles.itemBody}>
                  <h2>{item.title}</h2>
                  <p>{item.message}</p>
                </div>
                <div className={styles.itemActions}>
                  {item.dealId ? (
                    <Link className={styles.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(item.dealId)}/execution`}>
                      Открыть сделку
                    </Link>
                  ) : null}
                  {!item.read ? (
                    <button className={styles.readButton} type='button' disabled={busy} onClick={() => void markRead(item.id)}>
                      <Check aria-hidden='true' />{busy ? 'Сохраняем…' : 'Прочитано'}
                    </button>
                  ) : <span className={styles.readStatus}><Check aria-hidden='true' />Прочитано</span>}
                </div>
              </Surface>
            );
          })}
        </section>
      )}
    </main>
  );
}
