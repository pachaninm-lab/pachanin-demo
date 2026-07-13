'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wheat,
} from 'lucide-react';
import styles from './CanonicalDealsList.module.css';

const PAGE_LIMIT = 20;

type AccessibleDeal = {
  id: string;
  dealNumber: string | null;
  status: string;
  culture: string | null;
  cropClass: string | null;
  region: string | null;
  volumeTons: string | null;
  totalKopecks: number | null;
  moneyImpactKopecks: string | null;
  currency: string;
  nextAction: string | null;
  deadlineAt: string | null;
  priorityReason: string;
  priorityRank: number;
  myRole: string;
  myAccessLevel: string;
  updatedAt: string;
};

type RegistryPage = {
  items: AccessibleDeal[];
  nextCursor: string | null;
  hasMore: boolean;
};

type RegistryState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AccessibleDeal[]; nextCursor: string | null; hasMore: boolean }
  | { kind: 'error'; message: string };

type LoadMode = 'initial' | 'more' | 'retry';

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || null;
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseRegistryPage(payload: unknown): RegistryPage | null {
  if (!payload || typeof payload !== 'object') return null;
  const envelope = payload as Record<string, unknown>;
  if (!Array.isArray(envelope.items) || typeof envelope.hasMore !== 'boolean') return null;

  const nextCursor = optionalString(envelope.nextCursor);
  if (nextCursor === undefined || (envelope.hasMore && !nextCursor)) return null;

  const items: AccessibleDeal[] = [];
  for (const item of envelope.items) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;

    const id = requiredString(row.id);
    const status = requiredString(row.status);
    const currency = requiredString(row.currency) || 'RUB';
    const myRole = requiredString(row.myRole);
    const myAccessLevel = requiredString(row.myAccessLevel);
    const updatedAt = requiredString(row.updatedAt);
    const priorityReason = requiredString(row.priorityReason);
    const dealNumber = optionalString(row.dealNumber);
    const culture = optionalString(row.culture);
    const cropClass = optionalString(row.cropClass);
    const region = optionalString(row.region);
    const volumeTons = optionalString(row.volumeTons);
    const nextAction = optionalString(row.nextAction);
    const deadlineAt = optionalString(row.deadlineAt);
    const moneyImpactKopecks = optionalString(row.moneyImpactKopecks);
    const totalKopecks = row.totalKopecks === null || row.totalKopecks === undefined
      ? null
      : typeof row.totalKopecks === 'number' && Number.isFinite(row.totalKopecks)
        ? row.totalKopecks
        : undefined;
    const priorityRank = typeof row.priorityRank === 'number' && Number.isInteger(row.priorityRank)
      ? row.priorityRank
      : undefined;

    if (
      !id || !status || !myRole || !myAccessLevel || !updatedAt || !priorityReason
      || dealNumber === undefined || culture === undefined || cropClass === undefined
      || region === undefined || volumeTons === undefined || nextAction === undefined
      || deadlineAt === undefined || moneyImpactKopecks === undefined
      || totalKopecks === undefined || priorityRank === undefined
    ) return null;

    items.push({
      id,
      dealNumber,
      status,
      culture,
      cropClass,
      region,
      volumeTons,
      totalKopecks,
      moneyImpactKopecks,
      currency,
      nextAction,
      deadlineAt,
      priorityReason,
      priorityRank,
      myRole,
      myAccessLevel,
      updatedAt,
    });
  }

  return { items, nextCursor, hasMore: envelope.hasMore };
}

function appendUniqueDeals(current: AccessibleDeal[], incoming: AccessibleDeal[]): AccessibleDeal[] {
  const byId = new Map(current.map((deal) => [deal.id, deal]));
  for (const deal of incoming) byId.set(deal.id, deal);
  return [...byId.values()];
}

function humanStatus(value: string): string {
  const known: Record<string, string> = {
    CREATED: 'Создана',
    DRAFT: 'Черновик',
    ADMISSION_APPROVED: 'Допуск подтверждён',
    AUCTION_OPEN: 'Идут торги',
    AUCTION_WON: 'Победитель выбран',
    CONTRACT_SIGNED: 'Договор подписан',
    RESERVE_REQUESTED: 'Запрошен резерв',
    RESERVED: 'Деньги зарезервированы',
    LOGISTICS_ASSIGNED: 'Перевозка назначена',
    LOADED: 'Погрузка подтверждена',
    IN_TRANSIT: 'Груз в пути',
    ARRIVED: 'Груз прибыл',
    WEIGHED: 'Вес подтверждён',
    INSPECTION_CONFIRMED: 'Осмотр подтверждён',
    QUALITY_ACCEPTED: 'Качество принято',
    DELIVERY_ACCEPTED: 'Поставка принята',
    DOCUMENTS_COMPLETE: 'Документы готовы',
    RELEASE_REQUESTED: 'Запрошена выплата',
    RELEASED: 'Выплата подтверждена',
    DISPUTE: 'Открыт спор',
    COMPLETED: 'Завершена',
    CLOSED: 'Закрыта',
    CANCELLED: 'Отменена',
  };
  return known[value] || value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function priorityLabel(value: string): string {
  const known: Record<string, string> = {
    DISPUTE_CONTROL: 'Спор требует контроля',
    MONEY_CONTROL: 'Деньги требуют контроля',
    OVERDUE_ACTION: 'Срок нарушен',
    DEADLINE_ACTION: 'Есть срок',
    ACTION_REQUIRED: 'Нужно действие',
    RECENT_ACTIVITY: 'Наблюдение',
  };
  return known[value] || 'Требует внимания';
}

function formatMoney(exactKopecks: string | null, fallbackKopecks: number | null, currency: string): string {
  if (exactKopecks && /^-?\d+$/.test(exactKopecks)) {
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency || 'RUB',
        maximumFractionDigits: 0,
      }).format(BigInt(exactKopecks) / 100n);
    } catch {
      // Fall through to the validated legacy-safe numeric projection.
    }
  }
  if (fallbackKopecks === null || !Number.isFinite(fallbackKopecks)) return 'Сумма не указана';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency || 'RUB',
    maximumFractionDigits: 0,
  }).format(fallbackKopecks / 100);
}

function exportMoney(exactKopecks: string | null, fallbackKopecks: number | null): number | string | null {
  if (fallbackKopecks !== null && Number.isSafeInteger(fallbackKopecks)) return fallbackKopecks / 100;
  if (!exactKopecks || !/^\d+$/.test(exactKopecks)) return null;
  const padded = exactKopecks.padStart(3, '0');
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function formatDateTime(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function dealTitle(deal: AccessibleDeal): string {
  return deal.dealNumber || deal.id;
}

async function exportVisibleDeals(items: AccessibleDeal[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Прозрачная Цена';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Сделки');
  sheet.columns = [
    { header: 'Сделка', key: 'deal', width: 22 },
    { header: 'Культура', key: 'culture', width: 20 },
    { header: 'Класс', key: 'cropClass', width: 14 },
    { header: 'Регион', key: 'region', width: 24 },
    { header: 'Статус', key: 'status', width: 24 },
    { header: 'Причина приоритета', key: 'priority', width: 28 },
    { header: 'Следующий шаг', key: 'nextAction', width: 36 },
    { header: 'Срок', key: 'deadlineAt', width: 20 },
    { header: 'Сумма', key: 'amount', width: 20 },
    { header: 'Валюта', key: 'currency', width: 10 },
    { header: 'Обновлена', key: 'updatedAt', width: 20 },
  ];

  for (const deal of items) {
    sheet.addRow({
      deal: dealTitle(deal),
      culture: deal.culture || 'Зерно',
      cropClass: deal.cropClass || '',
      region: deal.region || '',
      status: humanStatus(deal.status),
      priority: priorityLabel(deal.priorityReason),
      nextAction: deal.nextAction || 'Действие не требуется',
      deadlineAt: deal.deadlineAt ? new Date(deal.deadlineAt) : null,
      amount: exportMoney(deal.moneyImpactKopecks, deal.totalKopecks),
      currency: deal.currency,
      updatedAt: new Date(deal.updatedAt),
    });
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17563F' } };
  header.alignment = { vertical: 'middle' };
  header.height = 24;

  sheet.getColumn('amount').numFmt = '#,##0.00';
  sheet.getColumn('deadlineAt').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn('updatedAt').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'K1' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `прозрачная-цена-сделки-${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CanonicalDealsList() {
  const [state, setState] = React.useState<RegistryState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState('');
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState('');
  const requestRef = React.useRef(0);

  const load = React.useCallback(async (mode: LoadMode = 'initial', cursor: string | null = null) => {
    const requestId = ++requestRef.current;
    if (mode === 'more') {
      setLoadingMore(true);
      setLoadMoreError('');
    } else {
      setState({ kind: 'loading' });
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) params.set('cursor', cursor);

    try {
      const response = await fetch(`/api/proxy/deals/accessible?${params.toString()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== requestRef.current) return;

      if (!response.ok) {
        const fallback = response.status === 401 || response.status === 403
          ? 'Доступ к сделкам не подтверждён. Войди заново.'
          : 'Не удалось загрузить реестр сделок.';
        const message = payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
          ? String((payload as { message: string }).message)
          : fallback;
        if (mode === 'more') setLoadMoreError(message);
        else setState({ kind: 'error', message });
        return;
      }

      const page = parseRegistryPage(payload);
      if (!page) {
        const message = 'Сервер вернул некорректный реестр сделок.';
        if (mode === 'more') setLoadMoreError(message);
        else setState({ kind: 'error', message });
        return;
      }

      if (mode === 'more') {
        setState((current) => current.kind === 'ready'
          ? {
              kind: 'ready',
              items: appendUniqueDeals(current.items, page.items),
              nextCursor: page.nextCursor,
              hasMore: page.hasMore,
            }
          : { kind: 'ready', ...page });
      } else {
        setState({ kind: 'ready', ...page });
      }
    } catch (error) {
      if (requestId !== requestRef.current) return;
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Сервер не ответил вовремя. Повтори загрузку.'
        : 'Нет связи с сервером. Реестр не был заменён локальными данными.';
      if (mode === 'more') setLoadMoreError(message);
      else setState({ kind: 'error', message });
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestRef.current) setLoadingMore(false);
    }
  }, []);

  React.useEffect(() => {
    void load('initial');
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const handleExport = async (items: AccessibleDeal[]) => {
    setExporting(true);
    setExportError('');
    try {
      await exportVisibleDeals(items);
    } catch {
      setExportError('Не удалось сформировать Excel. Повтори действие.');
    } finally {
      setExporting(false);
    }
  };

  if (state.kind === 'loading') {
    return (
      <section className={styles.stateCard} aria-live='polite'>
        <Loader2 className={styles.spin} size={26} aria-hidden='true' />
        <h2>Загружаем ваши сделки</h2>
        <p>Список формирует сервер с учётом участия и полномочий.</p>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className={styles.stateCard} role='alert'>
        <AlertTriangle className={styles.errorIcon} size={28} aria-hidden='true' />
        <h2>Реестр временно недоступен</h2>
        <p>{state.message}</p>
        <button className={styles.primaryButton} type='button' onClick={() => void load('retry')}>
          <RefreshCw size={18} aria-hidden='true' /> Повторить
        </button>
      </section>
    );
  }

  const { items, nextCursor, hasMore } = state;
  const actionableCount = items.filter((deal) => Boolean(deal.nextAction)).length;
  const canLoadMore = hasMore && Boolean(nextCursor);

  if (items.length === 0) {
    return (
      <section className={styles.stateCard} data-empty-deals>
        <CheckCircle2 className={styles.emptyIcon} size={28} aria-hidden='true' />
        <h2>Активных сделок пока нет</h2>
        <p>Сделка появится здесь только после подтверждения вашего участия сервером.</p>
      </section>
    );
  }

  return (
    <section className={styles.registry} data-testid='canonical-deals-list'>
      <header className={styles.registryHeader}>
        <div className={styles.registryTitle}>
          <span className={styles.kicker}><ShieldCheck size={16} aria-hidden='true' /> Доступ подтверждён сервером</span>
          <h2>Все показанные сделки</h2>
          <p>Сначала показаны сделки с наибольшим операционным и денежным влиянием. Реестр продолжает выборку по серверному курсору.</p>
        </div>
        <div className={styles.summary} aria-label='Сводка показанного реестра'>
          <strong>{items.length}</strong>
          <span>загружено сделок</span>
          <small>{actionableCount ? `${actionableCount} требуют действия` : 'новых действий нет'}</small>
        </div>
      </header>

      <div className={styles.toolbar}>
        <button
          className={styles.secondaryButton}
          type='button'
          disabled={exporting}
          onClick={() => void handleExport(items)}
        >
          {exporting ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : <Download size={18} aria-hidden='true' />}
          {exporting ? 'Формируем Excel…' : 'Скачать показанные сделки'}
        </button>
        <button className={styles.iconButton} type='button' aria-label='Обновить реестр сделок' onClick={() => void load('retry')}>
          <RefreshCw size={18} aria-hidden='true' />
        </button>
      </div>

      {exportError ? <p className={styles.inlineError} role='alert'>{exportError}</p> : null}

      <div className={styles.list}>
        {items.map((deal) => (
          <Link key={deal.id} href={`/platform-v7/deals/${encodeURIComponent(deal.id)}/execution`} className={styles.dealCard}>
            <div className={styles.dealMain}>
              <span className={styles.dealIdentity}><Wheat size={15} aria-hidden='true' /> {dealTitle(deal)}</span>
              <strong>{deal.culture || 'Зерно'}{deal.cropClass ? ` · ${deal.cropClass} класс` : ''}</strong>
              <span>{deal.region || 'Регион не указан'} · {formatMoney(deal.moneyImpactKopecks, deal.totalKopecks, deal.currency)}</span>
            </div>
            <div className={styles.dealState}>
              <div className={styles.stateBadges}>
                <span className={styles.status}>{humanStatus(deal.status)}</span>
                <span className={styles.priorityBadge} data-priority={deal.priorityReason}>{priorityLabel(deal.priorityReason)}</span>
              </div>
              <strong>{deal.nextAction || 'Сейчас действие не требуется'}</strong>
              <div className={styles.dealMeta}>
                <small>{deal.deadlineAt ? `Срок: ${formatDateTime(deal.deadlineAt, 'не указан')}` : 'Срок не установлен'}</small>
                <small>Обновлена {formatDateTime(deal.updatedAt, 'время не указано')}</small>
              </div>
            </div>
            <span className={styles.openAction}>Открыть <ArrowRight size={18} aria-hidden='true' /></span>
          </Link>
        ))}
      </div>

      <footer className={styles.registryFooter}>
        {loadMoreError ? (
          <div className={styles.loadMoreFailure} role='alert'>
            <span>{loadMoreError}</span>
            <button
              className={styles.secondaryButton}
              type='button'
              disabled={loadingMore || !nextCursor}
              onClick={() => void load('more', nextCursor)}
            >
              Повторить загрузку
            </button>
          </div>
        ) : canLoadMore ? (
          <button
            className={styles.primaryButton}
            type='button'
            disabled={loadingMore}
            onClick={() => void load('more', nextCursor)}
          >
            {loadingMore ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : null}
            {loadingMore ? 'Загружаем…' : 'Показать ещё сделки'}
          </button>
        ) : (
          <p>Показаны все доступные сделки по выбранному сервером порядку.</p>
        )}
      </footer>
    </section>
  );
}
