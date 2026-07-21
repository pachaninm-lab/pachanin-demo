'use client';

import * as React from 'react';
import {
  CommodityProfileRegistryView,
  type CommodityProfileRegistryRecord,
} from './CommodityProfileRegistryView';
import {
  parseCommodityProfileHistory,
  parseCommodityProfilePage,
  withCommodityProfileHistory,
  type CommodityProfileLocale,
} from './commodity-profile-live-adapter';
import styles from './CommodityProfileRegistryClient.module.css';

type StablePhase = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict';
type LiveState = StablePhase | 'reconnecting';

type ClientState = Readonly<{
  phase: StablePhase;
  records: CommodityProfileRegistryRecord[];
  selectedProfileId: string;
  message: string;
}>;

const COPY: Record<CommodityProfileLocale, {
  accessDenied: string;
  conflict: string;
  invalidPayload: string;
  loadFailed: string;
  offline: string;
  timeout: string;
  reconnecting: string;
  pinningBoundary: string;
}> = {
  ru: {
    accessDenied: 'Сервер не подтвердил доступ к реестру товарных профилей.',
    conflict: 'Версия реестра изменилась. Обновляем только серверные данные; локальная подмена запрещена.',
    invalidPayload: 'Сервер вернул неполный контракт товарного профиля. Данные не показаны.',
    loadFailed: 'Не удалось загрузить товарные профили с сервера.',
    offline: 'Нет связи с сервером. Реестр не заменён локальными или тестовыми данными.',
    timeout: 'Сервер не ответил вовремя. Повтори загрузку.',
    reconnecting: 'Восстанавливаем соединение и сверяем версию профиля с сервером…',
    pinningBoundary: 'Количество закреплённых Сделок не показывается до принятия отдельного Deal/Lot profile-pinning authority.',
  },
  en: {
    accessDenied: 'The server did not confirm access to the commodity profile registry.',
    conflict: 'The registry version changed. Only server data is refreshed; local substitution is prohibited.',
    invalidPayload: 'The server returned an incomplete commodity profile contract. No data was displayed.',
    loadFailed: 'Could not load commodity profiles from the server.',
    offline: 'The server is unreachable. The registry was not replaced with local or test data.',
    timeout: 'The server did not respond in time. Retry the request.',
    reconnecting: 'Restoring the connection and reconciling the profile version with the server…',
    pinningBoundary: 'Pinned Deal counts remain hidden until a separate Deal/Lot profile-pinning authority is accepted.',
  },
  zh: {
    accessDenied: '服务器未确认商品配置登记表的访问权限。',
    conflict: '登记表版本已变化。仅刷新服务器数据，禁止本地替代。',
    invalidPayload: '服务器返回的商品配置契约不完整，因此未显示数据。',
    loadFailed: '无法从服务器加载商品配置。',
    offline: '无法连接服务器，登记表未被本地或测试数据替代。',
    timeout: '服务器响应超时，请重试。',
    reconnecting: '正在恢复连接并与服务器核对配置版本…',
    pinningBoundary: '在单独的交易/批次配置固定权限通过验收前，不显示已固定交易数量。',
  },
};

function normalizeLocale(value: string): CommodityProfileLocale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function payloadMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const source = payload as Record<string, unknown>;
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

export function CommodityProfileRegistryClient({ locale: localeInput }: Readonly<{ locale: string }>) {
  const locale = normalizeLocale(localeInput);
  const copy = COPY[locale];
  const requestSequence = React.useRef(0);
  const [liveState, setLiveState] = React.useState<LiveState>('loading');
  const [state, setState] = React.useState<ClientState>({
    phase: 'loading',
    records: [],
    selectedProfileId: '',
    message: '',
  });

  const loadHistory = React.useCallback(async (
    profileId: string,
    records: readonly CommodityProfileRegistryRecord[],
    signal: AbortSignal,
  ): Promise<CommodityProfileRegistryRecord[] | null> => {
    const response = await fetch(
      `/api/platform-v7/commodity-profiles/${encodeURIComponent(profileId)}/versions?limit=100`,
      { cache: 'no-store', headers: { Accept: 'application/json' }, signal },
    );
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
    if (mode === 'reconnect') {
      setLiveState('reconnecting');
    } else {
      setLiveState('loading');
      setState((current) => ({ ...current, phase: 'loading', message: '' }));
    }

    try {
      const response = await fetch('/api/platform-v7/commodity-profiles?limit=100', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await readJson(response);
      if (requestId !== requestSequence.current) return;
      if (!response.ok) {
        const phase = responsePhase(response.status);
        setLiveState(phase);
        setState({
          phase,
          records: [],
          selectedProfileId: '',
          message: payloadMessage(payload) ?? (phase === 'forbidden' ? copy.accessDenied : phase === 'conflict' ? copy.conflict : copy.loadFailed),
        });
        return;
      }

      const page = parseCommodityProfilePage(payload, locale);
      if (!page) {
        setLiveState('error');
        setState({ phase: 'error', records: [], selectedProfileId: '', message: copy.invalidPayload });
        return;
      }
      if (page.items.length === 0) {
        setLiveState('empty');
        setState({ phase: 'empty', records: [], selectedProfileId: '', message: '' });
        return;
      }

      const selectedProfileId = page.items[0]!.id;
      const records = await loadHistory(selectedProfileId, page.items, controller.signal);
      if (requestId !== requestSequence.current) return;
      if (!records) {
        setLiveState('error');
        setState({ phase: 'error', records: [], selectedProfileId: '', message: copy.invalidPayload });
        return;
      }
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
      setState({ phase, records: [], selectedProfileId: '', message });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [copy, loadHistory, locale]);

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
      if (!records) {
        setLiveState('error');
        setState((current) => ({ ...current, phase: 'error', message: copy.invalidPayload }));
        return;
      }
      setLiveState('ready');
      setState({ phase: 'ready', records, selectedProfileId: profileId, message: '' });
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      const status = typeof error === 'object' && error && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0;
      const phase = status ? responsePhase(status) : 'error';
      setLiveState(phase);
      setState((current) => ({
        ...current,
        phase,
        message: error instanceof DOMException && error.name === 'AbortError'
          ? copy.timeout
          : status === 409
            ? copy.conflict
            : error instanceof Error && error.message
              ? error.message
              : copy.loadFailed,
      }));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [copy, loadHistory, state.records, state.selectedProfileId]);

  React.useEffect(() => {
    void loadRegistry('initial');
    const reconnect = () => void loadRegistry('reconnect');
    window.addEventListener('online', reconnect);
    return () => {
      requestSequence.current += 1;
      window.removeEventListener('online', reconnect);
    };
  }, [loadRegistry]);

  const openStaffControl = React.useCallback((profileId: string, actionCode: string) => {
    const next = `/platform-v7/commodity-profiles?profile=${encodeURIComponent(profileId)}&action=${encodeURIComponent(actionCode)}`;
    window.location.assign(`/platform-v7/staff?next=${encodeURIComponent(next)}`);
  }, []);

  return (
    <div
      className={styles.shell}
      data-commodity-profile-live-binding='v1'
      data-live-state={liveState}
      data-static-authority-fallback='false'
    >
      <p className={styles.connectionStatus} role='status' aria-live='polite' hidden={liveState !== 'reconnecting'}>
        {copy.reconnecting}
      </p>
      <CommodityProfileRegistryView
        locale={locale}
        state={state.phase}
        profiles={state.records}
        selectedProfileId={state.selectedProfileId || undefined}
        message={state.message || undefined}
        canCreate={false}
        onRetry={() => void loadRegistry('retry')}
        onSelect={(profileId) => void selectProfile(profileId)}
        onPrimaryAction={openStaffControl}
      />
      <p className={styles.pinningBoundary} data-pinning-authority='not-in-slice'>
        {copy.pinningBoundary}
      </p>
    </div>
  );
}
