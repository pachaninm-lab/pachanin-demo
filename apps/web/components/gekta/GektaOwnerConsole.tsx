'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CONSOLE_ACTIONS,
  buildSearchQuery,
  formatMetric,
  formatMoment,
  formatShare,
  phoneStateLabel,
  revocableGrants,
  visibleActions,
  type ConsoleAccount,
  type ConsoleActionId,
  type ConsoleMetrics,
  type SearchMode,
} from '@/lib/gekta/console-model';

function csrfToken(): string {
  if (typeof document === 'undefined') return '';
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

/**
 * Плоский результат вместо размеченного объединения: в этой конфигурации
 * TypeScript не сужает объединение по булеву дискриминанту, и `status` внутри
 * ветки ошибки становится недоступен.
 */
type ApiResult<T> = { ok: boolean; status: number; data: T | null; error: string | null };

async function operatorApi<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<ApiResult<T>> {
  const method = init?.method ?? 'GET';
  try {
    const response = await fetch(`/api/gekta/operator/${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() } : {}),
      },
      ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = parsed && typeof parsed === 'object' && 'error' in parsed ? String((parsed as { error: unknown }).error) : 'request_failed';
      return { ok: false, status: response.status, data: null, error };
    }
    return { ok: true, status: response.status, data: parsed as T, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: 'network_error' };
  }
}

type AuditEntry = { id: string; action: string; previousState: string; newState: string; reason: string; createdAt: string };

export function GektaOwnerConsole() {
  const [ready, setReady] = useState(false);
  const [permissions, setPermissions] = useState<readonly string[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ConsoleMetrics | null>(null);

  const [mode, setMode] = useState<SearchMode>('email');
  const [query, setQuery] = useState('');
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<readonly ConsoleAccount[]>([]);
  const [account, setAccount] = useState<ConsoleAccount | null>(null);
  const [audit, setAudit] = useState<readonly AuditEntry[]>([]);

  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionNote, setActionNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await operatorApi<{ permissions: string[] }>('permissions');
      if (cancelled) return;
      if (!result.ok) {
        setAccessError(result.status === 401 ? 'authentication_required' : 'permission_denied');
        setReady(true);
        return;
      }
      const granted = result.data?.permissions ?? [];
      setPermissions(granted);
      if (granted.includes('metrics.read_global')) {
        const loaded = await operatorApi<ConsoleMetrics>('metrics');
        if (!cancelled && loaded.ok && loaded.data) setMetrics(loaded.data);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSearch = permissions.includes('account.search');
  const canReadAudit = permissions.includes('audit.read');
  const actions = useMemo(() => visibleActions(permissions, account), [permissions, account]);
  const revocable = useMemo(() => revocableGrants(permissions, account), [permissions, account]);

  const loadAccount = useCallback(async (accountId: string) => {
    const summary = await operatorApi<ConsoleAccount>(`accounts/${encodeURIComponent(accountId)}`);
    if (summary.ok && summary.data) setAccount(summary.data);
    if (canReadAudit) {
      const trail = await operatorApi<{ entries: AuditEntry[] }>(`accounts/${encodeURIComponent(accountId)}/audit`);
      setAudit(trail.ok ? trail.data?.entries ?? [] : []);
    }
  }, [canReadAudit]);

  const runSearch = useCallback(async () => {
    const search = buildSearchQuery(mode, query);
    if (!search) {
      setSearchNote('Введите значение для поиска.');
      return;
    }
    setBusy(true);
    setActionNote(null);
    setAccount(null);
    setAudit([]);
    const result = await operatorApi<{ status: string; accounts: ConsoleAccount[] }>(`search?${search}`);
    setBusy(false);
    if (!result.ok) {
      setSearchNote(result.status === 403 ? 'Недостаточно прав для поиска.' : 'Поиск не выполнен.');
      setCandidates([]);
      return;
    }
    const found = result.data?.accounts ?? [];
    setCandidates(found);
    if (result.data?.status === 'not_found') {
      setSearchNote('Аккаунт не найден.');
      return;
    }
    if (result.data?.status === 'ambiguous') {
      // Номер без подтверждения может принадлежать нескольким аккаунтам.
      // Выбор делает человек — угадывать нельзя.
      setSearchNote('Найдено несколько аккаунтов. Выберите нужный по идентификатору.');
      return;
    }
    setSearchNote(null);
    if (found[0]?.accountId) await loadAccount(found[0].accountId);
  }, [loadAccount, mode, query]);

  const submit = useCallback(async (path: string, body: Record<string, unknown>) => {
    if (!account) return;
    setBusy(true);
    const result = await operatorApi(path, { method: 'POST', body });
    setBusy(false);
    if (!result.ok) {
      setActionNote(result.status === 403 ? 'Недостаточно прав для этого действия.' : 'Действие не выполнено.');
      return;
    }
    setActionNote('Готово. Изменение записано в журнал.');
    setReason('');
    await loadAccount(account.accountId);
  }, [account, loadAccount]);

  /** Причина обязательна для каждого действия: журнал без причины бесполезен. */
  const requireReason = useCallback(() => {
    if (reason.trim()) return true;
    setActionNote('Укажите причину: она попадёт в неизменяемый журнал.');
    return false;
  }, [reason]);

  const runAction = useCallback(async (actionId: ConsoleActionId) => {
    if (!account) return;
    const target = CONSOLE_ACTIONS.find((item) => item.id === actionId);
    if (!target) return;
    if (target.needsDate && !until) {
      setActionNote('Укажите дату, до которой действует доступ.');
      return;
    }
    if (!requireReason()) return;

    const id = encodeURIComponent(account.accountId);
    switch (actionId) {
      case 'LIFETIME':
        return submit(`accounts/${id}/grant-lifetime`, { reason });
      case 'EXTEND_TRIAL':
        return submit(`accounts/${id}/extend-trial`, { days: 30, reason });
      case 'RESET_QUOTA':
        return submit(`accounts/${id}/reset-quota`, { reason });
      case 'SUSPEND':
        return submit(`accounts/${id}/suspend`, { suspended: true, reason });
      case 'UNSUSPEND':
        return submit(`accounts/${id}/suspend`, { suspended: false, reason });
      default:
        return submit(`accounts/${id}/grant`, {
          kind: actionId,
          reason,
          ...(until ? { until: new Date(until).toISOString() } : {}),
        });
    }
  }, [account, requireReason, reason, submit, until]);

  const runRevoke = useCallback(async (grantId: string) => {
    if (!requireReason()) return;
    await submit(`grants/${encodeURIComponent(grantId)}/revoke`, { reason });
  }, [reason, requireReason, submit]);

  if (!ready) {
    return <p data-gekta-console-state='loading'>Загружаем кабинет…</p>;
  }

  if (accessError) {
    return (
      <section data-gekta-console-state={accessError}>
        <h1>Кабинет Гекты</h1>
        <p>
          {accessError === 'authentication_required'
            ? 'Кабинет доступен после входа в аккаунт платформы.'
            : 'У вашей роли нет доступа к кабинету Гекты.'}
        </p>
      </section>
    );
  }

  return (
    <section data-gekta-console='true'>
      <h1>Кабинет Гекты</h1>

      {metrics ? (
        <section data-gekta-console-section='metrics'>
          <h2>Метрики</h2>
          <p data-gekta-console-server-time>Данные на {formatMoment(metrics.serverTime)} UTC</p>
          <dl>
            <div><dt>Аккаунтов всего</dt><dd>{formatMetric(metrics.accounts.total)}</dd></div>
            <div><dt>За сегодня</dt><dd>{formatMetric(metrics.accounts.today)}</dd></div>
            <div><dt>За 7 дней</dt><dd>{formatMetric(metrics.accounts.last7Days)}</dd></div>
            <div><dt>За 30 дней</dt><dd>{formatMetric(metrics.accounts.last30Days)}</dd></div>
            <div><dt>Пробный период активен</dt><dd>{formatMetric(metrics.entitlement.trialActive)}</dd></div>
            <div><dt>Пробный период истёк</dt><dd>{formatMetric(metrics.entitlement.trialExpired)}</dd></div>
            <div><dt>Платная подписка</dt><dd>{formatMetric(metrics.entitlement.paidActive)}</dd></div>
            <div><dt>Просрочена оплата</dt><dd>{formatMetric(metrics.entitlement.pastDue)}</dd></div>
            <div><dt>Ручной доступ</dt><dd>{formatMetric(metrics.entitlement.manualActive)}</dd></div>
            <div><dt>Бессрочный доступ</dt><dd>{formatMetric(metrics.entitlement.lifetime)}</dd></div>
            <div><dt>Приостановлено</dt><dd>{formatMetric(metrics.entitlement.suspended)}</dd></div>
            <div><dt>Завершённых ответов</dt><dd>{formatMetric(metrics.activity.completedAnswers)}</dd></div>
            <div><dt>Диалогов</dt><dd>{formatMetric(metrics.activity.conversations)}</dd></div>
            <div><dt>Проектов</dt><dd>{formatMetric(metrics.activity.projects)}</dd></div>
            <div>
              <dt>Конверсия в платный тариф</dt>
              {/* Прочерк, пока платежей нет: выдуманная конверсия хуже отсутствующей. */}
              <dd>{formatShare(metrics.conversion.trialToPaid)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {canSearch ? (
        <section data-gekta-console-section='search'>
          <h2>Поиск аккаунта</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <label htmlFor='gekta-console-mode'>Искать по</label>
            <select id='gekta-console-mode' value={mode} onChange={(event) => setMode(event.target.value as SearchMode)}>
              <option value='email'>e-mail</option>
              <option value='phone'>телефону</option>
              <option value='accountId'>идентификатору аккаунта</option>
            </select>

            <label htmlFor='gekta-console-query'>Значение</label>
            <input
              id='gekta-console-query'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete='off'
              inputMode={mode === 'phone' ? 'tel' : 'text'}
            />

            <button type='submit' disabled={busy}>Найти</button>
          </form>
          {searchNote ? <p data-gekta-console-note='search'>{searchNote}</p> : null}
          {candidates.length > 1 ? (
            <ul data-gekta-console-candidates>
              {candidates.map((candidate) => (
                <li key={candidate.accountId}>
                  <button type='button' onClick={() => void loadAccount(candidate.accountId)}>
                    {candidate.accountId}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {account ? (
        <section data-gekta-console-section='account'>
          <h2>Аккаунт {account.accountId}</h2>
          <dl>
            <div><dt>E-mail</dt><dd>{account.email ?? '—'}</dd></div>
            <div><dt>Зарегистрирован</dt><dd>{formatMoment(account.registeredAt)}</dd></div>
            <div><dt>Телефон</dt><dd>{phoneStateLabel(account.phoneState)}</dd></div>
            <div><dt>Пробный период до</dt><dd>{formatMoment(account.trial?.endsAt)}</dd></div>
            <div><dt>Подписка</dt><dd>{account.subscriptionStatus ?? '—'}</dd></div>
            <div><dt>Бессрочный доступ</dt><dd>{account.lifetimeAccess ? 'да' : 'нет'}</dd></div>
            <div><dt>Приостановлен</dt><dd>{account.suspended ? 'да' : 'нет'}</dd></div>
            <div><dt>Завершённых ответов</dt><dd>{formatMetric(account.usage?.completedAnswers)}</dd></div>
            <div><dt>Диалогов</dt><dd>{formatMetric(account.counts?.conversations)}</dd></div>
          </dl>

          {actions.length || revocable.length ? (
            <>
              {/* Причина обязательна и для выдачи, и для отзыва, поэтому поле
                  стоит выше обеих групп кнопок. */}
              <label htmlFor='gekta-console-reason'>Причина (попадёт в журнал)</label>
              <textarea
                id='gekta-console-reason'
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={2}
              />
            </>
          ) : null}

          {account.grants?.length ? (
            <>
              <h3>Выданные доступы</h3>
              <ul data-gekta-console-grants>
                {account.grants.map((grant) => (
                  <li key={grant.id}>
                    {grant.kind} · выдан {formatMoment(grant.grantedAt)} · до {formatMoment(grant.expiresAt)}
                    {grant.revokedAt ? ` · отозван ${formatMoment(grant.revokedAt)}` : ''}
                    {revocable.some((item) => item.id === grant.id) ? (
                      <button type='button' disabled={busy} data-destructive='true' onClick={() => void runRevoke(grant.id)}>
                        Отозвать
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {actions.length ? (
            <section data-gekta-console-section='actions'>
              <h3>Действия</h3>
              {actions.some((action) => action.needsDate) ? (
                <>
                  <label htmlFor='gekta-console-until'>Доступ до даты</label>
                  <input id='gekta-console-until' type='date' value={until} onChange={(event) => setUntil(event.target.value)} />
                </>
              ) : null}
              <div data-gekta-console-actions>
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type='button'
                    disabled={busy}
                    data-destructive={action.destructive ? 'true' : undefined}
                    onClick={() => void runAction(action.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {actionNote ? <p data-gekta-console-note='action'>{actionNote}</p> : null}
            </section>
          ) : null}

          {canReadAudit && audit.length ? (
            <section data-gekta-console-section='audit'>
              <h3>Журнал действий</h3>
              <ul>
                {audit.map((entry) => (
                  <li key={entry.id}>
                    {formatMoment(entry.createdAt)} · {entry.action} · {entry.previousState} → {entry.newState}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
