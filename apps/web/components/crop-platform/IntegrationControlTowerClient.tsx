'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Link2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { Button, InlineNotice, StatusChip, Surface } from '@pc/design-system-v8';
import {
  collectIntegrationControlTowerPages,
  parseIntegrationControlTowerRecord,
  type IntegrationControlTowerLocale,
  type IntegrationControlTowerRecord,
  type IntegrationHonestStatus,
} from './integration-control-tower-live-adapter';
import styles from './IntegrationControlTowerClient.module.css';

type StablePhase = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict' | 'stale';
type LiveState = StablePhase | 'reconnecting' | 'degraded';
type JsonRecord = Record<string, unknown>;

type ClientState = Readonly<{
  phase: StablePhase;
  records: IntegrationControlTowerRecord[];
  selectedAdapterCode: string;
  message: string;
}>;

type PendingAction = Readonly<{
  adapterCode: string;
  action: 'REDRIVE' | 'RECONCILE';
  entryId: string | null;
  ifMatch: string;
  reason: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
}>;

type Copy = Readonly<{
  eyebrow: string;
  title: string;
  lead: string;
  evidenceBoundary: string;
  loading: string;
  empty: string;
  forbidden: string;
  error: string;
  conflict: string;
  stale: string;
  reconnecting: string;
  degraded: string;
  retry: string;
  search: string;
  searchPlaceholder: string;
  status: string;
  all: string;
  adapters: string;
  freshness: string;
  inbox: string;
  retries: string;
  quarantine: string;
  dead: string;
  conflicts: string;
  lastSuccess: string;
  lastError: string;
  reconciliation: string;
  environment: string;
  versions: string;
  recentEvents: string;
  noEvents: string;
  event: string;
  received: string;
  attempts: string;
  providerAck: string;
  businessAcceptance: string;
  notAvailable: string;
  primaryAction: string;
  serverAuthority: string;
  actionTitle: string;
  reason: string;
  reasonPlaceholder: string;
  cancel: string;
  confirm: string;
  executing: string;
  receipt: string;
  credentialBoundary: string;
}>;

const COPY: Record<IntegrationControlTowerLocale, Copy> = {
  ru: {
    eyebrow: 'Операционный контур интеграций',
    title: 'Integration Control Tower',
    lead: 'Единый приватный обзор входящих регуляторных событий, ошибок, очередей, подтверждений и сверок в границах организации.',
    evidenceBoundary: 'Статусы строятся только из PostgreSQL inbox, audit и outbox. Наличие кода, теста или адаптера не означает подтверждённую live-интеграцию.',
    loading: 'Загружаем серверный реестр интеграций…',
    empty: 'В текущем tenant/org ещё нет подтверждённых сервером integration facts.',
    forbidden: 'Сервер не подтвердил доступ к Integration Control Tower.',
    error: 'Не удалось загрузить реестр интеграций.',
    conflict: 'Версия интеграции изменилась. Данные будут перечитаны с сервера.',
    stale: 'Сервер отклонил устаревшую версию. Локальные данные не используются.',
    reconnecting: 'Восстанавливаем связь и повторно сверяем server authority…',
    degraded: 'Есть ошибки, retry, quarantine, dead-letter или конфликт хеша. Требуется проверка.',
    retry: 'Обновить',
    search: 'Поиск',
    searchPlaceholder: 'Код адаптера или провайдер',
    status: 'Статус',
    all: 'Все',
    adapters: 'Адаптеры',
    freshness: 'Актуальность',
    inbox: 'Очередь',
    retries: 'Retry',
    quarantine: 'Карантин',
    dead: 'Dead',
    conflicts: 'Конфликты',
    lastSuccess: 'Последний успех',
    lastError: 'Последняя ошибка',
    reconciliation: 'Сверка',
    environment: 'Контур',
    versions: 'Версии схемы / mapping',
    recentEvents: 'Последние события',
    noEvents: 'События не найдены.',
    event: 'Событие',
    received: 'Получено',
    attempts: 'Попытки',
    providerAck: 'ACK провайдера',
    businessAcceptance: 'Бизнес-принятие',
    notAvailable: 'нет',
    primaryAction: 'Следующее управляемое действие',
    serverAuthority: 'Действие, роль, tenant и organization определяются сервером.',
    actionTitle: 'Подтверждение управляемого действия',
    reason: 'Основание',
    reasonPlaceholder: 'Укажите проверяемое операционное или нормативное основание…',
    cancel: 'Отмена',
    confirm: 'Подтвердить на сервере',
    executing: 'Фиксируем команду…',
    receipt: 'Команда зафиксирована сервером; данные перечитаны из authority.',
    credentialBoundary: 'Срок reference на credential не показывается: в принятом authority нет безопасной metadata-записи. Секреты и key references не выводятся.',
  },
  en: {
    eyebrow: 'Integration operations', title: 'Integration Control Tower',
    lead: 'A private organization-scoped view of regulatory events, failures, queues, acknowledgements and reconciliation.',
    evidenceBoundary: 'Statuses come only from PostgreSQL inbox, audit and outbox facts. Code or tests never imply a confirmed live integration.',
    loading: 'Loading the server integration registry…', empty: 'No server-confirmed integration facts exist in this tenant/org.',
    forbidden: 'The server did not confirm access to Integration Control Tower.', error: 'Could not load the integration registry.',
    conflict: 'The integration version changed. Server data will be reloaded.', stale: 'The server rejected a stale version. No local data is used.',
    reconnecting: 'Restoring connectivity and reconciling server authority…', degraded: 'Errors, retry, quarantine, dead-letter or hash conflicts require review.',
    retry: 'Refresh', search: 'Search', searchPlaceholder: 'Adapter code or provider', status: 'Status', all: 'All', adapters: 'Adapters',
    freshness: 'Freshness', inbox: 'Inbox', retries: 'Retry', quarantine: 'Quarantine', dead: 'Dead', conflicts: 'Conflicts',
    lastSuccess: 'Last success', lastError: 'Last error', reconciliation: 'Reconciliation', environment: 'Environment',
    versions: 'Schema / mapping versions', recentEvents: 'Recent events', noEvents: 'No events found.', event: 'Event', received: 'Received',
    attempts: 'Attempts', providerAck: 'Provider ACK', businessAcceptance: 'Business acceptance', notAvailable: 'none',
    primaryAction: 'Next governed action', serverAuthority: 'Action, role, tenant and organization are server-derived.',
    actionTitle: 'Governed action confirmation', reason: 'Reason', reasonPlaceholder: 'Enter a verifiable operational or regulatory reason…',
    cancel: 'Cancel', confirm: 'Confirm on server', executing: 'Committing command…', receipt: 'The server committed the command and authority was reloaded.',
    credentialBoundary: 'Credential reference expiry is not displayed because no safe metadata authority exists. Secrets and key references are never rendered.',
  },
  zh: {
    eyebrow: '集成运营控制', title: 'Integration Control Tower',
    lead: '按组织隔离查看监管事件、故障、队列、确认与核对状态。',
    evidenceBoundary: '状态仅来自 PostgreSQL inbox、audit 和 outbox。代码或测试不代表已确认的生产连接。',
    loading: '正在加载服务器集成登记…', empty: '当前 tenant/org 没有服务器确认的集成事实。', forbidden: '服务器未确认访问权限。',
    error: '无法加载集成登记。', conflict: '集成版本已变化，将重新读取服务器数据。', stale: '服务器拒绝了过期版本，不使用本地数据。',
    reconnecting: '正在恢复连接并核对服务器权威数据…', degraded: '存在错误、重试、隔离、死信或哈希冲突，需要检查。',
    retry: '刷新', search: '搜索', searchPlaceholder: '适配器代码或提供方', status: '状态', all: '全部', adapters: '适配器',
    freshness: '更新时间', inbox: '队列', retries: '重试', quarantine: '隔离', dead: '死信', conflicts: '冲突', lastSuccess: '最近成功',
    lastError: '最近错误', reconciliation: '核对', environment: '环境', versions: 'Schema / mapping 版本', recentEvents: '最近事件', noEvents: '未找到事件。',
    event: '事件', received: '接收时间', attempts: '尝试次数', providerAck: '提供方 ACK', businessAcceptance: '业务接受', notAvailable: '无',
    primaryAction: '下一项受控操作', serverAuthority: '操作、角色、tenant 和 organization 均由服务器确定。', actionTitle: '确认受控操作',
    reason: '依据', reasonPlaceholder: '请输入可核验的运营或法规依据…', cancel: '取消', confirm: '在服务器确认', executing: '正在提交命令…',
    receipt: '服务器已记录命令并重新加载权威数据。', credentialBoundary: '没有安全的 credential metadata authority，因此不显示 reference 到期时间；绝不显示密钥或 secret。',
  },
};

const STATUS_LABELS: Record<IntegrationControlTowerLocale, Record<IntegrationHonestStatus, string>> = {
  ru: { CONFIRMED_LIVE: 'Подтверждено live', TEST: 'Тестовый контур', ADAPTER_READY: 'Адаптер готов', MANUAL: 'Ручной режим', UNAVAILABLE: 'Недоступно', DEGRADED: 'Деградация', REVOKED: 'Отозвано' },
  en: { CONFIRMED_LIVE: 'Confirmed live', TEST: 'Test', ADAPTER_READY: 'Adapter ready', MANUAL: 'Manual', UNAVAILABLE: 'Unavailable', DEGRADED: 'Degraded', REVOKED: 'Revoked' },
  zh: { CONFIRMED_LIVE: '已确认生产', TEST: '测试', ADAPTER_READY: '适配器就绪', MANUAL: '人工', UNAVAILABLE: '不可用', DEGRADED: '降级', REVOKED: '已撤销' },
};

function normalizeLocale(value: string): IntegrationControlTowerLocale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function statusTone(status: IntegrationHonestStatus): 'neutral' | 'success' | 'warning' | 'critical' | 'information' {
  if (status === 'CONFIRMED_LIVE') return 'success';
  if (status === 'TEST' || status === 'ADAPTER_READY') return 'information';
  if (status === 'DEGRADED' || status === 'REVOKED') return 'critical';
  if (status === 'MANUAL') return 'warning';
  return 'neutral';
}

function formatDate(value: string | null, locale: IntegrationControlTowerLocale, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

function payloadMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const source = payload as JsonRecord;
  if (typeof source.message === 'string' && source.message.trim()) return source.message.trim();
  if (typeof source.code === 'string' && source.code.trim()) return source.code.trim();
  return null;
}

function responsePhase(status: number): StablePhase {
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status === 412 || status === 428) return 'stale';
  return 'error';
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function staffAwareGet(path: string, signal: AbortSignal): Promise<Response> {
  const staff = await fetch(`/api/staff/integration-control-tower${path}`, {
    cache: 'no-store', headers: { Accept: 'application/json' }, signal,
  });
  if (staff.status !== 401 && staff.status !== 403) return staff;
  return fetch(`/api/platform-v7/integrations${path}`, {
    cache: 'no-store', headers: { Accept: 'application/json' }, signal,
  });
}

function commandToken(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function IntegrationControlTowerClient({
  locale: localeInput,
  csrfToken,
  initialAdapterCode = '',
}: Readonly<{ locale: string; csrfToken: string; initialAdapterCode?: string }>) {
  const locale = normalizeLocale(localeInput);
  const copy = COPY[locale];
  const requestSequence = React.useRef(0);
  const [liveState, setLiveState] = React.useState<LiveState>('loading');
  const [state, setState] = React.useState<ClientState>({
    phase: 'loading', records: [], selectedAdapterCode: initialAdapterCode, message: '',
  });
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<IntegrationHonestStatus | 'ALL'>('ALL');
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [executing, setExecuting] = React.useState(false);
  const [receipt, setReceipt] = React.useState('');

  const loadDetail = React.useCallback(async (
    adapterCode: string,
    records: readonly IntegrationControlTowerRecord[],
    signal: AbortSignal,
  ): Promise<IntegrationControlTowerRecord[] | null> => {
    const response = await staffAwareGet(`/${encodeURIComponent(adapterCode)}?eventLimit=50`, signal);
    const payload = await readJson(response);
    if (!response.ok) {
      const error = new Error(payloadMessage(payload) ?? copy.error) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    const detail = parseIntegrationControlTowerRecord(payload, locale);
    if (!detail || detail.adapterCode !== adapterCode) return null;
    return records.map((item) => item.adapterCode === adapterCode ? detail : item);
  }, [copy.error, locale]);

  const load = React.useCallback(async (mode: 'initial' | 'retry' | 'reconnect' = 'initial') => {
    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
    if (mode === 'reconnect') setLiveState('reconnecting');
    else {
      setLiveState('loading');
      setState((current) => ({ ...current, phase: 'loading', message: '' }));
    }
    try {
      let records = await collectIntegrationControlTowerPages(async (cursor) => {
        const path = cursor === null ? '?limit=100' : `?limit=100&cursor=${encodeURIComponent(cursor)}`;
        const response = await staffAwareGet(path, controller.signal);
        const payload = await readJson(response);
        if (!response.ok) {
          const error = new Error(payloadMessage(payload) ?? copy.error) as Error & { status?: number };
          error.status = response.status;
          throw error;
        }
        return payload;
      }, locale);
      if (requestId !== requestSequence.current) return;
      if (!records) throw new Error(copy.error);
      if (records.length === 0) {
        setLiveState('empty');
        setState({ phase: 'empty', records: [], selectedAdapterCode: '', message: '' });
        return;
      }
      const selectedAdapterCode = initialAdapterCode && records.some((item) => item.adapterCode === initialAdapterCode)
        ? initialAdapterCode
        : records[0]!.adapterCode;
      records = await loadDetail(selectedAdapterCode, records, controller.signal);
      if (!records) throw new Error(copy.error);
      const selected = records.find((item) => item.adapterCode === selectedAdapterCode)!;
      setLiveState(selected.honestStatus === 'DEGRADED' ? 'degraded' : 'ready');
      setState({ phase: 'ready', records, selectedAdapterCode, message: '' });
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      const status = typeof error === 'object' && error && 'status' in error
        ? Number((error as { status?: unknown }).status) : 0;
      const phase = status ? responsePhase(status) : 'error';
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? copy.error
        : status === 401 || status === 403
          ? copy.forbidden
          : status === 409
            ? copy.conflict
            : status === 412 || status === 428
              ? copy.stale
              : navigator.onLine
                ? (error instanceof Error && error.message ? error.message : copy.error)
                : copy.reconnecting;
      setLiveState(phase);
      setState((current) => ({
        phase, records: mode === 'reconnect' ? current.records : [],
        selectedAdapterCode: current.selectedAdapterCode, message,
      }));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [copy, initialAdapterCode, loadDetail, locale]);

  React.useEffect(() => { void load('initial'); }, [load]);
  React.useEffect(() => {
    const reconnect = () => { void load('reconnect'); };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [load]);

  const selectAdapter = React.useCallback(async (adapterCode: string) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
    setLiveState('reconnecting');
    setState((current) => ({ ...current, selectedAdapterCode: adapterCode, message: '' }));
    try {
      const records = await loadDetail(adapterCode, state.records, controller.signal);
      if (!records) throw new Error(copy.error);
      const selected = records.find((item) => item.adapterCode === adapterCode)!;
      setState({ phase: 'ready', records, selectedAdapterCode: adapterCode, message: '' });
      setLiveState(selected.honestStatus === 'DEGRADED' ? 'degraded' : 'ready');
    } catch (error) {
      setState((current) => ({ ...current, phase: 'error', message: error instanceof Error ? error.message : copy.error }));
      setLiveState('error');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [copy.error, loadDetail, state.records]);

  const selected = state.records.find((item) => item.adapterCode === state.selectedAdapterCode) ?? state.records[0];
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return state.records.filter((item) => {
      if (statusFilter !== 'ALL' && item.honestStatus !== statusFilter) return false;
      if (!needle) return true;
      return `${item.adapterCode} ${item.provider}`.toLocaleLowerCase(locale).includes(needle);
    });
  }, [locale, query, state.records, statusFilter]);

  const prepareAction = () => {
    if (!selected) return;
    const action = selected.primaryAction;
    const eventVersion = action.entryId
      ? selected.recentEvents.find((event) => event.id === action.entryId)?.version
      : null;
    setPending({
      adapterCode: selected.adapterCode,
      action: action.id,
      entryId: action.entryId,
      ifMatch: action.id === 'REDRIVE' ? (eventVersion ?? '') : selected.aggregateVersion,
      reason: '',
      commandId: commandToken('integration-command'),
      idempotencyKey: commandToken('integration-idempotency'),
      correlationId: commandToken('integration-correlation'),
    });
    setReceipt('');
  };

  const execute = async () => {
    if (!pending || pending.reason.trim().length < 12 || !pending.ifMatch) return;
    setExecuting(true);
    try {
      const path = pending.action === 'REDRIVE'
        ? `/api/staff/integrations/inbox/${encodeURIComponent(pending.entryId || '')}/commands/redrive`
        : `/api/staff/integrations/${encodeURIComponent(pending.adapterCode)}/commands/reconcile`;
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-Token': csrfToken,
          'If-Match': `"${pending.ifMatch}"`,
          'X-Correlation-Id': pending.correlationId,
        },
        body: JSON.stringify({
          commandId: pending.commandId,
          idempotencyKey: pending.idempotencyKey,
          correlationId: pending.correlationId,
          reason: pending.reason.trim(),
        }),
        cache: 'no-store',
      });
      const payload = await readJson(response);
      if (!response.ok) {
        const phase = responsePhase(response.status);
        setLiveState(phase);
        setState((current) => ({ ...current, phase, message: payloadMessage(payload) ?? copy.error }));
        return;
      }
      setReceipt(copy.receipt);
      setPending(null);
      await load('retry');
    } finally {
      setExecuting(false);
    }
  };

  if (state.phase !== 'ready') {
    const message = state.message || (state.phase === 'loading' ? copy.loading : state.phase === 'empty' ? copy.empty : copy.error);
    return (
      <Surface className={styles.stateSurface} role={state.phase === 'error' || state.phase === 'conflict' ? 'alert' : undefined}>
        {state.phase === 'loading' ? <RefreshCw className={styles.spin} size={28} /> : <AlertTriangle size={30} />}
        <h1>{message}</h1>
        {state.phase !== 'loading' && state.phase !== 'forbidden' && state.phase !== 'empty' ? (
          <Button variant='secondary' onClick={() => void load('retry')}><RefreshCw size={18} />{copy.retry}</Button>
        ) : null}
      </Surface>
    );
  }

  return (
    <section className={styles.root} data-live-state={liveState} data-static-authority-fallback='false' aria-labelledby='integration-control-tower-title'>
      <Surface className={styles.hero}>
        <div>
          <StatusChip tone='information'>{copy.eyebrow}</StatusChip>
          <h1 id='integration-control-tower-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
          <InlineNotice tone='neutral' title={copy.status} icon={<ShieldCheck size={18} />}>
            {copy.evidenceBoundary}
          </InlineNotice>
        </div>
        <dl className={styles.heroFacts}>
          <div><dt>{copy.adapters}</dt><dd>{state.records.length}</dd></div>
          <div><dt>{copy.degraded}</dt><dd>{state.records.filter((item) => item.honestStatus === 'DEGRADED').length}</dd></div>
          <div><dt>{copy.inbox}</dt><dd>{state.records.reduce((sum, item) => sum + item.inboxDepth, 0)}</dd></div>
        </dl>
      </Surface>

      {liveState === 'reconnecting' ? <InlineNotice tone='information' title={copy.reconnecting}>{copy.serverAuthority}</InlineNotice> : null}
      {liveState === 'degraded' ? <InlineNotice tone='critical' title={copy.degraded}>{copy.serverAuthority}</InlineNotice> : null}
      {receipt ? <InlineNotice tone='success' title={copy.primaryAction} icon={<CheckCircle2 size={18} />}>{receipt}</InlineNotice> : null}

      <Surface className={styles.toolbar} variant='subtle'>
        <label><span>{copy.search}</span><input type='search' value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={copy.searchPlaceholder} /></label>
        <label><span>{copy.status}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value as IntegrationHonestStatus | 'ALL')}>
          <option value='ALL'>{copy.all}</option>
          {Object.entries(STATUS_LABELS[locale]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <Button variant='secondary' onClick={() => void load('retry')}><RefreshCw size={18} />{copy.retry}</Button>
      </Surface>

      <div className={styles.workspace}>
        <Surface className={styles.list} padded={false}>
          <header><strong>{copy.adapters}</strong><span>{filtered.length}</span></header>
          <div className={styles.listItems}>
            {filtered.map((item) => (
              <button key={item.adapterCode} type='button' data-selected={item.adapterCode === selected?.adapterCode} onClick={() => void selectAdapter(item.adapterCode)}>
                <span><strong>{item.adapterCode}</strong><small>{item.provider}</small></span>
                <StatusChip tone={statusTone(item.honestStatus)}>{STATUS_LABELS[locale][item.honestStatus]}</StatusChip>
                <span className={styles.listMeta}><span>{copy.inbox}: {item.inboxDepth}</span><span>{formatDate(item.freshnessAt, locale, copy.notAvailable)}</span></span>
              </button>
            ))}
          </div>
        </Surface>

        {selected ? (
          <div className={styles.detail}>
            <Surface className={styles.summary}>
              <div className={styles.summaryHeader}>
                <div><StatusChip tone={statusTone(selected.honestStatus)}>{STATUS_LABELS[locale][selected.honestStatus]}</StatusChip><h2>{selected.adapterCode}</h2><p>{selected.provider}</p></div>
                <Link2 size={28} aria-hidden='true' />
              </div>
              <dl className={styles.metrics}>
                <div><dt>{copy.environment}</dt><dd>{selected.environment}</dd></div>
                <div><dt>{copy.versions}</dt><dd>{selected.schemaVersion} / {selected.mappingVersion}</dd></div>
                <div><dt>{copy.freshness}</dt><dd>{formatDate(selected.freshnessAt, locale, copy.notAvailable)}</dd></div>
                <div><dt>{copy.lastSuccess}</dt><dd>{formatDate(selected.lastSuccessAt, locale, copy.notAvailable)}</dd></div>
                <div><dt>{copy.lastError}</dt><dd>{selected.lastErrorCode || copy.notAvailable}</dd></div>
                <div><dt>{copy.reconciliation}</dt><dd>{selected.reconciliationState}</dd></div>
              </dl>
              <div className={styles.counters}>
                <span>{copy.inbox}<strong>{selected.inboxDepth}</strong></span><span>{copy.retries}<strong>{selected.retryCount}</strong></span>
                <span>{copy.quarantine}<strong>{selected.quarantineCount}</strong></span><span>{copy.dead}<strong>{selected.deadCount}</strong></span>
                <span>{copy.conflicts}<strong>{selected.conflictCount}</strong></span>
              </div>
              <InlineNotice tone='neutral' title={copy.environment} icon={<DatabaseZap size={18} />}>{copy.credentialBoundary}</InlineNotice>
            </Surface>

            <Surface className={styles.actionCard}>
              <div><span>{copy.primaryAction}</span><h3>{selected.primaryAction.label}</h3><p>{selected.primaryAction.reason}</p><small>{copy.serverAuthority}</small></div>
              <Button disabled={!selected.primaryAction.allowed} onClick={prepareAction}>{selected.primaryAction.label}</Button>
            </Surface>

            <Surface className={styles.events} padded={false}>
              <header><strong>{copy.recentEvents}</strong><Clock3 size={18} /></header>
              {selected.recentEvents.length === 0 ? <p className={styles.emptyEvents}>{copy.noEvents}</p> : (
                <div className={styles.eventList}>{selected.recentEvents.map((event) => (
                  <article key={event.id} data-event-state={event.state}>
                    <div><StatusChip tone={event.state === 'PROCESSED' ? 'success' : event.state === 'DEAD' || event.state === 'QUARANTINED' ? 'critical' : event.state === 'RETRY' ? 'warning' : 'neutral'}>{event.state}</StatusChip><strong>{event.externalEventId}</strong></div>
                    <dl><div><dt>{copy.received}</dt><dd>{formatDate(event.receivedAt, locale, copy.notAvailable)}</dd></div><div><dt>{copy.attempts}</dt><dd>{event.attempts}</dd></div><div><dt>{copy.providerAck}</dt><dd>{formatDate(event.providerAcknowledgedAt, locale, copy.notAvailable)}</dd></div><div><dt>{copy.businessAcceptance}</dt><dd>{formatDate(event.businessAcceptedAt, locale, copy.notAvailable)}</dd></div></dl>
                    {event.lastErrorCode ? <p><TriangleAlert size={16} />{event.lastErrorCode}{event.lastErrorCategory ? ` · ${event.lastErrorCategory}` : ''}</p> : null}
                  </article>
                ))}</div>
              )}
            </Surface>
          </div>
        ) : null}
      </div>

      {pending ? (
        <div className={styles.dialogBackdrop} role='presentation'>
          <Surface className={styles.dialog} role='dialog' aria-modal='true' aria-labelledby='integration-action-title'>
            <header><AlertTriangle size={24} /><h2 id='integration-action-title'>{copy.actionTitle}</h2></header>
            <p>{selected?.primaryAction.reason}</p>
            <label><span>{copy.reason}</span><textarea value={pending.reason} onChange={(event) => setPending({ ...pending, reason: event.currentTarget.value })} placeholder={copy.reasonPlaceholder} rows={5} /></label>
            <div><Button variant='secondary' disabled={executing} onClick={() => setPending(null)}>{copy.cancel}</Button><Button disabled={executing || pending.reason.trim().length < 12 || !pending.ifMatch} onClick={() => void execute()}>{executing ? copy.executing : copy.confirm}</Button></div>
          </Surface>
        </div>
      ) : null}
    </section>
  );
}
