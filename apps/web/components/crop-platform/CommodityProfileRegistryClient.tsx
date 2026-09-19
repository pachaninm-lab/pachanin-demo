'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button, InlineNotice, StatusChip, Surface } from '@pc/design-system-v8';
import {
  CommodityProfileRegistryView,
  type CommodityProfileRegistryRecord,
} from './CommodityProfileRegistryView';
import {
  collectCommodityProfilePages,
  parseCommodityProfileHistory,
  parseCommodityProfilePage,
  withCommodityProfileHistory,
  type CommodityProfileLocale,
} from './commodity-profile-live-adapter';
import styles from './CommodityProfileRegistryClient.module.css';

type StablePhase = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict';
type LiveState = StablePhase | 'reconnecting';
type JsonRecord = Record<string, unknown>;

type ClientState = Readonly<{
  phase: StablePhase;
  records: CommodityProfileRegistryRecord[];
  selectedProfileId: string;
  message: string;
}>;

type PendingAction = Readonly<{
  profileId: string;
  profileVersionId: string;
  actionCode: string;
  etag: string;
  reason: string;
  effectiveFrom: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
}>;

type Copy = {
  accessDenied: string;
  conflict: string;
  invalidPayload: string;
  loadFailed: string;
  offline: string;
  timeout: string;
  reconnecting: string;
  pinningBoundary: string;
  staffSessionRequired: string;
  actionTitle: string;
  reason: string;
  reasonPlaceholder: string;
  effectiveFrom: string;
  cancel: string;
  confirm: string;
  executing: string;
  receipt: string;
};

const COPY: Record<CommodityProfileLocale, Copy> = {
  ru: {
    accessDenied: 'Сервер не подтвердил доступ к реестру товарных профилей.',
    conflict: 'Версия реестра изменилась. Основание сохранено; данные обновляются только с сервера.',
    invalidPayload: 'Сервер вернул неполный контракт товарного профиля. Данные не показаны.',
    loadFailed: 'Не удалось загрузить товарные профили с сервера.',
    offline: 'Нет связи с сервером. Реестр не заменён локальными или тестовыми данными.',
    timeout: 'Сервер не ответил вовремя. Повтори загрузку.',
    reconnecting: 'Восстанавливаем соединение и сверяем версию профиля с сервером…',
    pinningBoundary: 'Количество закреплённых Сделок не показывается до принятия отдельного Deal/Lot profile-pinning authority.',
    staffSessionRequired: 'Для выполнения команды требуется активная staff/JIT-сессия.',
    actionTitle: 'Подтверждение управляемого действия',
    reason: 'Основание',
    reasonPlaceholder: 'Укажите проверяемое деловое или нормативное основание…',
    effectiveFrom: 'Начало действия',
    cancel: 'Отмена',
    confirm: 'Подтвердить на сервере',
    executing: 'Фиксируем команду…',
    receipt: 'Команда зафиксирована сервером. Реестр обновлён по receipt.',
  },
  en: {
    accessDenied: 'The server did not confirm access to the commodity profile registry.',
    conflict: 'The registry version changed. The reason is preserved; only server data is refreshed.',
    invalidPayload: 'The server returned an incomplete commodity profile contract. No data was displayed.',
    loadFailed: 'Could not load commodity profiles from the server.',
    offline: 'The server is unreachable. The registry was not replaced with local or test data.',
    timeout: 'The server did not respond in time. Retry the request.',
    reconnecting: 'Restoring the connection and reconciling the profile version with the server…',
    pinningBoundary: 'Pinned Deal counts remain hidden until a separate Deal/Lot profile-pinning authority is accepted.',
    staffSessionRequired: 'An active staff/JIT session is required to execute the command.',
    actionTitle: 'Governed action confirmation',
    reason: 'Reason',
    reasonPlaceholder: 'Enter a verifiable business or regulatory reason…',
    effectiveFrom: 'Effective from',
    cancel: 'Cancel',
    confirm: 'Confirm on server',
    executing: 'Committing command…',
    receipt: 'The command was committed by the server. The registry was refreshed from the receipt.',
  },
  zh: {
    accessDenied: '服务器未确认商品配置登记表的访问权限。',
    conflict: '登记表版本已变化。操作依据已保留；仅使用服务器数据刷新。',
    invalidPayload: '服务器返回的商品配置契约不完整，因此未显示数据。',
    loadFailed: '无法从服务器加载商品配置。',
    offline: '无法连接服务器，登记表未被本地或测试数据代替。',
    timeout: '服务器响应超时，请重试。',
    reconnecting: '正在恢复连接并与服务器核对配置版本…',
    pinningBoundary: '在单独的交易/批次配置固定权限通过验收前，不显示已固定交易数量。',
    staffSessionRequired: '执行命令需要有效的 staff/JIT 会话。',
    actionTitle: '受控操作确认',
    reason: '依据',
    reasonPlaceholder: '请输入可核验的业务或法规依据…',
    effectiveFrom: '生效时间',
    cancel: '取消',
    confirm: '在服务器确认',
    executing: '正在提交命令…',
    receipt: '服务器已记录命令，并根据 receipt 刷新登记。',
  },
};

function normalizeLocale(value: string): CommodityProfileLocale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
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
  return 'error';
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function staffAwareGet(path: string, signal: AbortSignal): Promise<Response> {
  const staff = await fetch(`/api/staff/commodity-profile-registry${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (staff.status !== 401 && staff.status !== 403) return staff;
  return fetch(`/api/platform-v7/commodity-profiles${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
}

function commandToken(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function CommodityProfileRegistryClient({
  locale: localeInput,
  csrfToken,
  initialProfileId = '',
}: Readonly<{
  locale: string;
  csrfToken: string;
  initialProfileId?: string;
}>) {
  const locale = normalizeLocale(localeInput);
  const copy = COPY[locale];
  const requestSequence = React.useRef(0);
  const [liveState, setLiveState] = React.useState<LiveState>('loading');
  const [state, setState] = React.useState<ClientState>({
    phase: 'loading',
    records: [],
    selectedProfileId: initialProfileId,
    message: '',
  });
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [executing, setExecuting] = React.useState(false);
  const [receipt, setReceipt] = React.useState('');

  const loadHistory = React.useCallback(async (
    profileId: string,
    records: readonly CommodityProfileRegistryRecord[],
    signal: AbortSignal,
  ): Promise<CommodityProfileRegistryRecord[] | null> => {
    const response = await staffAwareGet(`/${encodeURIComponent(profileId)}/versions?limit=100`, signal);
    const payload = await readJson(response);
    if (!response.ok) {
      const error = new Error(payloadMessage(payload) ?? copy.loadFailed) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    const history = parseCommodityProfileHistory(payload);
    if (!history || history.profileId !== profileId) return null;
    return withCommodityProfileHistory(records, history);
  }, [copy.loadFailed]);

  const loadRegistry = React.useCallback(async (mode: 'initial' | 'retry' | 'reconnect' = 'initial') => {
    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
    if (mode === 'reconnect') setLiveState('reconnecting');
    else {
      setLiveState('loading');
      setState((current) => ({ ...current, phase: 'loading', message: '' }));
    }

    try {
      let registryRecords: CommodityProfileRegistryRecord[] | null;
      if (initialProfileId) {
        const response = await staffAwareGet(`/${encodeURIComponent(initialProfileId)}`, controller.signal);
        const payload = await readJson(response);
        if (requestId !== requestSequence.current) return;
        if (!response.ok) {
          const phase = responsePhase(response.status);
          setLiveState(phase);
          setState({
            phase,
            records: [],
            selectedProfileId: initialProfileId,
            message: payloadMessage(payload) ?? (phase === 'forbidden' ? copy.accessDenied : phase === 'conflict' ? copy.conflict : copy.loadFailed),
          });
          return;
        }
        registryRecords = parseCommodityProfilePage({ items: [payload], nextCursor: null }, locale)?.items ?? null;
      } else {
        registryRecords = await collectCommodityProfilePages(async (cursor) => {
          if (requestId !== requestSequence.current) {
            throw new DOMException('Superseded request', 'AbortError');
          }
          const path = cursor === null
            ? '?limit=100'
            : `?limit=100&cursor=${encodeURIComponent(cursor)}`;
          const response = await staffAwareGet(path, controller.signal);
          const payload = await readJson(response);
          if (!response.ok) {
            const error = new Error(payloadMessage(payload) ?? copy.loadFailed) as Error & { status?: number };
            error.status = response.status;
            throw error;
          }
          return payload;
        }, locale);
      }

      if (requestId !== requestSequence.current) return;
      if (!registryRecords) {
        setLiveState('error');
        setState({ phase: 'error', records: [], selectedProfileId: initialProfileId, message: copy.invalidPayload });
        return;
      }
      if (registryRecords.length === 0) {
        setLiveState('empty');
        setState({ phase: 'empty', records: [], selectedProfileId: '', message: '' });
        return;
      }

      const selectedProfileId = initialProfileId || registryRecords[0]!.id;
      const records = await loadHistory(selectedProfileId, registryRecords, controller.signal);
      if (requestId !== requestSequence.current) return;
      if (!records) throw new Error(copy.invalidPayload);
      setLiveState('ready');
      setState({ phase: 'ready', records, selectedProfileId, message: '' });
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      const status = typeof error === 'object' && error && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0;
      const phase = status ? responsePhase(status) : 'error';
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? copy.timeout
        : status === 401 || status === 403
          ? copy.accessDenied
          : status === 409
            ? copy.conflict
            : navigator.onLine
              ? (error instanceof Error && error.message ? error.message : copy.loadFailed)
              : copy.offline;
      setLiveState(phase);
      setState((current) => ({
        phase,
        records: mode === 'reconnect' ? current.records : [],
        selectedProfileId: current.selectedProfileId,
        message,
      }));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [copy, initialProfileId, loadHistory, locale]);

  const selectProfile = React.useCallback(async (profileId: string) => {
    const existing = state.records.find((record) => record.id === profileId);
    if (!existing || profileId === state.selectedProfileId) return;
    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
    setLiveState('reconnecting');
    setState((current) => ({ ...current, selectedProfileId: profileId, message: '' }));
    try {
      const records = await loadHistory(profileId, state.records, controller.signal);
      if (requestId !== requestSequence.current) return;
      if (!records) throw new Error(copy.invalidPayload);
      setLiveState('ready');
      setState({ phase: 'ready', records, selectedProfileId: profileId, message: '' });
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      setLiveState('error');
      setState((current) => ({ ...current, phase: 'error', message: error instanceof Error ? error.message : copy.loadFailed }));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [copy.invalidPayload, copy.loadFailed, loadHistory, state.records, state.selectedProfileId]);

  React.useEffect(() => {
    void loadRegistry('initial');
    const reconnect = () => void loadRegistry('reconnect');
    window.addEventListener('online', reconnect);
    return () => {
      requestSequence.current += 1;
      window.removeEventListener('online', reconnect);
    };
  }, [loadRegistry]);

  const openAction = React.useCallback(async (profileId: string, actionCode: string) => {
    const profile = state.records.find((record) => record.id === profileId);
    if (!profile) return;
    if (actionCode === 'UPDATE_DRAFT') {
      const next = `/platform-v7/commodity-profiles/${encodeURIComponent(profileId)}?mode=edit`;
      window.location.assign(`/platform-v7/staff?next=${encodeURIComponent(next)}`);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const detail = await fetch(`/api/staff/commodity-profile-registry/${encodeURIComponent(profileId)}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (detail.status === 401 || detail.status === 403) {
        setState((current) => ({ ...current, message: copy.staffSessionRequired }));
        return;
      }
      if (!detail.ok) throw new Error(copy.loadFailed);
      const etag = detail.headers.get('etag');
      if (!etag || etag.length > 32) throw new Error(copy.invalidPayload);
      setReceipt('');
      setPending({
        profileId,
        profileVersionId: profile.versionId,
        actionCode,
        etag,
        reason: '',
        effectiveFrom: '',
        commandId: commandToken('cp-command'),
        idempotencyKey: commandToken('cp-idem'),
        correlationId: commandToken('cp-corr'),
      });
    } catch (error) {
      setState((current) => ({ ...current, message: error instanceof Error ? error.message : copy.loadFailed }));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [copy.invalidPayload, copy.loadFailed, copy.staffSessionRequired, state.records]);

  const execute = React.useCallback(async () => {
    if (!pending || pending.reason.trim().length < 10 || !csrfToken) return;
    setExecuting(true);
    try {
      const payload = pending.actionCode === 'ACTIVATE' && pending.effectiveFrom
        ? { effectiveFrom: new Date(pending.effectiveFrom).toISOString() }
        : undefined;
      const response = await fetch(
        `/api/staff/commodity-profiles/${encodeURIComponent(pending.profileId)}/commands/${encodeURIComponent(pending.actionCode)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            'If-Match': pending.etag,
          },
          body: JSON.stringify({
            commandId: pending.commandId,
            idempotencyKey: pending.idempotencyKey,
            correlationId: pending.correlationId,
            profileVersionId: pending.profileVersionId,
            reason: pending.reason.trim(),
            ...(payload ? { payload } : {}),
          }),
        },
      );
      const body = await readJson(response);
      if (response.status === 409) {
        setLiveState('conflict');
        setState((current) => ({ ...current, phase: 'conflict', message: copy.conflict }));
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setState((current) => ({ ...current, message: copy.staffSessionRequired }));
        return;
      }
      if (!response.ok) {
        setState((current) => ({ ...current, message: payloadMessage(body) ?? copy.loadFailed }));
        return;
      }
      setPending(null);
      setReceipt(copy.receipt);
      await loadRegistry('retry');
    } catch {
      setState((current) => ({ ...current, message: copy.loadFailed }));
    } finally {
      setExecuting(false);
    }
  }, [copy.conflict, copy.loadFailed, copy.receipt, copy.staffSessionRequired, csrfToken, loadRegistry, pending]);

  return (
    <div className={styles.shell} data-commodity-profile-live-binding='v2' data-live-state={liveState} data-static-authority-fallback='false'>
      <p className={styles.connectionStatus} role='status' aria-live='polite' hidden={liveState !== 'reconnecting'}>
        {copy.reconnecting}
      </p>
      {receipt ? <InlineNotice tone='success' title={copy.receipt} icon={<CheckCircle2 size={18} />}>{receipt}</InlineNotice> : null}
      <CommodityProfileRegistryView
        locale={locale}
        state={state.phase}
        profiles={state.records}
        selectedProfileId={state.selectedProfileId || undefined}
        message={state.message || undefined}
        canCreate={false}
        onRetry={() => void loadRegistry('retry')}
        onSelect={(profileId) => void selectProfile(profileId)}
        onPrimaryAction={(profileId, actionCode) => void openAction(profileId, actionCode)}
      />
      <p className={styles.pinningBoundary} data-pinning-authority='not-in-slice'>{copy.pinningBoundary}</p>

      {pending ? (
        <Surface className={styles.confirmation} role='dialog' aria-modal='true' aria-labelledby='commodity-action-title'>
          <header>
            <StatusChip tone='warning'><ShieldCheck size={16} />{copy.actionTitle}</StatusChip>
            <h2 id='commodity-action-title'>{pending.actionCode}</h2>
          </header>
          <label>
            <span>{copy.reason}</span>
            <textarea value={pending.reason} minLength={10} maxLength={2000} placeholder={copy.reasonPlaceholder} onChange={(event) => setPending({ ...pending, reason: event.currentTarget.value })} />
          </label>
          {pending.actionCode === 'ACTIVATE' ? (
            <label>
              <span>{copy.effectiveFrom}</span>
              <input type='datetime-local' value={pending.effectiveFrom} onChange={(event) => setPending({ ...pending, effectiveFrom: event.currentTarget.value })} />
            </label>
          ) : null}
          {state.message ? <InlineNotice tone='critical' title={state.message} icon={<AlertTriangle size={18} />}>{state.message}</InlineNotice> : null}
          <div className={styles.confirmationActions}>
            <Button variant='secondary' disabled={executing} onClick={() => setPending(null)}>{copy.cancel}</Button>
            <Button disabled={executing || pending.reason.trim().length < 10 || (pending.actionCode === 'ACTIVATE' && !pending.effectiveFrom)} onClick={() => void execute()}>
              {executing ? copy.executing : copy.confirm}
            </Button>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
