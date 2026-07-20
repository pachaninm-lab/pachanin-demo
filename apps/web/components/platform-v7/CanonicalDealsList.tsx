'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
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
import { Button, InlineNotice, StatusChip, Surface } from '@pc/design-system-v8';
import styles from './CanonicalDealsList.module.css';

const PAGE_LIMIT = 20;

type Locale = 'ru' | 'en' | 'zh';
type Tone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';

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

type RegistryCopy = {
  loadingTitle: string;
  loadingBody: string;
  unavailableTitle: string;
  retry: string;
  accessDenied: string;
  loadFailed: string;
  invalidPayload: string;
  timeout: string;
  offline: string;
  emptyTitle: string;
  emptyBody: string;
  accessConfirmed: string;
  registryTitle: string;
  registryBody: string;
  loadedDeals: string;
  requiresAction: (count: number) => string;
  noNewActions: string;
  exportLoading: string;
  exportButton: string;
  refreshLabel: string;
  exportError: string;
  grain: string;
  cropClass: string;
  regionMissing: string;
  amountMissing: string;
  noAction: string;
  deadline: string;
  deadlineMissing: string;
  updated: string;
  timeMissing: string;
  open: string;
  loadMoreRetry: string;
  loadingMore: string;
  loadMore: string;
  allShown: string;
  sheetName: string;
  filePrefix: string;
  exportHeaders: {
    deal: string;
    culture: string;
    cropClass: string;
    region: string;
    status: string;
    priority: string;
    nextAction: string;
    deadline: string;
    amount: string;
    currency: string;
    updated: string;
  };
};

const COPY: Record<Locale, RegistryCopy> = {
  ru: {
    loadingTitle: 'Загружаем ваши сделки',
    loadingBody: 'Список формирует сервер с учётом участия и полномочий.',
    unavailableTitle: 'Реестр временно недоступен',
    retry: 'Повторить',
    accessDenied: 'Доступ к реестру сделок не подтверждён. Войдите под рабочей учётной записью и повторите.',
    loadFailed: 'Не удалось загрузить реестр сделок. Проверьте соединение и повторите.',
    invalidPayload: 'Сервер вернул некорректный реестр сделок. Повторите позже.',
    timeout: 'Сервер не ответил вовремя. Повторите загрузку.',
    offline: 'Нет связи с сервером. Реестр не был заменён локальными данными.',
    emptyTitle: 'Активных сделок пока нет',
    emptyBody: 'Сделка появится здесь только после подтверждения вашего участия сервером.',
    accessConfirmed: 'Доступ подтверждён сервером',
    registryTitle: 'Все показанные сделки',
    registryBody: 'Сначала показаны сделки с наибольшим операционным и денежным влиянием. Реестр продолжает выборку по серверному курсору.',
    loadedDeals: 'загружено сделок',
    requiresAction: (count) => `${count} требуют действия`,
    noNewActions: 'новых действий нет',
    exportLoading: 'Формируем Excel…',
    exportButton: 'Скачать показанные сделки',
    refreshLabel: 'Обновить реестр сделок',
    exportError: 'Не удалось сформировать Excel. Повторите действие.',
    grain: 'Зерно',
    cropClass: 'класс',
    regionMissing: 'Регион не указан',
    amountMissing: 'Сумма не указана',
    noAction: 'Сейчас действие не требуется',
    deadline: 'Срок',
    deadlineMissing: 'Срок не установлен',
    updated: 'Обновлена',
    timeMissing: 'время не указано',
    open: 'Открыть',
    loadMoreRetry: 'Повторить загрузку',
    loadingMore: 'Загружаем…',
    loadMore: 'Показать ещё сделки',
    allShown: 'Показаны все доступные сделки по выбранному сервером порядку.',
    sheetName: 'Сделки',
    filePrefix: 'прозрачная-цена-сделки',
    exportHeaders: {
      deal: 'Сделка', culture: 'Культура', cropClass: 'Класс', region: 'Регион', status: 'Статус',
      priority: 'Причина приоритета', nextAction: 'Следующий шаг', deadline: 'Срок', amount: 'Сумма',
      currency: 'Валюта', updated: 'Обновлена',
    },
  },
  en: {
    loadingTitle: 'Loading your deals',
    loadingBody: 'The server builds the list from confirmed participation and permissions.',
    unavailableTitle: 'The registry is temporarily unavailable',
    retry: 'Try again',
    accessDenied: 'Access to deals is not confirmed. Sign in again.',
    loadFailed: 'Could not load the deal registry.',
    invalidPayload: 'The server returned an invalid deal registry.',
    timeout: 'The server did not respond in time. Try again.',
    offline: 'The server is unreachable. The registry was not replaced with local data.',
    emptyTitle: 'No active deals yet',
    emptyBody: 'A deal will appear only after the server confirms your participation.',
    accessConfirmed: 'Access confirmed by the server',
    registryTitle: 'All displayed deals',
    registryBody: 'Deals with the highest operational and monetary impact are shown first. The registry continues through a server-issued cursor.',
    loadedDeals: 'deals loaded',
    requiresAction: (count) => `${count} require action`,
    noNewActions: 'no new actions',
    exportLoading: 'Preparing Excel…',
    exportButton: 'Download displayed deals',
    refreshLabel: 'Refresh deal registry',
    exportError: 'Could not create the Excel file. Try again.',
    grain: 'Grain',
    cropClass: 'class',
    regionMissing: 'Region not specified',
    amountMissing: 'Amount not specified',
    noAction: 'No action is required now',
    deadline: 'Deadline',
    deadlineMissing: 'No deadline',
    updated: 'Updated',
    timeMissing: 'time not specified',
    open: 'Open',
    loadMoreRetry: 'Retry loading',
    loadingMore: 'Loading…',
    loadMore: 'Show more deals',
    allShown: 'All accessible deals are shown in the server-defined order.',
    sheetName: 'Deals',
    filePrefix: 'transparent-price-deals',
    exportHeaders: {
      deal: 'Deal', culture: 'Commodity', cropClass: 'Class', region: 'Region', status: 'Status',
      priority: 'Priority reason', nextAction: 'Next step', deadline: 'Deadline', amount: 'Amount',
      currency: 'Currency', updated: 'Updated',
    },
  },
  zh: {
    loadingTitle: '正在加载你的交易',
    loadingBody: '服务器根据已确认的参与关系和权限生成列表。',
    unavailableTitle: '交易登记暂时不可用',
    retry: '重试',
    accessDenied: '交易访问权限未确认，请重新登录。',
    loadFailed: '无法加载交易登记。',
    invalidPayload: '服务器返回了无效的交易登记。',
    timeout: '服务器响应超时，请重试。',
    offline: '无法连接服务器，登记未被本地数据替代。',
    emptyTitle: '暂无进行中的交易',
    emptyBody: '服务器确认你的参与关系后，交易才会显示在这里。',
    accessConfirmed: '服务器已确认访问权限',
    registryTitle: '当前显示的全部交易',
    registryBody: '运营和资金影响最大的交易优先显示，后续数据通过服务器游标继续加载。',
    loadedDeals: '已加载交易',
    requiresAction: (count) => `${count} 笔需要操作`,
    noNewActions: '没有新操作',
    exportLoading: '正在生成 Excel…',
    exportButton: '下载当前交易',
    refreshLabel: '刷新交易登记',
    exportError: '无法生成 Excel，请重试。',
    grain: '粮食',
    cropClass: '等级',
    regionMissing: '未指定地区',
    amountMissing: '未指定金额',
    noAction: '当前无需操作',
    deadline: '期限',
    deadlineMissing: '未设置期限',
    updated: '更新时间',
    timeMissing: '未指定时间',
    open: '打开',
    loadMoreRetry: '重新加载',
    loadingMore: '正在加载…',
    loadMore: '显示更多交易',
    allShown: '已按服务器确定的顺序显示全部可访问交易。',
    sheetName: '交易',
    filePrefix: 'transparent-price-deals',
    exportHeaders: {
      deal: '交易', culture: '品种', cropClass: '等级', region: '地区', status: '状态',
      priority: '优先原因', nextAction: '下一步', deadline: '期限', amount: '金额',
      currency: '币种', updated: '更新时间',
    },
  },
};

const STATUS_LABELS: Record<Locale, Record<string, string>> = {
  ru: {
    CREATED: 'Создана', DRAFT: 'Черновик', ADMISSION_APPROVED: 'Допуск подтверждён', AUCTION_OPEN: 'Идут торги',
    AUCTION_WON: 'Победитель выбран', CONTRACT_SIGNED: 'Договор подписан', RESERVE_REQUESTED: 'Запрошен резерв',
    RESERVED: 'Деньги зарезервированы', LOGISTICS_ASSIGNED: 'Перевозка назначена', LOADED: 'Погрузка подтверждена',
    IN_TRANSIT: 'Груз в пути', ARRIVED: 'Груз прибыл', WEIGHED: 'Вес подтверждён', INSPECTION_CONFIRMED: 'Осмотр подтверждён',
    QUALITY_ACCEPTED: 'Качество принято', DELIVERY_ACCEPTED: 'Поставка принята', DOCUMENTS_COMPLETE: 'Документы готовы',
    RELEASE_REQUESTED: 'Запрошена выплата', RELEASED: 'Выплата подтверждена', DISPUTE: 'Открыт спор',
    COMPLETED: 'Завершена', CLOSED: 'Закрыта', CANCELLED: 'Отменена',
  },
  en: {
    CREATED: 'Created', DRAFT: 'Draft', ADMISSION_APPROVED: 'Admission approved', AUCTION_OPEN: 'Auction open',
    AUCTION_WON: 'Winner selected', CONTRACT_SIGNED: 'Contract signed', RESERVE_REQUESTED: 'Reserve requested',
    RESERVED: 'Funds reserved', LOGISTICS_ASSIGNED: 'Logistics assigned', LOADED: 'Loading confirmed',
    IN_TRANSIT: 'In transit', ARRIVED: 'Arrived', WEIGHED: 'Weight confirmed', INSPECTION_CONFIRMED: 'Inspection confirmed',
    QUALITY_ACCEPTED: 'Quality accepted', DELIVERY_ACCEPTED: 'Delivery accepted', DOCUMENTS_COMPLETE: 'Documents complete',
    RELEASE_REQUESTED: 'Payout requested', RELEASED: 'Payout confirmed', DISPUTE: 'Dispute open',
    COMPLETED: 'Completed', CLOSED: 'Closed', CANCELLED: 'Cancelled',
  },
  zh: {
    CREATED: '已创建', DRAFT: '草稿', ADMISSION_APPROVED: '准入已确认', AUCTION_OPEN: '竞价进行中',
    AUCTION_WON: '已选定中标方', CONTRACT_SIGNED: '合同已签署', RESERVE_REQUESTED: '已申请资金预留',
    RESERVED: '资金已预留', LOGISTICS_ASSIGNED: '运输已安排', LOADED: '装货已确认',
    IN_TRANSIT: '运输中', ARRIVED: '已到达', WEIGHED: '重量已确认', INSPECTION_CONFIRMED: '检验已确认',
    QUALITY_ACCEPTED: '质量已接受', DELIVERY_ACCEPTED: '交付已接受', DOCUMENTS_COMPLETE: '文件齐全',
    RELEASE_REQUESTED: '已申请付款', RELEASED: '付款已确认', DISPUTE: '争议已开启',
    COMPLETED: '已完成', CLOSED: '已关闭', CANCELLED: '已取消',
  },
};

const PRIORITY_LABELS: Record<Locale, Record<string, string>> = {
  ru: {
    DISPUTE_CONTROL: 'Спор требует контроля', MONEY_CONTROL: 'Деньги требуют контроля', OVERDUE_ACTION: 'Срок нарушен',
    DEADLINE_ACTION: 'Есть срок', ACTION_REQUIRED: 'Нужно действие', RECENT_ACTIVITY: 'Наблюдение', DEFAULT: 'Требует внимания',
  },
  en: {
    DISPUTE_CONTROL: 'Dispute requires control', MONEY_CONTROL: 'Money requires control', OVERDUE_ACTION: 'Overdue',
    DEADLINE_ACTION: 'Deadline set', ACTION_REQUIRED: 'Action required', RECENT_ACTIVITY: 'Monitoring', DEFAULT: 'Needs attention',
  },
  zh: {
    DISPUTE_CONTROL: '争议需要处理', MONEY_CONTROL: '资金需要处理', OVERDUE_ACTION: '已逾期',
    DEADLINE_ACTION: '有期限', ACTION_REQUIRED: '需要操作', RECENT_ACTIVITY: '持续观察', DEFAULT: '需要关注',
  },
};

function normalizeLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function localeTag(locale: Locale): string {
  if (locale === 'en') return 'en-GB';
  if (locale === 'zh') return 'zh-CN';
  return 'ru-RU';
}

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
      id, dealNumber, status, culture, cropClass, region, volumeTons, totalKopecks, moneyImpactKopecks,
      currency, nextAction, deadlineAt, priorityReason, priorityRank, myRole, myAccessLevel, updatedAt,
    });
  }

  return { items, nextCursor, hasMore: envelope.hasMore };
}

function appendUniqueDeals(current: AccessibleDeal[], incoming: AccessibleDeal[]): AccessibleDeal[] {
  const byId = new Map(current.map((deal) => [deal.id, deal]));
  for (const deal of incoming) byId.set(deal.id, deal);
  return [...byId.values()];
}

function humanStatus(value: string, locale: Locale): string {
  return STATUS_LABELS[locale][value] || value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function priorityLabel(value: string, locale: Locale): string {
  return PRIORITY_LABELS[locale][value] || PRIORITY_LABELS[locale].DEFAULT;
}

function priorityTone(value: string): Tone {
  if (value === 'DISPUTE_CONTROL' || value === 'OVERDUE_ACTION') return 'critical';
  if (value === 'MONEY_CONTROL' || value === 'DEADLINE_ACTION') return 'warning';
  if (value === 'ACTION_REQUIRED') return 'information';
  return 'neutral';
}

function formatMoney(exactKopecks: string | null, fallbackKopecks: number | null, currency: string, locale: Locale, missing: string): string {
  if (exactKopecks && /^-?\d+$/.test(exactKopecks)) {
    try {
      return new Intl.NumberFormat(localeTag(locale), {
        style: 'currency',
        currency: currency || 'RUB',
        maximumFractionDigits: 0,
      }).format(BigInt(exactKopecks) / 100n);
    } catch {
      // Fall through to the validated legacy-safe numeric projection.
    }
  }
  if (fallbackKopecks === null || !Number.isFinite(fallbackKopecks)) return missing;
  return new Intl.NumberFormat(localeTag(locale), {
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

function formatDateTime(value: string | null, fallback: string, locale: Locale): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function dealTitle(deal: AccessibleDeal): string {
  return deal.dealNumber || deal.id;
}

async function exportVisibleDeals(items: AccessibleDeal[], copy: RegistryCopy, locale: Locale): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Прозрачная Цена';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(copy.sheetName);
  sheet.columns = [
    { header: copy.exportHeaders.deal, key: 'deal', width: 22 },
    { header: copy.exportHeaders.culture, key: 'culture', width: 20 },
    { header: copy.exportHeaders.cropClass, key: 'cropClass', width: 14 },
    { header: copy.exportHeaders.region, key: 'region', width: 24 },
    { header: copy.exportHeaders.status, key: 'status', width: 24 },
    { header: copy.exportHeaders.priority, key: 'priority', width: 28 },
    { header: copy.exportHeaders.nextAction, key: 'nextAction', width: 36 },
    { header: copy.exportHeaders.deadline, key: 'deadlineAt', width: 20 },
    { header: copy.exportHeaders.amount, key: 'amount', width: 20 },
    { header: copy.exportHeaders.currency, key: 'currency', width: 10 },
    { header: copy.exportHeaders.updated, key: 'updatedAt', width: 20 },
  ];

  for (const deal of items) {
    sheet.addRow({
      deal: dealTitle(deal),
      culture: deal.culture || copy.grain,
      cropClass: deal.cropClass || '',
      region: deal.region || '',
      status: humanStatus(deal.status, locale),
      priority: priorityLabel(deal.priorityReason, locale),
      nextAction: deal.nextAction || copy.noAction,
      deadlineAt: deal.deadlineAt ? new Date(deal.deadlineAt) : null,
      amount: exportMoney(deal.moneyImpactKopecks, deal.totalKopecks),
      currency: deal.currency,
      updatedAt: new Date(deal.updatedAt),
    });
  }

  const header = sheet.getRow(1);
  header.font = { bold: true };
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
  anchor.download = `${copy.filePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CanonicalDealsList() {
  const locale = normalizeLocale(useLocale());
  const copy = COPY[locale];
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
        // Never surface raw backend codes (e.g. "unauthenticated") to people —
        // map the status to a plain-language, actionable message instead.
        const message = response.status === 401 || response.status === 403 ? copy.accessDenied : copy.loadFailed;
        if (mode === 'more') setLoadMoreError(message);
        else setState({ kind: 'error', message });
        return;
      }

      const page = parseRegistryPage(payload);
      if (!page) {
        if (mode === 'more') setLoadMoreError(copy.invalidPayload);
        else setState({ kind: 'error', message: copy.invalidPayload });
        return;
      }

      if (mode === 'more') {
        setState((current) => current.kind === 'ready'
          ? { kind: 'ready', items: appendUniqueDeals(current.items, page.items), nextCursor: page.nextCursor, hasMore: page.hasMore }
          : { kind: 'ready', ...page });
      } else {
        setState({ kind: 'ready', ...page });
      }
    } catch (error) {
      if (requestId !== requestRef.current) return;
      const message = error instanceof DOMException && error.name === 'AbortError' ? copy.timeout : copy.offline;
      if (mode === 'more') setLoadMoreError(message);
      else setState({ kind: 'error', message });
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestRef.current) setLoadingMore(false);
    }
  }, [copy]);

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
      await exportVisibleDeals(items, copy, locale);
    } catch {
      setExportError(copy.exportError);
    } finally {
      setExporting(false);
    }
  };

  if (state.kind === 'loading') {
    return (
      <Surface className={styles.stateCard} aria-live='polite' data-transaction-deals-list='v8' data-locale={locale}>
        <Loader2 className={styles.spin} size={26} aria-hidden='true' />
        <h2>{copy.loadingTitle}</h2>
        <p>{copy.loadingBody}</p>
      </Surface>
    );
  }

  if (state.kind === 'error') {
    return (
      <Surface className={styles.stateCard} role='alert' data-transaction-deals-list='v8' data-locale={locale}>
        <AlertTriangle className={styles.errorIcon} size={28} aria-hidden='true' />
        <h2>{copy.unavailableTitle}</h2>
        <p>{state.message}</p>
        <Button variant='secondary' onClick={() => void load('retry')}>
          <RefreshCw size={18} aria-hidden='true' /> {copy.retry}
        </Button>
      </Surface>
    );
  }

  const { items, nextCursor, hasMore } = state;
  const actionableCount = items.filter((deal) => Boolean(deal.nextAction)).length;
  const canLoadMore = hasMore && Boolean(nextCursor);

  if (items.length === 0) {
    return (
      <Surface className={styles.stateCard} data-empty-deals data-transaction-deals-list='v8' data-locale={locale}>
        <CheckCircle2 className={styles.emptyIcon} size={28} aria-hidden='true' />
        <h2>{copy.emptyTitle}</h2>
        <p>{copy.emptyBody}</p>
      </Surface>
    );
  }

  return (
    <Surface className={styles.registry} data-testid='canonical-deals-list' data-transaction-deals-list='v8' data-locale={locale}>
      <header className={styles.registryHeader}>
        <div className={styles.registryTitle}>
          <StatusChip tone='success'><ShieldCheck size={16} aria-hidden='true' /> {copy.accessConfirmed}</StatusChip>
          <h2>{copy.registryTitle}</h2>
          <p>{copy.registryBody}</p>
        </div>
        <Surface className={styles.summary} variant='subtle' padded={false} aria-label={copy.loadedDeals}>
          <strong>{items.length}</strong>
          <span>{copy.loadedDeals}</span>
          <small>{actionableCount ? copy.requiresAction(actionableCount) : copy.noNewActions}</small>
        </Surface>
      </header>

      <div className={styles.toolbar}>
        <Button variant='secondary' disabled={exporting} onClick={() => void handleExport(items)}>
          {exporting ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : <Download size={18} aria-hidden='true' />}
          {exporting ? copy.exportLoading : copy.exportButton}
        </Button>
        <Button className={styles.iconButton} variant='secondary' aria-label={copy.refreshLabel} onClick={() => void load('retry')}>
          <RefreshCw size={18} aria-hidden='true' />
        </Button>
      </div>

      {exportError ? <InlineNotice tone='critical' title={copy.exportError} icon={<AlertTriangle size={18} />} /> : null}

      <div className={styles.list}>
        {items.map((deal) => (
          <Link key={deal.id} href={`/platform-v7/deals/${encodeURIComponent(deal.id)}/execution`} className={styles.dealCard}>
            <div className={styles.dealMain}>
              <span className={styles.dealIdentity}><Wheat size={15} aria-hidden='true' /> {dealTitle(deal)}</span>
              <strong>{deal.culture || copy.grain}{deal.cropClass ? ` · ${deal.cropClass} ${copy.cropClass}` : ''}</strong>
              <span>{deal.region || copy.regionMissing} · {formatMoney(deal.moneyImpactKopecks, deal.totalKopecks, deal.currency, locale, copy.amountMissing)}</span>
            </div>
            <div className={styles.dealState}>
              <div className={styles.stateBadges}>
                <StatusChip tone='neutral'>{humanStatus(deal.status, locale)}</StatusChip>
                <StatusChip className={styles.priorityBadge} tone={priorityTone(deal.priorityReason)} data-priority={deal.priorityReason}>
                  {priorityLabel(deal.priorityReason, locale)}
                </StatusChip>
              </div>
              <strong>{deal.nextAction || copy.noAction}</strong>
              <div className={styles.dealMeta}>
                <small>{deal.deadlineAt ? `${copy.deadline}: ${formatDateTime(deal.deadlineAt, copy.timeMissing, locale)}` : copy.deadlineMissing}</small>
                <small>{copy.updated} {formatDateTime(deal.updatedAt, copy.timeMissing, locale)}</small>
              </div>
            </div>
            <span className={styles.openAction}>{copy.open} <ArrowRight size={18} aria-hidden='true' /></span>
          </Link>
        ))}
      </div>

      <footer className={styles.registryFooter}>
        {loadMoreError ? (
          <div className={styles.loadMoreFailure}>
            <InlineNotice tone='critical' title={copy.loadFailed} icon={<AlertTriangle size={18} />}>{loadMoreError}</InlineNotice>
            <Button variant='secondary' disabled={loadingMore || !nextCursor} onClick={() => void load('more', nextCursor)}>
              {copy.loadMoreRetry}
            </Button>
          </div>
        ) : canLoadMore ? (
          <Button disabled={loadingMore} onClick={() => void load('more', nextCursor)}>
            {loadingMore ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : null}
            {loadingMore ? copy.loadingMore : copy.loadMore}
          </Button>
        ) : (
          <p>{copy.allShown}</p>
        )}
      </footer>
    </Surface>
  );
}
