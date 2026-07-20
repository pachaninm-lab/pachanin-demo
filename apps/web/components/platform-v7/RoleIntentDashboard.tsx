'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button, InlineNotice, StatusChip, Surface } from '@pc/design-system-v8';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './RoleIntentDashboard.module.css';

type Locale = 'ru' | 'en' | 'zh';

type AccessibleDealRef = {
  id: string;
  dealNumber: string | null;
  status: string | null;
  nextAction: string | null;
};

type AccessibleDealsPage = {
  deals: AccessibleDealRef[];
  nextCursor: string | null;
  total: number | null;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; deals: AccessibleDealRef[]; nextCursor: string | null; total: number | null; loadingMore: boolean; loadMoreError: string }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

type DashboardCopy = {
  today: string;
  loadingTitle: string;
  loadingBody: string;
  emptyTitle: string;
  emptyBody: string;
  errorTitle: string;
  repeat: string;
  unauthorized: string;
  loadFailed: string;
  invalidPayload: string;
  timeout: string;
  headerBody: string;
  noActions: string;
  allDeals: string;
  noActionRequired: string;
  loadMore: string;
  loadingMore: string;
  loadMoreErrorTitle: string;
  show: string;
  hide: string;
};

const PAGE_SIZE = 20;

const ROLE_FOCUS: Record<Locale, Record<PlatformRole, string>> = {
  ru: {
    operator: 'Управление исполнением сделок',
    buyer: 'Покупка, поставка и оплата',
    seller: 'Продажа, отгрузка и получение оплаты',
    logistics: 'Рейсы, водители и прибытие',
    driver: 'Текущий рейс и следующий шаг',
    surveyor: 'Осмотр и подтверждение фактов',
    elevator: 'Приёмка, вес и передача в лабораторию',
    lab: 'Пробы, качество и протокол',
    bank: 'Платёжное основание и банковское подтверждение',
    arbitrator: 'Спор, доказательства и решение',
    compliance: 'Допуск, документы и риски',
    executive: 'Деньги, блокировки и критические отклонения',
  },
  en: {
    operator: 'Transaction execution control',
    buyer: 'Purchase, delivery and payment',
    seller: 'Sale, shipment and payment receipt',
    logistics: 'Trips, drivers and arrival',
    driver: 'Current trip and next step',
    surveyor: 'Inspection and fact confirmation',
    elevator: 'Acceptance, weight and laboratory handoff',
    lab: 'Samples, quality and protocol',
    bank: 'Payment basis and bank confirmation',
    arbitrator: 'Dispute, evidence and decision',
    compliance: 'Admission, documents and risks',
    executive: 'Money, blockers and critical deviations',
  },
  zh: {
    operator: '交易执行管理',
    buyer: '采购、交付与付款',
    seller: '销售、发运与收款',
    logistics: '运输、司机与到达',
    driver: '当前运输与下一步',
    surveyor: '检验与事实确认',
    elevator: '接收、称重与送检',
    lab: '取样、质量与报告',
    bank: '付款依据与银行确认',
    arbitrator: '争议、证据与裁决',
    compliance: '准入、文件与风险',
    executive: '资金、阻断与重大偏差',
  },
};

const COPY: Record<Locale, DashboardCopy> = {
  ru: {
    today: 'Сегодня',
    loadingTitle: 'Собираем задачи на сегодня',
    loadingBody: 'Покажем только подтверждённые сделки и их следующий шаг.',
    emptyTitle: 'Сегодня нет активных сделок',
    emptyBody: 'У вас пока нет активных сделок, подтверждённых сервером. Новая сделка появится здесь после подтверждения вашего участия.',
    errorTitle: 'Не удалось загрузить задачи',
    repeat: 'Повторить',
    unauthorized: 'Доступ к сделкам не подтверждён. Войдите под рабочей учётной записью и повторите.',
    loadFailed: 'Не удалось загрузить сделки. Проверьте соединение и повторите.',
    invalidPayload: 'Сервер вернул некорректный список сделок. Повторите позже.',
    timeout: 'Сервер не ответил вовремя. Повторите загрузку.',
    headerBody: 'Сначала показана сделка, где от вас уже требуется действие. Остальные сделки и функции не скрыты.',
    noActions: 'Новых действий нет',
    allDeals: 'Все загруженные сделки',
    noActionRequired: 'Сейчас действие не требуется',
    loadMore: 'Показать ещё сделки',
    loadingMore: 'Загружаем ещё',
    loadMoreErrorTitle: 'Не удалось загрузить ещё сделки',
    show: 'Показать',
    hide: 'Скрыть',
  },
  en: {
    today: 'Today',
    loadingTitle: 'Preparing today’s tasks',
    loadingBody: 'Only server-confirmed deals and their next step will be shown.',
    emptyTitle: 'No active deals today',
    emptyBody: 'There are no active deals confirmed for your account. A deal will appear after your participation is confirmed.',
    errorTitle: 'Could not load tasks',
    repeat: 'Try again',
    unauthorized: 'Access to deals is not confirmed. Sign in again.',
    loadFailed: 'Could not load deals.',
    invalidPayload: 'The server returned an invalid deal list.',
    timeout: 'The server did not respond in time. Try again.',
    headerBody: 'The deal that already requires your action is shown first. Other deals and functions remain available.',
    noActions: 'No new actions',
    allDeals: 'All loaded deals',
    noActionRequired: 'No action is required now',
    loadMore: 'Show more deals',
    loadingMore: 'Loading more',
    loadMoreErrorTitle: 'Could not load more deals',
    show: 'Show',
    hide: 'Hide',
  },
  zh: {
    today: '今天',
    loadingTitle: '正在整理今日任务',
    loadingBody: '仅显示服务器已确认的交易及其下一步。',
    emptyTitle: '今天没有进行中的交易',
    emptyBody: '当前没有服务器为你的账户确认的进行中交易。参与资格确认后，交易会显示在这里。',
    errorTitle: '无法加载任务',
    repeat: '重试',
    unauthorized: '交易访问权限未确认，请重新登录。',
    loadFailed: '无法加载交易。',
    invalidPayload: '服务器返回了无效的交易列表。',
    timeout: '服务器响应超时，请重试。',
    headerBody: '需要你立即处理的交易优先显示，其他交易和功能仍可使用。',
    noActions: '没有新操作',
    allDeals: '已加载的全部交易',
    noActionRequired: '当前无需操作',
    loadMore: '显示更多交易',
    loadingMore: '正在加载',
    loadMoreErrorTitle: '无法加载更多交易',
    show: '展开',
    hide: '收起',
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || null;
}

function optionalNonNegativeInteger(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return undefined;
  return value;
}

function validDealsPage(payload: unknown): AccessibleDealsPage | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.items)) return null;

  const deals: AccessibleDealRef[] = [];
  for (const item of root.items) {
    if (!item || typeof item !== 'object') return null;

    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const dealNumber = optionalString(row.dealNumber);
    const status = optionalString(row.status);
    const nextAction = optionalString(row.nextAction);

    if (!id || dealNumber === undefined || status === undefined || nextAction === undefined) return null;
    deals.push({ id, dealNumber, status, nextAction });
  }

  const pagination = root.pagination && typeof root.pagination === 'object'
    ? root.pagination as Record<string, unknown>
    : null;
  const nextCursor = optionalString(root.nextCursor ?? pagination?.nextCursor);
  const total = optionalNonNegativeInteger(root.total ?? pagination?.total);
  if (nextCursor === undefined || total === undefined) return null;

  return { deals, nextCursor, total };
}

function prioritizeDeals(deals: AccessibleDealRef[]): AccessibleDealRef[] {
  const actionable: AccessibleDealRef[] = [];
  const waiting: AccessibleDealRef[] = [];
  for (const deal of deals) (deal.nextAction ? actionable : waiting).push(deal);
  return [...actionable, ...waiting];
}

function mergeDeals(current: AccessibleDealRef[], incoming: AccessibleDealRef[]): AccessibleDealRef[] {
  const byId = new Map<string, AccessibleDealRef>();
  for (const deal of current) byId.set(deal.id, deal);
  for (const deal of incoming) byId.set(deal.id, deal);
  return prioritizeDeals([...byId.values()]);
}

function actionCountLabel(count: number, locale: Locale, copy: DashboardCopy): string {
  if (count === 0) return copy.noActions;
  if (locale === 'zh') return `${count} 笔交易需要操作`;
  if (locale === 'en') return count === 1 ? '1 deal requires action' : `${count} deals require action`;

  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} сделка требует действия`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} сделки требуют действия`;
  return `${count} сделок требуют действия`;
}

function loadedCountLabel(count: number, total: number | null, locale: Locale): string {
  if (locale === 'zh') return total === null ? `已加载 ${count} 笔进行中交易` : `已加载 ${count}/${total} 笔交易`;
  if (locale === 'en') return total === null ? `${count} active deals loaded` : `${count} of ${total} deals loaded`;
  return total === null ? `Загружено активных сделок: ${count}` : `Загружено ${count} из ${total}`;
}

function dealTitle(deal: AccessibleDealRef): string {
  return deal.dealNumber || deal.id;
}

function pageUrl(cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return `/api/proxy/deals/accessible?${params.toString()}`;
}

export function RoleIntentDashboard({ role }: { role: PlatformRole }) {
  const locale = normalizeLocale(useLocale());
  const copy = COPY[locale];
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });
  const requestRef = React.useRef(0);

  const load = React.useCallback(async (cursor: string | null = null, append = false) => {
    const requestId = ++requestRef.current;
    if (append) {
      setState((current) => current.kind === 'ready'
        ? { ...current, loadingMore: true, loadMoreError: '' }
        : current);
    } else {
      setState({ kind: 'loading' });
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(pageUrl(cursor), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== requestRef.current) return;

      if (!response.ok) {
        const message = response.status === 401 || response.status === 403 ? copy.unauthorized : copy.loadFailed;
        if (append) {
          setState((current) => current.kind === 'ready'
            ? { ...current, loadingMore: false, loadMoreError: message }
            : current);
        } else {
          setState({ kind: 'error', message });
        }
        return;
      }

      const page = validDealsPage(payload);
      if (!page) {
        if (append) {
          setState((current) => current.kind === 'ready'
            ? { ...current, loadingMore: false, loadMoreError: copy.invalidPayload }
            : current);
        } else {
          setState({ kind: 'error', message: copy.invalidPayload });
        }
        return;
      }

      if (append) {
        setState((current) => current.kind === 'ready'
          ? {
              kind: 'ready',
              deals: mergeDeals(current.deals, page.deals),
              nextCursor: page.nextCursor,
              total: page.total ?? current.total,
              loadingMore: false,
              loadMoreError: '',
            }
          : current);
      } else {
        setState(page.deals.length === 0
          ? { kind: 'empty' }
          : {
              kind: 'ready',
              deals: prioritizeDeals(page.deals),
              nextCursor: page.nextCursor,
              total: page.total,
              loadingMore: false,
              loadMoreError: '',
            });
      }
    } catch (error) {
      if (requestId !== requestRef.current) return;
      const message = error instanceof DOMException && error.name === 'AbortError' ? copy.timeout : copy.loadFailed;
      if (append) {
        setState((current) => current.kind === 'ready'
          ? { ...current, loadingMore: false, loadMoreError: message }
          : current);
      } else {
        setState({ kind: 'error', message });
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }, [copy]);

  React.useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <Surface className={styles.stateCard} aria-live='polite' data-transaction-role-cockpit='v8' data-locale={locale}>
        <div className={styles.stateContent}>
          <RefreshCw className={styles.spin} size={24} aria-hidden='true' />
          <h1>{copy.loadingTitle}</h1>
          <p>{copy.loadingBody}</p>
        </div>
      </Surface>
    );
  }

  if (state.kind === 'empty') {
    return (
      <Surface className={styles.stateCard} data-empty-deals data-transaction-role-cockpit='v8' data-locale={locale}>
        <div className={styles.stateContent}>
          <CheckCircle2 className={styles.emptyIcon} size={28} aria-hidden='true' />
          <h1>{copy.emptyTitle}</h1>
          <p>{copy.emptyBody}</p>
        </div>
      </Surface>
    );
  }

  if (state.kind === 'error') {
    return (
      <Surface className={styles.stateCard} role='alert' data-deals-error data-transaction-role-cockpit='v8' data-locale={locale}>
        <div className={styles.stateContent}>
          <AlertTriangle className={styles.errorIcon} size={26} aria-hidden='true' />
          <h1>{copy.errorTitle}</h1>
          <p>{state.message}</p>
          <Button variant='secondary' onClick={() => void load()}>
            <RefreshCw size={18} aria-hidden='true' /> {copy.repeat}
          </Button>
        </div>
      </Surface>
    );
  }

  const [current, ...otherDeals] = state.deals;
  const actionableCount = state.deals.filter((deal) => deal.nextAction).length;

  return (
    <div className={styles.todayWorkspace} data-transaction-role-cockpit='v8' data-role={role} data-locale={locale}>
      <Surface className={styles.todayHeader} aria-labelledby='today-title'>
        <div className={styles.todayCopy}>
          <StatusChip tone='information'>{copy.today}</StatusChip>
          <h1 id='today-title'>{ROLE_FOCUS[locale][role]}</h1>
          <p>{copy.headerBody}</p>
        </div>
        <Surface className={styles.todayFacts} variant='subtle' padded={false} aria-label={copy.today}>
          <strong>{actionCountLabel(actionableCount, locale, copy)}</strong>
          <span>{loadedCountLabel(state.deals.length, state.total, locale)}</span>
        </Surface>
      </Surface>

      {otherDeals.length > 0 || state.nextCursor ? (
        <details className={styles.otherDeals}>
          <summary>
            <span>{copy.allDeals}: {state.deals.length}</span>
            <span className={styles.summaryShow}>{copy.show}</span>
            <span className={styles.summaryHide}>{copy.hide}</span>
          </summary>
          <div className={styles.dealListBody}>
            {otherDeals.length > 0 ? (
              <nav className={styles.dealLinks} aria-label={copy.allDeals}>
                {otherDeals.map((deal) => (
                  <Link className={styles.dealLink} key={deal.id} href={`/platform-v7/deals/${encodeURIComponent(deal.id)}/execution`}>
                    <span className={styles.dealCopy}>
                      <strong>{dealTitle(deal)}</strong>
                      <small>{deal.nextAction || copy.noActionRequired}</small>
                    </span>
                    <ArrowRight size={18} aria-hidden='true' />
                  </Link>
                ))}
              </nav>
            ) : null}

            {state.nextCursor ? (
              <Button
                className={styles.loadMoreButton}
                variant='secondary'
                fullWidth
                disabled={state.loadingMore}
                onClick={() => void load(state.nextCursor, true)}
              >
                {state.loadingMore ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : <ArrowRight size={18} aria-hidden='true' />}
                {state.loadingMore ? copy.loadingMore : copy.loadMore}
              </Button>
            ) : null}

            {state.loadMoreError ? (
              <InlineNotice tone='critical' title={copy.loadMoreErrorTitle} icon={<AlertTriangle size={18} />}>
                {state.loadMoreError}
              </InlineNotice>
            ) : null}
          </div>
        </details>
      ) : null}

      <CanonicalDealWorkspace role={role} dealId={current.id} />
    </div>
  );
}
