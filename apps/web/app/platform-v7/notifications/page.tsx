'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlertTriangle, Bell, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { Button, InlineNotice, StatusChip, Surface } from '@pc/design-system-v8';
import styles from './notifications.module.css';

type Locale = 'ru' | 'en' | 'zh';
type NotificationTone = 'neutral' | 'information' | 'warning';

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

type Copy = Readonly<{
  title: string;
  loadingTitle: string;
  loadingBody: string;
  unavailableTitle: string;
  sessionExpired: string;
  loadFailed: string;
  invalidPayload: string;
  timeout: string;
  retry: string;
  unreadCount: (count: number) => string;
  noNew: string;
  controlsLabel: string;
  unreadOnly: string;
  markAll: string;
  markAllBusy: string;
  markRead: string;
  markReadBusy: string;
  read: string;
  markReadFailed: string;
  markAllFailed: string;
  emptyUnreadTitle: string;
  emptyTitle: string;
  emptyBody: string;
  listLabel: string;
  openDeal: string;
  timeUnknown: string;
  types: Readonly<{
    deal: string;
    shipment: string;
    document: string;
    kyc: string;
    financing: string;
    support: string;
    system: string;
  }>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    title: 'Уведомления',
    loadingTitle: 'Загружаем уведомления',
    loadingBody: 'Покажем только события, полученные для вашего аккаунта и доступных сделок.',
    unavailableTitle: 'Уведомления недоступны',
    sessionExpired: 'Сессия не подтверждена. Войдите в платформу заново.',
    loadFailed: 'Не удалось получить уведомления.',
    invalidPayload: 'Сервер вернул уведомления в неизвестном формате.',
    timeout: 'Сервер не ответил вовремя. Повторите загрузку.',
    retry: 'Повторить',
    unreadCount: (count) => `Непрочитанных: ${count}`,
    noNew: 'Новых уведомлений нет',
    controlsLabel: 'Настройки списка уведомлений',
    unreadOnly: 'Только непрочитанные',
    markAll: 'Прочитать все',
    markAllBusy: 'Сохраняем…',
    markRead: 'Отметить прочитанным',
    markReadBusy: 'Сохраняем…',
    read: 'Прочитано',
    markReadFailed: 'Не удалось сохранить отметку. Уведомление осталось непрочитанным.',
    markAllFailed: 'Не удалось отметить все уведомления. Попробуйте ещё раз.',
    emptyUnreadTitle: 'Все уведомления прочитаны',
    emptyTitle: 'Уведомлений пока нет',
    emptyBody: 'Здесь появятся только фактические события вашего аккаунта и доступных сделок.',
    listLabel: 'Список уведомлений',
    openDeal: 'Открыть сделку',
    timeUnknown: 'Время не указано',
    types: { deal: 'Сделка', shipment: 'Перевозка', document: 'Документы', kyc: 'Проверка', financing: 'Финансирование', support: 'Поддержка', system: 'Система' },
  },
  en: {
    title: 'Notifications',
    loadingTitle: 'Loading notifications',
    loadingBody: 'Only events issued for your account and accessible deals will be shown.',
    unavailableTitle: 'Notifications are unavailable',
    sessionExpired: 'The session is not confirmed. Sign in to the platform again.',
    loadFailed: 'Notifications could not be loaded.',
    invalidPayload: 'The server returned notifications in an unknown format.',
    timeout: 'The server did not respond in time. Retry the request.',
    retry: 'Retry',
    unreadCount: (count) => `Unread: ${count}`,
    noNew: 'No new notifications',
    controlsLabel: 'Notification list settings',
    unreadOnly: 'Unread only',
    markAll: 'Mark all as read',
    markAllBusy: 'Saving…',
    markRead: 'Mark as read',
    markReadBusy: 'Saving…',
    read: 'Read',
    markReadFailed: 'The read state could not be saved. The notification remains unread.',
    markAllFailed: 'Notifications could not be marked as read. Try again.',
    emptyUnreadTitle: 'All notifications are read',
    emptyTitle: 'No notifications yet',
    emptyBody: 'Only actual events from your account and accessible deals will appear here.',
    listLabel: 'Notification list',
    openDeal: 'Open deal',
    timeUnknown: 'Time not provided',
    types: { deal: 'Deal', shipment: 'Shipment', document: 'Documents', kyc: 'Verification', financing: 'Financing', support: 'Support', system: 'System' },
  },
  zh: {
    title: '通知',
    loadingTitle: '正在加载通知',
    loadingBody: '这里只显示发送给你的账户以及你有权访问的交易事件。',
    unavailableTitle: '通知暂不可用',
    sessionExpired: '会话未确认。请重新登录平台。',
    loadFailed: '无法加载通知。',
    invalidPayload: '服务器返回了未知格式的通知。',
    timeout: '服务器未及时响应。请重试。',
    retry: '重试',
    unreadCount: (count) => `未读：${count}`,
    noNew: '没有新通知',
    controlsLabel: '通知列表设置',
    unreadOnly: '仅显示未读',
    markAll: '全部标为已读',
    markAllBusy: '正在保存…',
    markRead: '标为已读',
    markReadBusy: '正在保存…',
    read: '已读',
    markReadFailed: '无法保存已读状态。该通知仍为未读。',
    markAllFailed: '无法将全部通知标为已读。请重试。',
    emptyUnreadTitle: '所有通知均已读',
    emptyTitle: '暂无通知',
    emptyBody: '这里只会显示你的账户和可访问交易产生的真实事件。',
    listLabel: '通知列表',
    openDeal: '打开交易',
    timeUnknown: '未提供时间',
    types: { deal: '交易', shipment: '运输', document: '文件', kyc: '核验', financing: '融资', support: '支持', system: '系统' },
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

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

function formatTime(value: string, locale: Locale, fallback: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const localeTag = locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
  return new Intl.DateTimeFormat(localeTag, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function notificationType(type: string, copy: Copy): { label: string; tone: NotificationTone } {
  if (type.startsWith('deal:')) return { label: copy.types.deal, tone: 'information' };
  if (type.startsWith('shipment:') || type.startsWith('etn:')) return { label: copy.types.shipment, tone: 'information' };
  if (type.startsWith('document:') || type.startsWith('edo:')) return { label: copy.types.document, tone: 'neutral' };
  if (type.startsWith('kyc:')) return { label: copy.types.kyc, tone: 'warning' };
  if (type.startsWith('factoring:')) return { label: copy.types.financing, tone: 'information' };
  if (type.startsWith('support:')) return { label: copy.types.support, tone: 'neutral' };
  return { label: copy.types.system, tone: 'neutral' };
}

export default function NotificationsPage() {
  const locale = localeOf(useLocale());
  const copy = COPY[locale];
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
        setState({ kind: 'error', message: response.status === 401 || response.status === 403 ? copy.sessionExpired : copy.loadFailed });
        return;
      }
      const items = parseItems(payload);
      if (!items) {
        setState({ kind: 'error', message: copy.invalidPayload });
        return;
      }
      setState({ kind: 'ready', items });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof DOMException && error.name === 'AbortError' ? copy.timeout : copy.loadFailed,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, [copy.invalidPayload, copy.loadFailed, copy.sessionExpired, copy.timeout]);

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
        ? { kind: 'ready', items: current.items.map((item) => item.id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item) }
        : current);
    } catch {
      setActionError(copy.markReadFailed);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }, [copy.markReadFailed]);

  const markAllRead = React.useCallback(async () => {
    const unreadIds = state.kind === 'ready' ? state.items.filter((item) => !item.read).map((item) => item.id) : [];
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
        ? { kind: 'ready', items: current.items.map((item) => ({ ...item, read: true, readAt: item.readAt ?? new Date().toISOString() })) }
        : current);
    } catch {
      setActionError(copy.markAllFailed);
    } finally {
      setBusyIds(new Set());
    }
  }, [copy.markAllFailed, state]);

  if (state.kind === 'loading') {
    return (
      <main className={styles.page}>
        <Surface className={styles.stateCard} aria-live='polite'>
          <RefreshCw className={styles.spin} aria-hidden='true' />
          <h1>{copy.loadingTitle}</h1>
          <p>{copy.loadingBody}</p>
        </Surface>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className={styles.page}>
        <Surface className={styles.stateCard}>
          <InlineNotice tone='critical' icon={<AlertTriangle />} title={copy.unavailableTitle}>{state.message}</InlineNotice>
          <Button onClick={() => void load()}><RefreshCw aria-hidden='true' />{copy.retry}</Button>
        </Surface>
      </main>
    );
  }

  const unreadCount = state.items.filter((item) => !item.read).length;
  const visibleItems = unreadOnly ? state.items.filter((item) => !item.read) : state.items;

  return (
    <main className={styles.page}>
      <Surface className={styles.hero}>
        <div className={styles.heroIcon}><Bell aria-hidden='true' /></div>
        <div className={styles.heroCopy}>
          <h1>{copy.title}</h1>
          <p>{unreadCount ? copy.unreadCount(unreadCount) : copy.noNew}</p>
        </div>
        <StatusChip tone={unreadCount ? 'information' : 'success'}>{unreadCount ? copy.unreadCount(unreadCount) : copy.noNew}</StatusChip>
      </Surface>

      <Surface className={styles.controls} variant='subtle' aria-label={copy.controlsLabel}>
        <label className={styles.switchLabel}>
          <input type='checkbox' checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
          <span>{copy.unreadOnly}</span>
        </label>
        <Button variant='secondary' disabled={!unreadCount || busyIds.size > 0} onClick={() => void markAllRead()}>
          <CheckCheck aria-hidden='true' />{busyIds.size > 0 ? copy.markAllBusy : copy.markAll}
        </Button>
      </Surface>

      {actionError ? <InlineNotice tone='critical' icon={<AlertTriangle />} title={copy.unavailableTitle}>{actionError}</InlineNotice> : null}

      {visibleItems.length === 0 ? (
        <Surface className={styles.emptyCard}>
          <Check className={styles.successIcon} aria-hidden='true' />
          <h2>{unreadOnly ? copy.emptyUnreadTitle : copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
        </Surface>
      ) : (
        <section className={styles.list} aria-label={copy.listLabel}>
          {visibleItems.map((item) => {
            const busy = busyIds.has(item.id);
            const type = notificationType(item.type, copy);
            return (
              <Surface className={styles.item} data-read={item.read ? 'true' : 'false'} key={item.id}>
                <div className={styles.itemTop}>
                  <StatusChip tone={type.tone}>{type.label}</StatusChip>
                  <time dateTime={item.createdAt}>{formatTime(item.createdAt, locale, copy.timeUnknown)}</time>
                </div>
                <div className={styles.itemBody}>
                  <h2>{item.title}</h2>
                  <p>{item.message}</p>
                </div>
                <div className={styles.itemActions}>
                  {item.dealId ? (
                    <Link className={styles.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(item.dealId)}/execution`}>
                      {copy.openDeal}
                    </Link>
                  ) : null}
                  {!item.read ? (
                    <Button variant='secondary' disabled={busy} onClick={() => void markRead(item.id)}>
                      <Check aria-hidden='true' />{busy ? copy.markReadBusy : copy.markRead}
                    </Button>
                  ) : <span className={styles.readStatus}><Check aria-hidden='true' />{copy.read}</span>}
                </div>
              </Surface>
            );
          })}
        </section>
      )}
    </main>
  );
}
