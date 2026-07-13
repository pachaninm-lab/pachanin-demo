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

const INITIAL_LIMIT = 20;
const LIMIT_STEP = 20;
const MAX_LIMIT = 100;

type AccessibleDeal = {
  id: string;
  dealNumber: string | null;
  status: string;
  culture: string | null;
  cropClass: string | null;
  region: string | null;
  volumeTons: string | null;
  totalKopecks: number | null;
  currency: string;
  nextAction: string | null;
  myRole: string;
  updatedAt: string;
};

type RegistryState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AccessibleDeal[]; limit: number }
  | { kind: 'error'; message: string; limit: number };

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || null;
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseDeals(payload: unknown): AccessibleDeal[] | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) return null;

  const result: AccessibleDeal[] = [];
  for (const item of (payload as { items: unknown[] }).items) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;

    const id = requiredString(row.id);
    const status = requiredString(row.status);
    const currency = requiredString(row.currency) || 'RUB';
    const myRole = requiredString(row.myRole);
    const updatedAt = requiredString(row.updatedAt);
    const dealNumber = optionalString(row.dealNumber);
    const culture = optionalString(row.culture);
    const cropClass = optionalString(row.cropClass);
    const region = optionalString(row.region);
    const volumeTons = optionalString(row.volumeTons);
    const nextAction = optionalString(row.nextAction);
    const totalKopecks = row.totalKopecks === null || row.totalKopecks === undefined
      ? null
      : typeof row.totalKopecks === 'number' && Number.isFinite(row.totalKopecks)
        ? row.totalKopecks
        : undefined;

    if (
      !id || !status || !myRole || !updatedAt
      || dealNumber === undefined || culture === undefined || cropClass === undefined
      || region === undefined || volumeTons === undefined || nextAction === undefined
      || totalKopecks === undefined
    ) return null;

    result.push({
      id,
      dealNumber,
      status,
      culture,
      cropClass,
      region,
      volumeTons,
      totalKopecks,
      currency,
      nextAction,
      myRole,
      updatedAt,
    });
  }

  return result;
}

function humanStatus(value: string): string {
  const known: Record<string, string> = {
    CREATED: 'Создана',
    ACTIVE: 'В работе',
    IN_PROGRESS: 'В работе',
    IN_TRANSIT: 'Груз в пути',
    ACCEPTANCE: 'Приёмка',
    LABORATORY: 'Проверка качества',
    DOCUMENTS: 'Документы',
    PAYMENT: 'Расчёты',
    DISPUTE: 'Открыт спор',
    COMPLETED: 'Завершена',
    CLOSED: 'Закрыта',
    CANCELLED: 'Отменена',
  };
  return known[value] || value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function formatMoney(kopecks: number | null, currency: string): string {
  if (kopecks === null || !Number.isFinite(kopecks)) return 'Сумма не указана';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency || 'RUB',
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'время не указано';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
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
    { header: 'Статус', key: 'status', width: 22 },
    { header: 'Следующий шаг', key: 'nextAction', width: 36 },
    { header: 'Сумма', key: 'amount', width: 18 },
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
      nextAction: deal.nextAction || 'Действие не требуется',
      amount: deal.totalKopecks === null ? null : deal.totalKopecks / 100,
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
  sheet.getColumn('updatedAt').numFmt = 'dd.mm.yyyy hh:mm';
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'I1' };

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
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState('');
  const requestRef = React.useRef(0);

  const load = React.useCallback(async (limit: number, mode: 'initial' | 'more' | 'retry' = 'initial') => {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), INITIAL_LIMIT), MAX_LIMIT);
    const requestId = ++requestRef.current;
    if (mode === 'more') setLoadingMore(true);
    else setState({ kind: 'loading' });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(`/api/proxy/deals/accessible?limit=${boundedLimit}`, {
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
        setState({ kind: 'error', message, limit: boundedLimit });
        return;
      }

      const items = parseDeals(payload);
      if (!items) {
        setState({ kind: 'error', message: 'Сервер вернул некорректный реестр сделок.', limit: boundedLimit });
        return;
      }

      setState({ kind: 'ready', items, limit: boundedLimit });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState({
        kind: 'error',
        limit: boundedLimit,
        message: error instanceof DOMException && error.name === 'AbortError'
          ? 'Сервер не ответил вовремя. Повтори загрузку.'
          : 'Нет связи с сервером. Реестр не был заменён локальными данными.',
      });
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestRef.current) setLoadingMore(false);
    }
  }, []);

  React.useEffect(() => {
    void load(INITIAL_LIMIT);
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
        <button className={styles.primaryButton} type='button' onClick={() => void load(state.limit, 'retry')}>
          <RefreshCw size={18} aria-hidden='true' /> Повторить
        </button>
      </section>
    );
  }

  const { items, limit } = state;
  const actionableCount = items.filter((deal) => Boolean(deal.nextAction)).length;
  const canLoadMore = items.length === limit && limit < MAX_LIMIT;
  const reachedMaximum = items.length === MAX_LIMIT && limit === MAX_LIMIT;

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
          <p>Открывай сделку по следующему действию. Технические идентификаторы и внутренние сценарии не подменяют реальные данные.</p>
        </div>
        <div className={styles.summary} aria-label='Сводка показанного реестра'>
          <strong>{items.length}</strong>
          <span>показано сделок</span>
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
        <button className={styles.iconButton} type='button' aria-label='Обновить реестр сделок' onClick={() => void load(limit, 'retry')}>
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
              <span>{deal.region || 'Регион не указан'} · {formatMoney(deal.totalKopecks, deal.currency)}</span>
            </div>
            <div className={styles.dealState}>
              <span className={styles.status}>{humanStatus(deal.status)}</span>
              <strong>{deal.nextAction || 'Сейчас действие не требуется'}</strong>
              <small>Обновлена {formatUpdatedAt(deal.updatedAt)}</small>
            </div>
            <span className={styles.openAction}>Открыть <ArrowRight size={18} aria-hidden='true' /></span>
          </Link>
        ))}
      </div>

      <footer className={styles.registryFooter}>
        {canLoadMore ? (
          <button
            className={styles.primaryButton}
            type='button'
            disabled={loadingMore}
            onClick={() => void load(Math.min(limit + LIMIT_STEP, MAX_LIMIT), 'more')}
          >
            {loadingMore ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : null}
            {loadingMore ? 'Загружаем…' : 'Показать ещё сделки'}
          </button>
        ) : (
          <p>{reachedMaximum ? 'Показаны первые 100 сделок. Полный промышленный реестр требует серверной cursor-пагинации.' : 'Показаны все сделки, возвращённые сервером.'}</p>
        )}
      </footer>
    </section>
  );
}
