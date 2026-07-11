'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppLocale } from '@/i18n/locale';
import styles from './StaffOperationalWorkspaces.module.css';

type ApiObject = Record<string, unknown>;
type Props = {
  locale: AppLocale;
  permissions: string[];
  suggestedOrganizationIds: string[];
  suggestedDealIds: string[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

const COPY = {
  ru: {
    title: 'Обращения поддержки', lead: 'Постоянный журнал обращений с идемпотентным созданием, optimistic concurrency, ответственным сотрудником и неизменяемой историей статусов.',
    create: 'Создать обращение', organization: 'ID организации', user: 'ID пользователя', deal: 'ID сделки', subject: 'Тема', description: 'Описание', priority: 'Приоритет', idempotency: 'Ключ идемпотентности',
    status: 'Статус', version: 'Версия', assignee: 'ID ответственного сотрудника', note: 'Основание изменения', transition: 'Изменить статус', refresh: 'Обновить', empty: 'Обращений нет.',
    revoke: 'Отозвать сессии пользователя', revokeReason: 'Основание отзыва сессий', recovery: 'Запустить восстановление доступа', recoveryReason: 'Основание восстановления', ticket: 'Номер обращения/инцидента',
    recoveryPending: 'Запрос восстановления зарегистрирован. Доставка остаётся в статусе PENDING_DELIVERY до обработки production auth-сервисом.', created: 'Обращение создано.', saved: 'Статус обновлён.', revoked: 'Сессии и refresh-токены отозваны.', invalid: 'Проверь обязательные поля.',
  },
  en: {
    title: 'Support cases', lead: 'Durable case ledger with idempotent creation, optimistic concurrency, accountable ownership and append-only status history.',
    create: 'Create case', organization: 'Organization ID', user: 'User ID', deal: 'Deal ID', subject: 'Subject', description: 'Description', priority: 'Priority', idempotency: 'Idempotency key',
    status: 'Status', version: 'Version', assignee: 'Assigned staff user ID', note: 'Transition reason', transition: 'Change status', refresh: 'Refresh', empty: 'No support cases.',
    revoke: 'Revoke user sessions', revokeReason: 'Session revocation reason', recovery: 'Initiate access recovery', recoveryReason: 'Recovery reason', ticket: 'Ticket/incident ID',
    recoveryPending: 'The recovery request is registered. Delivery remains PENDING_DELIVERY until the production auth service processes it.', created: 'The support case was created.', saved: 'The status was updated.', revoked: 'Sessions and refresh tokens were revoked.', invalid: 'Check the required fields.',
  },
  zh: {
    title: '支持工单', lead: '持久化工单台账，支持幂等创建、乐观并发、责任人和只追加的状态历史。',
    create: '创建工单', organization: '组织 ID', user: '用户 ID', deal: '交易 ID', subject: '主题', description: '说明', priority: '优先级', idempotency: '幂等键',
    status: '状态', version: '版本', assignee: '负责员工 ID', note: '状态变更理由', transition: '更改状态', refresh: '刷新', empty: '暂无支持工单。',
    revoke: '撤销用户会话', revokeReason: '会话撤销理由', recovery: '发起访问恢复', recoveryReason: '恢复理由', ticket: '工单/事件编号',
    recoveryPending: '恢复申请已登记。在生产认证服务处理前，交付状态保持为 PENDING_DELIVERY。', created: '工单已创建。', saved: '状态已更新。', revoked: '会话和刷新令牌已撤销。', invalid: '请检查必填字段。',
  },
} as const;

const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const;
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

function csrfToken() {
  if (typeof document === 'undefined') return '';
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

async function request<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const method = init?.method || 'GET';
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() } : {}),
    },
    body: method === 'POST' ? JSON.stringify(init?.body || {}) : undefined,
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.message || payload.code || 'SUPPORT_CASE_ERROR'));
  return payload as T;
}

function value(input: unknown) { return input == null || input === '' ? '—' : String(input); }
function date(input: unknown, locale: AppLocale) {
  const parsed = new Date(String(input || ''));
  if (!Number.isFinite(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

export function StaffSupportCaseWorkspace({ locale, permissions, suggestedOrganizationIds, suggestedDealIds, onError, onNotice }: Props) {
  const copy = COPY[locale];
  const canRead = permissions.includes('support-case:read');
  const canUpdate = permissions.includes('support-case:update');
  const canRevoke = permissions.includes('user:session:revoke');
  const canRecover = permissions.includes('user:access-recovery:initiate');
  const [cases, setCases] = useState<ApiObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [organizationId, setOrganizationId] = useState(suggestedOrganizationIds[0] || '');
  const [userId, setUserId] = useState('');
  const [dealId, setDealId] = useState(suggestedDealIds[0] || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('NORMAL');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [transitionStatus, setTransitionStatus] = useState<Record<string, string>>({});
  const [transitionNote, setTransitionNote] = useState<Record<string, string>>({});
  const [assignee, setAssignee] = useState<Record<string, string>>({});
  const [sessionReason, setSessionReason] = useState<Record<string, string>>({});
  const [recoveryReason, setRecoveryReason] = useState<Record<string, string>>({});
  const [recoveryTicket, setRecoveryTicket] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!organizationId && suggestedOrganizationIds[0]) setOrganizationId(suggestedOrganizationIds[0]);
    if (!dealId && suggestedDealIds[0]) setDealId(suggestedDealIds[0]);
  }, [dealId, organizationId, suggestedDealIds, suggestedOrganizationIds]);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const rows = await request<ApiObject[]>('/api/staff/workspaces/support/cases?limit=300');
      setCases(Array.isArray(rows) ? rows : []);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'SUPPORT_CASE_ERROR');
    } finally {
      setLoading(false);
    }
  }, [canRead, onError]);

  useEffect(() => { void load(); }, [load]);

  const idempotencyPlaceholder = useMemo(() => `SUP-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 10)}`, []);

  async function createCase() {
    if (!canUpdate || organizationId.trim().length < 2 || subject.trim().length < 3 || description.trim().length < 10) {
      onError(copy.invalid); return;
    }
    setBusy('create');
    try {
      await request('/api/staff/workspaces/support/cases', {
        method: 'POST',
        body: {
          organizationId: organizationId.trim(),
          ...(userId.trim() ? { userId: userId.trim() } : {}),
          ...(dealId.trim() ? { dealId: dealId.trim() } : {}),
          subject: subject.trim(),
          description: description.trim(),
          priority,
          idempotencyKey: idempotencyKey.trim() || idempotencyPlaceholder,
        },
      });
      setSubject(''); setDescription(''); setIdempotencyKey('');
      onNotice(copy.created);
      await load();
    } catch (error) { onError(error instanceof Error ? error.message : 'SUPPORT_CASE_CREATE_ERROR'); }
    finally { setBusy(''); }
  }

  async function transition(item: ApiObject) {
    const id = value(item.id);
    const status = transitionStatus[id];
    const note = (transitionNote[id] || '').trim();
    if (!canUpdate || !STATUSES.includes(status as (typeof STATUSES)[number]) || note.length < 5) { onError(copy.invalid); return; }
    setBusy(`transition:${id}`);
    try {
      await request(`/api/staff/workspaces/support/cases/${encodeURIComponent(id)}/transition`, {
        method: 'POST',
        body: {
          status,
          expectedVersion: Number(item.version),
          note,
          ...(assignee[id]?.trim() ? { assignedStaffUserId: assignee[id].trim() } : {}),
        },
      });
      onNotice(copy.saved);
      await load();
    } catch (error) { onError(error instanceof Error ? error.message : 'SUPPORT_CASE_TRANSITION_ERROR'); }
    finally { setBusy(''); }
  }

  async function revokeSessions(item: ApiObject) {
    const targetUser = value(item.user_id);
    const reason = (sessionReason[value(item.id)] || '').trim();
    if (!canRevoke || targetUser === '—' || reason.length < 10) { onError(copy.invalid); return; }
    setBusy(`revoke:${value(item.id)}`);
    try {
      await request(`/api/staff/workspaces/support/users/${encodeURIComponent(targetUser)}/revoke-sessions`, {
        method: 'POST',
        body: { organizationId: value(item.organization_id), reason },
      });
      onNotice(copy.revoked);
    } catch (error) { onError(error instanceof Error ? error.message : 'USER_SESSION_REVOKE_ERROR'); }
    finally { setBusy(''); }
  }

  async function initiateRecovery(item: ApiObject) {
    const id = value(item.id);
    const targetUser = value(item.user_id);
    const reason = (recoveryReason[id] || '').trim();
    const ticketId = (recoveryTicket[id] || '').trim();
    if (!canRecover || targetUser === '—' || reason.length < 10 || ticketId.length < 3) { onError(copy.invalid); return; }
    setBusy(`recovery:${id}`);
    try {
      await request(`/api/staff/workspaces/support/users/${encodeURIComponent(targetUser)}/recovery`, {
        method: 'POST',
        body: { organizationId: value(item.organization_id), reason, ticketId },
      });
      onNotice(copy.recoveryPending);
    } catch (error) { onError(error instanceof Error ? error.message : 'USER_RECOVERY_ERROR'); }
    finally { setBusy(''); }
  }

  if (!canRead) return null;
  return (
    <article className={`${styles.panel} ${styles.span2}`} aria-labelledby="staff-support-cases-title">
      <div className={styles.panelHead}>
        <div><h3 id="staff-support-cases-title">{copy.title}</h3><p>{copy.lead}</p></div>
        <button type="button" className={styles.button} onClick={() => void load()} disabled={loading}>{copy.refresh}</button>
      </div>
      {canUpdate && (
        <div className={`${styles.form} ${styles.two}`}>
          <label><span>{copy.organization}</span><input list="staff-support-organizations" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} /><datalist id="staff-support-organizations">{suggestedOrganizationIds.map((id) => <option key={id} value={id} />)}</datalist></label>
          <label><span>{copy.user}</span><input value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
          <label><span>{copy.deal}</span><input list="staff-support-deals" value={dealId} onChange={(event) => setDealId(event.target.value)} /><datalist id="staff-support-deals">{suggestedDealIds.map((id) => <option key={id} value={id} />)}</datalist></label>
          <label><span>{copy.priority}</span><select value={priority} onChange={(event) => setPriority(event.target.value as (typeof PRIORITIES)[number])}>{PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className={styles.full}><span>{copy.subject}</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={300} /></label>
          <label className={styles.full}><span>{copy.description}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} /></label>
          <label className={styles.full}><span>{copy.idempotency}</span><input value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} placeholder={idempotencyPlaceholder} maxLength={128} /></label>
          <button type="button" className={styles.primary} onClick={() => void createCase()} disabled={busy === 'create'}>{copy.create}</button>
        </div>
      )}
      <div className={styles.list}>
        {cases.length === 0 ? <p className={styles.empty}>{loading ? '…' : copy.empty}</p> : cases.map((item) => {
          const id = value(item.id);
          const targetUser = value(item.user_id);
          return (
            <article className={styles.card} key={id}>
              <header><div><strong>{value(item.subject)}</strong><small>{value(item.organization_name)} · {value(item.deal_number || item.deal_id)}</small></div><span className={styles.badge}>{value(item.priority)} · {value(item.status)}</span></header>
              <dl className={styles.details}>
                <div><dt>{copy.user}</dt><dd>{value(item.user_full_name || item.user_email || item.user_id)}</dd></div>
                <div><dt>{copy.version}</dt><dd>{value(item.version)}</dd></div>
                <div><dt>{copy.assignee}</dt><dd>{value(item.assigned_staff_user_id)}</dd></div>
                <div><dt>{copy.status}</dt><dd>{value(item.status)} · {date(item.updated_at, locale)}</dd></div>
              </dl>
              <p>{value(item.description)}</p>
              {canUpdate && (
                <div className={`${styles.form} ${styles.two}`}>
                  <label><span>{copy.status}</span><select value={transitionStatus[id] || ''} onChange={(event) => setTransitionStatus({ ...transitionStatus, [id]: event.target.value })}><option value="">—</option>{STATUSES.filter((status) => status !== item.status).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label><span>{copy.assignee}</span><input value={assignee[id] || ''} onChange={(event) => setAssignee({ ...assignee, [id]: event.target.value })} /></label>
                  <label className={styles.full}><span>{copy.note}</span><textarea value={transitionNote[id] || ''} onChange={(event) => setTransitionNote({ ...transitionNote, [id]: event.target.value })} /></label>
                  <button type="button" className={styles.primary} onClick={() => void transition(item)} disabled={busy === `transition:${id}`}>{copy.transition}</button>
                </div>
              )}
              {targetUser !== '—' && (canRevoke || canRecover) && (
                <div className={styles.grid}>
                  {canRevoke && <div className={styles.form}><label><span>{copy.revokeReason}</span><textarea value={sessionReason[id] || ''} onChange={(event) => setSessionReason({ ...sessionReason, [id]: event.target.value })} /></label><button type="button" className={styles.danger} onClick={() => void revokeSessions(item)} disabled={busy === `revoke:${id}`}>{copy.revoke}</button></div>}
                  {canRecover && <div className={styles.form}><label><span>{copy.recoveryReason}</span><textarea value={recoveryReason[id] || ''} onChange={(event) => setRecoveryReason({ ...recoveryReason, [id]: event.target.value })} /></label><label><span>{copy.ticket}</span><input value={recoveryTicket[id] || ''} onChange={(event) => setRecoveryTicket({ ...recoveryTicket, [id]: event.target.value })} /></label><button type="button" className={styles.button} onClick={() => void initiateRecovery(item)} disabled={busy === `recovery:${id}`}>{copy.recovery}</button></div>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </article>
  );
}
