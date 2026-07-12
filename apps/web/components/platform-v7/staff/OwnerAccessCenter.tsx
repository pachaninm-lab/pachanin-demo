'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppLocale } from '@/i18n/locale';
import type { OwnerAccessCenterCopy } from '@/i18n/owner-access-center-messages';
import styles from './OwnerAccessCenter.module.css';

type StaffIdentity = {
  id?: string;
  email?: string;
  fullName?: string;
};

type StaffAssignment = {
  id: string;
  role: string;
  status: string;
};

type StaffAccessRequest = {
  id: string;
  access_mode: string;
  target_tenant_id?: string | null;
  target_organization_id?: string | null;
  target_deal_id?: string | null;
  permissions?: string[];
  reason?: string;
  ticket_id?: string;
  status: string;
  grant_id?: string | null;
  grant_status?: string | null;
  grant_expires_at?: string | null;
  requested_at?: string;
  expires_at?: string;
};

type StaffSession = {
  id: string;
  actor_user_id?: string;
  staff_role?: string;
  access_mode?: string;
  permissions?: string[];
  effective_organization_id?: string | null;
  effective_role?: string | null;
  ticket_id?: string;
  expires_at?: string;
};

type SessionMetadata = {
  accessSessionId: string;
  staffRole?: string;
  accessMode: string;
  permissions: string[];
  effectiveOrganizationId?: string | null;
  effectiveRole?: string | null;
  targetDealId?: string | null;
  ticketId?: string | null;
  expiresAt: string;
};

type SessionContext = { active: boolean; session: SessionMetadata | null };

type Organization = {
  id: string;
  name: string;
  inn: string;
  status: string;
  kycStatus?: string;
  kyc_status?: string;
  amlStatus?: string;
  aml_status?: string;
};

type CabinetProjection = {
  effectiveOrganization: { id: string; name: string; status?: string };
  effectiveRole: string;
  roleMembers?: number;
  deals: Array<{
    id: string;
    deal_number?: string;
    dealNumber?: string;
    status: string;
    next_action?: string | null;
    nextAction?: string | null;
    updated_at?: string;
    updatedAt?: string;
  }>;
};

type AuditEvent = {
  id: string;
  actor_user_id: string;
  staff_role: string;
  action: string;
  outcome: string;
  correlation_id: string;
  created_at: string;
};

type TaskId =
  | 'browse_organizations'
  | 'view_cabinet'
  | 'investigate_deal'
  | 'assist_user'
  | 'review_money'
  | 'manage_staff'
  | 'diagnostics';

type AccessTask = {
  id: TaskId;
  accessMode: 'CONTROL_PLANE' | 'VIEW_AS' | 'ASSISTED' | 'OPERATIONS' | 'JIT_PRIVILEGED';
  defaultDurationMinutes: number;
  approvalLevel: 'automatic' | 'one_approver' | 'two_approvers';
  requiresOrganization: boolean;
  requiresCabinetRole: boolean;
  allowsDeal: boolean;
  permissionsByRole: Record<string, string[]>;
};

type View = 'home' | 'request' | 'organizations' | 'requests' | 'sessions' | 'more';
type FieldErrors = Partial<Record<'task' | 'assignment' | 'organization' | 'role' | 'ticket' | 'reason', string>>;

type Props = {
  locale: AppLocale;
  copy: OwnerAccessCenterCopy;
  identity: StaffIdentity | null;
  apiAvailable: boolean;
  accessCatalog: AccessTask[];
};

const CABINET_ROLES = [
  'BUYER', 'FARMER', 'LOGISTICIAN', 'DRIVER', 'ELEVATOR', 'LAB',
  'SURVEYOR', 'ACCOUNTING', 'ARBITRATOR', 'COMPLIANCE_OFFICER', 'EXECUTIVE', 'ADMIN',
] as const;

const NAV_ITEMS: Array<{ id: Exclude<View, 'request'>; key: keyof OwnerAccessCenterCopy['nav'] }> = [
  { id: 'home', key: 'home' },
  { id: 'organizations', key: 'organizations' },
  { id: 'requests', key: 'requests' },
  { id: 'sessions', key: 'sessions' },
  { id: 'more', key: 'more' },
];

class StaffApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

function csrfToken() {
  if (typeof document === 'undefined') return '';
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

async function staffApi<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const method = init?.method || 'GET';
  const response = await fetch(`/api/staff/${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() } : {}),
    },
    body: method === 'POST' ? JSON.stringify(init?.body ?? {}) : undefined,
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new StaffApiError(
      response.status,
      typeof payload.code === 'string' ? payload.code : 'STAFF_API_ERROR',
      typeof payload.message === 'string' ? payload.message : 'Staff API request failed',
    );
  }
  return payload as T;
}

function formatDate(value: string | null | undefined, locale: AppLocale) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function targetLabel(request: StaffAccessRequest) {
  return request.target_deal_id || request.target_organization_id || request.target_tenant_id || '—';
}

export function OwnerAccessCenter({ locale, copy, identity, apiAvailable, accessCatalog }: Props) {
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(apiAvailable);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [requests, setRequests] = useState<StaffAccessRequest[]>([]);
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [sessionContext, setSessionContext] = useState<SessionContext>({ active: false, session: null });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [reviewRequests, setReviewRequests] = useState<StaffAccessRequest[]>([]);
  const [reviewSessions, setReviewSessions] = useState<StaffSession[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [cabinet, setCabinet] = useState<CabinetProjection | null>(null);
  const [query, setQuery] = useState('');
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [assignmentId, setAssignmentId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | ''>('');
  const [pendingTaskId, setPendingTaskId] = useState<TaskId | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [targetRole, setTargetRole] = useState('FARMER');
  const [targetDealId, setTargetDealId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyTicket, setEmergencyTicket] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencyConfirmed, setEmergencyConfirmed] = useState(false);
  const [emergencyErrors, setEmergencyErrors] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const emergencyTitleRef = useRef<HTMLHeadingElement>(null);

  const activeAssignment = assignments.find((item) => item.id === assignmentId) || assignments[0];
  const activeRole = activeAssignment?.role || '';
  const selectedTask = accessCatalog.find((item) => item.id === selectedTaskId) || null;
  const selectedPermissions = selectedTask?.permissionsByRole[activeRole] || [];
  const permissions = sessionContext.session?.permissions || [];
  const can = useCallback((permission: string) => permissions.includes(permission), [permissions]);

  const availableTasks = useMemo(
    () => accessCatalog.filter((task) => (task.permissionsByRole[activeRole] || []).length > 0),
    [accessCatalog, activeRole],
  );

  const filteredOrganizations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return organizations;
    return organizations.filter((item) => `${item.name} ${item.inn}`.toLocaleLowerCase(locale).includes(normalized));
  }, [organizations, query, locale]);

  const pendingOwn = requests.filter((item) => item.status === 'PENDING').length;
  const activeSessionId = sessionContext.session?.accessSessionId;
  const canBreakGlass = assignments.some((item) => ['PLATFORM_OWNER', 'SRE_ONCALL', 'BREAK_GLASS_ADMIN'].includes(item.role));

  const roleLabel = useCallback((role?: string | null) => {
    if (!role) return '—';
    return (copy.roles as Record<string, string>)[role]
      || (copy.cabinetRoles as Record<string, string>)[role]
      || role;
  }, [copy]);

  const modeLabel = useCallback((mode?: string | null) => {
    if (!mode) return '—';
    return (copy.modes as Record<string, string>)[mode] || mode;
  }, [copy]);

  const statusLabel = useCallback((status?: string | null) => {
    if (!status) return '—';
    return (copy.statuses as Record<string, string>)[status] || status;
  }, [copy]);

  const translateError = useCallback((value: unknown) => {
    if (value instanceof StaffApiError) {
      if (value.status === 401) return copy.errors.unauthenticated;
      if (value.status === 403 && value.code === 'CSRF_REJECTED') return copy.errors.csrf;
      if (value.status === 403) return copy.errors.forbidden;
      if (value.status === 409) return copy.errors.conflict;
      return value.message || copy.errors.generic;
    }
    return copy.errors.generic;
  }, [copy]);

  const loadPrivileged = useCallback(async (context: SessionContext) => {
    const activePermissions = context.session?.permissions || [];
    const jobs: Promise<void>[] = [];

    if (activePermissions.includes('organization:list')) {
      jobs.push(staffApi<Organization[]>('organizations').then((rows) => setOrganizations(rows || [])));
    } else setOrganizations([]);

    if (activePermissions.includes('staff-request:read')) {
      jobs.push(staffApi<StaffAccessRequest[]>('access/requests/review').then((rows) => setReviewRequests(rows || [])));
    } else setReviewRequests([]);

    if (activePermissions.includes('staff-session:read')) {
      jobs.push(staffApi<StaffSession[]>('access/sessions/review').then((rows) => setReviewSessions(rows || [])));
    } else setReviewSessions([]);

    if (activePermissions.includes('audit:read')) {
      jobs.push(staffApi<{ items: AuditEvent[] }>('audit/events?limit=30').then((value) => setAuditEvents(value.items || [])));
    } else setAuditEvents([]);

    const session = context.session;
    if (context.active && session?.accessMode === 'VIEW_AS' && session.effectiveOrganizationId && session.effectiveRole) {
      const org = encodeURIComponent(session.effectiveOrganizationId);
      const role = encodeURIComponent(session.effectiveRole);
      jobs.push(staffApi<CabinetProjection>(`organizations/${org}/cabinet/${role}`).then(setCabinet));
    } else setCabinet(null);

    await Promise.all(jobs);
  }, []);

  const reload = useCallback(async () => {
    if (!apiAvailable) return;
    setError(null);
    try {
      const [assignmentRows, requestRows, sessionRows, context] = await Promise.all([
        staffApi<StaffAssignment[]>('assignments/me'),
        staffApi<StaffAccessRequest[]>('access/requests'),
        staffApi<StaffSession[]>('access/sessions'),
        staffApi<SessionContext>('session-context'),
      ]);
      setAssignments(assignmentRows || []);
      setRequests(requestRows || []);
      setSessions(sessionRows || []);
      setSessionContext(context);
      setAssignmentId((current) => current || assignmentRows?.[0]?.id || '');
      await loadPrivileged(context);
    } catch (value) {
      setError(translateError(value));
    } finally {
      setLoading(false);
      document.documentElement.dataset.staffControlReady = 'true';
      window.dispatchEvent(new Event('pc:staff-control-ready'));
    }
  }, [apiAvailable, loadPrivileged, translateError]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const handler = () => void reload();
    window.addEventListener('pc:staff-session-changed', handler);
    return () => window.removeEventListener('pc:staff-session-changed', handler);
  }, [reload]);
  useEffect(() => () => { delete document.documentElement.dataset.staffControlReady; }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (emergencyOpen) emergencyTitleRef.current?.focus();
  }, [emergencyOpen]);

  const chooseTask = (taskId: TaskId) => {
    if (sessionContext.active) {
      setError(copy.request.activeSessionBlock);
      return;
    }
    const task = accessCatalog.find((item) => item.id === taskId);
    setSelectedTaskId(taskId);
    setDurationMinutes(task?.defaultDurationMinutes || 15);
    setFieldErrors({});
    setError(null);
    setView('request');
  };

  const openOrganizationSearch = () => {
    if (selectedTaskId && selectedTaskId !== 'browse_organizations') setPendingTaskId(selectedTaskId);
    chooseTask('browse_organizations');
  };

  const activateGrant = async (grantId: string) => {
    if (sessionContext.active) {
      setError(copy.request.activeSessionBlock);
      return;
    }
    setBusy(`activate:${grantId}`);
    setError(null);
    try {
      await staffApi(`access/grants/${encodeURIComponent(grantId)}/activate`, { method: 'POST', body: {} });
      await reload();
      window.dispatchEvent(new Event('pc:staff-session-changed'));
      setNotice(copy.request.activated);
      if (pendingTaskId) {
        const resume = pendingTaskId;
        setPendingTaskId(null);
        setSelectedTaskId(resume);
        setDurationMinutes(accessCatalog.find((item) => item.id === resume)?.defaultDurationMinutes || 15);
        setView('request');
      } else {
        setView('home');
      }
    } catch (value) {
      setError(translateError(value));
    } finally {
      setBusy(null);
    }
  };

  const validateRequest = () => {
    const next: FieldErrors = {};
    if (!selectedTask) next.task = copy.fieldErrors.task;
    if (!activeAssignment) next.assignment = copy.fieldErrors.assignment;
    if (selectedTask?.requiresOrganization && !organizationId.trim()) next.organization = copy.fieldErrors.organization;
    if (selectedTask?.requiresCabinetRole && !targetRole) next.role = copy.fieldErrors.role;
    if (ticketId.trim().length < 3) next.ticket = copy.fieldErrors.ticket;
    if (reason.trim().length < 10) next.reason = copy.fieldErrors.reason;
    setFieldErrors(next);
    const first = Object.keys(next)[0];
    if (first) window.requestAnimationFrame(() => document.getElementById(`owner-access-${first}`)?.focus());
    return Object.keys(next).length === 0;
  };

  const submitRequest = async () => {
    if (!validateRequest() || !selectedTask || !activeAssignment) return;
    setBusy('request');
    setError(null);
    setNotice(null);
    try {
      const result = await staffApi<{ status: string; grantId?: string | null }>('access/requests', {
        method: 'POST',
        body: {
          assignmentId: activeAssignment.id,
          accessMode: selectedTask.accessMode,
          permissions: selectedPermissions,
          ...(organizationId.trim() ? { targetOrganizationId: organizationId.trim() } : {}),
          ...(selectedTask.requiresCabinetRole ? { targetRole } : {}),
          ...(selectedTask.allowsDeal && targetDealId.trim() ? { targetDealId: targetDealId.trim() } : {}),
          reason: reason.trim(),
          ticketId: ticketId.trim(),
          durationSeconds: durationMinutes * 60,
        },
      });
      setReason('');
      if (result.grantId) {
        setBusy(null);
        await activateGrant(result.grantId);
      } else {
        setNotice(copy.request.sent);
        await reload();
        setView('requests');
      }
    } catch (value) {
      setError(translateError(value));
    } finally {
      setBusy(null);
    }
  };

  const endSession = async (sessionId: string) => {
    setBusy(`end:${sessionId}`);
    setError(null);
    try {
      await staffApi(`access/sessions/${encodeURIComponent(sessionId)}/end`, {
        method: 'POST',
        body: { reason: 'Staff actor ended the protected session' },
      });
      await reload();
      window.dispatchEvent(new Event('pc:staff-session-changed'));
      setNotice(null);
    } catch (value) {
      setError(translateError(value));
    } finally {
      setBusy(null);
    }
  };

  const decideRequest = async (requestId: string, decision: 'APPROVE' | 'DENY') => {
    const decisionReason = decisionReasons[requestId]?.trim();
    if (!decisionReason || decisionReason.length < 5) {
      setError(copy.more.decisionPlaceholder);
      return;
    }
    setBusy(`decision:${requestId}`);
    setError(null);
    try {
      await staffApi(`access/requests/${encodeURIComponent(requestId)}/decision`, {
        method: 'POST',
        body: { decision, reason: decisionReason },
      });
      setDecisionReasons((current) => ({ ...current, [requestId]: '' }));
      await reload();
    } catch (value) {
      setError(translateError(value));
    } finally {
      setBusy(null);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setBusy(`revoke:${sessionId}`);
    setError(null);
    try {
      await staffApi(`access/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: 'POST',
        body: { reason: 'Revoked from Owner Access Center' },
      });
      await reload();
    } catch (value) {
      setError(translateError(value));
    } finally {
      setBusy(null);
    }
  };

  const activateEmergency = async () => {
    const next: Record<string, string> = {};
    if (!activeAssignment) next.assignment = copy.fieldErrors.assignment;
    if (emergencyTicket.trim().length < 3) next.ticket = copy.fieldErrors.ticket;
    if (emergencyReason.trim().length < 20) next.reason = copy.fieldErrors.emergencyReason;
    if (!emergencyConfirmed) next.confirmation = copy.fieldErrors.confirmation;
    setEmergencyErrors(next);
    if (Object.keys(next).length > 0 || !activeAssignment) return;

    setBusy('emergency');
    setError(null);
    try {
      await staffApi('break-glass/activate', {
        method: 'POST',
        body: { assignmentId: activeAssignment.id, ticketId: emergencyTicket.trim(), reason: emergencyReason.trim() },
      });
      setEmergencyOpen(false);
      setEmergencyTicket('');
      setEmergencyReason('');
      setEmergencyConfirmed(false);
      setNotice(copy.emergency.success);
    } catch (value) {
      setError(translateError(value));
    } finally {
      setBusy(null);
    }
  };

  const selectOrganization = (organization: Organization) => {
    setOrganizationId(organization.id);
    setTargetRole('FARMER');
    chooseTask('view_cabinet');
  };

  const remainingMinutes = sessionContext.session
    ? Math.max(0, Math.ceil((new Date(sessionContext.session.expiresAt).getTime() - now) / 60_000))
    : 0;

  if (!apiAvailable) {
    return <main className={styles.page}><section className={styles.stateCard}><h1>{copy.unavailableTitle}</h1><p>{copy.unavailableBody}</p><Link href="/platform-v7" className={styles.primaryButton}>{copy.back}</Link></section></main>;
  }

  if (loading) {
    return <main className={styles.page}><section className={styles.loadingCard} aria-live="polite"><span className={styles.spinner} /><strong>{copy.loading}</strong></section></main>;
  }

  if (assignments.length === 0) {
    return <main className={styles.page}><section className={styles.stateCard}><h1>{copy.noAssignmentTitle}</h1><p>{copy.noAssignmentBody}</p><Link href="/platform-v7" className={styles.primaryButton}>{copy.back}</Link></section></main>;
  }

  return (
    <main className={styles.page} data-owner-access-center data-locale={locale}>
      {sessionContext.active && sessionContext.session && (
        <section className={styles.activeSessionBar} aria-label={copy.activeSession.label}>
          <div>
            <span>{copy.activeSession.label}</span>
            <strong>{modeLabel(sessionContext.session.accessMode)}</strong>
            <small>{copy.activeSession.remaining}: {remainingMinutes} {copy.request.minutes}</small>
          </div>
          <button type="button" onClick={() => void endSession(sessionContext.session!.accessSessionId)} disabled={busy === `end:${sessionContext.session.accessSessionId}`}>
            {busy === `end:${sessionContext.session.accessSessionId}` ? copy.activeSession.ending : copy.activeSession.end}
          </button>
        </section>
      )}

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void reload()} disabled={Boolean(busy)}>
          {busy ? copy.refreshing : copy.refresh}
        </button>
      </header>

      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label={copy.close}>×</button></div>}
      {notice && <div className={styles.notice} role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label={copy.close}>×</button></div>}

      {view === 'home' && (
        <>
          <section className={styles.statusGrid} aria-label={copy.home.attention}>
            <article>
              <span>{copy.home.role}</span>
              <strong>{roleLabel(activeRole)}</strong>
              <small>{identity?.email || identity?.fullName || identity?.id}</small>
            </article>
            <article>
              <span>{sessionContext.active ? copy.home.protectedMode : copy.home.ordinaryMode}</span>
              <strong>{sessionContext.active ? modeLabel(sessionContext.session?.accessMode) : copy.home.protectedInactive}</strong>
              <small>{sessionContext.active ? copy.home.protectedActive : copy.home.protectedInactive}</small>
            </article>
          </section>

          <section className={styles.attentionPanel}>
            <div className={styles.sectionHeading}><div><h2>{copy.home.attention}</h2></div></div>
            {pendingOwn === 0 && sessions.length === 0 && reviewRequests.length === 0 ? (
              <p className={styles.empty}>{copy.home.noAttention}</p>
            ) : (
              <div className={styles.metricRow}>
                <button type="button" onClick={() => setView('requests')}><strong>{pendingOwn}</strong><span>{copy.home.pendingRequests}</span></button>
                <button type="button" onClick={() => setView('sessions')}><strong>{sessions.length}</strong><span>{copy.home.activeSessions}</span></button>
                <button type="button" onClick={() => setView('more')}><strong>{reviewRequests.filter((item) => item.status === 'PENDING').length}</strong><span>{copy.home.reviewRequests}</span></button>
              </div>
            )}
          </section>

          <section className={styles.tasksSection}>
            <div className={styles.sectionHeading}><div><h2>{copy.home.tasksTitle}</h2><p>{copy.home.tasksDescription}</p></div></div>
            <div className={styles.taskGrid}>
              {availableTasks.map((task, index) => (
                <button key={task.id} type="button" className={styles.taskCard} onClick={() => chooseTask(task.id)}>
                  <span className={styles.taskNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{copy.tasks[task.id].title}</strong>
                  <p>{copy.tasks[task.id].description}</p>
                  <span className={styles.taskAction}>{copy.continue} →</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.recentPanel}>
            <div className={styles.sectionHeading}><h2>{copy.home.recent}</h2><button type="button" onClick={() => setView('requests')}>{copy.home.seeAll}</button></div>
            <RequestList requests={requests.slice(0, 3)} copy={copy} locale={locale} modeLabel={modeLabel} statusLabel={statusLabel} busy={busy} onActivate={activateGrant} activeSession={sessionContext.active} />
          </section>
        </>
      )}

      {view === 'request' && selectedTask && (
        <section className={styles.requestPanel}>
          <div className={styles.sectionHeading}>
            <div><h2>{copy.request.title}</h2><p>{copy.tasks[selectedTask.id].description}</p></div>
            <button type="button" className={styles.textButton} onClick={() => setView('home')}>{copy.cancel}</button>
          </div>

          <ol className={styles.steps} aria-label={copy.request.title}>
            <li className={styles.stepDone}>{copy.request.stepTask}</li>
            <li className={styles.stepActive}>{copy.request.stepScope}</li>
            <li>{copy.request.stepConfirm}</li>
          </ol>

          <div className={styles.selectedTask}>
            <div><span>{copy.request.selectedTask}</span><strong>{copy.tasks[selectedTask.id].title}</strong></div>
            <button type="button" onClick={() => setView('home')}>{copy.request.changeTask}</button>
          </div>

          {selectedTask.requiresOrganization && organizations.length === 0 && !organizationId ? (
            <div className={styles.bootstrapCard}>
              <h3>{copy.organizations.lockedTitle}</h3>
              <p>{copy.request.needOrganizationSearch}</p>
              <button type="button" className={styles.primaryButton} onClick={openOrganizationSearch}>{copy.request.openOrganizationSearch}</button>
            </div>
          ) : (
            <>
              <div className={styles.formGrid}>
                <label>
                  <span>{copy.request.assignment}</span>
                  <select id="owner-access-assignment" value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)} aria-invalid={Boolean(fieldErrors.assignment)}>
                    {assignments.map((item) => <option key={item.id} value={item.id}>{roleLabel(item.role)} · {statusLabel(item.status)}</option>)}
                  </select>
                  {fieldErrors.assignment && <small className={styles.fieldError}>{fieldErrors.assignment}</small>}
                </label>

                {selectedTask.requiresOrganization && (
                  <label>
                    <span>{copy.request.organization}</span>
                    {organizations.length > 0 ? (
                      <select id="owner-access-organization" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} aria-invalid={Boolean(fieldErrors.organization)}>
                        <option value="">{copy.request.organizationPlaceholder}</option>
                        {organizations.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.inn}</option>)}
                      </select>
                    ) : (
                      <input id="owner-access-organization" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder={copy.request.organizationIdPlaceholder} aria-invalid={Boolean(fieldErrors.organization)} />
                    )}
                    {fieldErrors.organization && <small className={styles.fieldError}>{fieldErrors.organization}</small>}
                  </label>
                )}

                {selectedTask.requiresCabinetRole && (
                  <label>
                    <span>{copy.request.cabinetRole}</span>
                    <select id="owner-access-role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} aria-invalid={Boolean(fieldErrors.role)}>
                      {CABINET_ROLES.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
                    </select>
                    {fieldErrors.role && <small className={styles.fieldError}>{fieldErrors.role}</small>}
                  </label>
                )}

                {selectedTask.allowsDeal && (
                  <label>
                    <span>{copy.request.deal}</span>
                    <input value={targetDealId} onChange={(event) => setTargetDealId(event.target.value)} placeholder={copy.request.dealPlaceholder} maxLength={128} />
                  </label>
                )}

                <label>
                  <span>{copy.request.ticket}</span>
                  <input id="owner-access-ticket" value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder={copy.request.ticketPlaceholder} maxLength={128} aria-invalid={Boolean(fieldErrors.ticket)} />
                  {fieldErrors.ticket && <small className={styles.fieldError}>{fieldErrors.ticket}</small>}
                </label>

                <label>
                  <span>{copy.request.duration}</span>
                  <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                    {[5, 10, 15, 30, 60].map((item) => <option key={item} value={item}>{item} {copy.request.minutes}</option>)}
                  </select>
                </label>

                <label className={styles.fullWidth}>
                  <span>{copy.request.reason}</span>
                  <textarea id="owner-access-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.request.reasonPlaceholder} maxLength={2000} rows={4} aria-invalid={Boolean(fieldErrors.reason)} />
                  {fieldErrors.reason && <small className={styles.fieldError}>{fieldErrors.reason}</small>}
                </label>
              </div>

              <div className={styles.confirmGrid}>
                <article><span>{copy.request.approval}</span><strong>{selectedTask.approvalLevel === 'automatic' ? copy.request.approvalAutomatic : selectedTask.approvalLevel === 'one_approver' ? copy.request.approvalOne : copy.request.approvalTwo}</strong></article>
                <article><span>{copy.request.protection}</span><strong>{copy.request.protectionText}</strong></article>
              </div>

              <details className={styles.technicalDetails}>
                <summary>{copy.request.technicalDetails}</summary>
                <dl><div><dt>Mode</dt><dd>{modeLabel(selectedTask.accessMode)}</dd></div><div><dt>{copy.request.permissions}</dt><dd>{selectedPermissions.join(', ')}</dd></div></dl>
              </details>

              <button type="button" className={styles.primaryButton} onClick={() => void submitRequest()} disabled={busy === 'request' || sessionContext.active}>
                {busy === 'request' ? copy.request.submitting : selectedTask.approvalLevel === 'automatic' ? copy.request.submit : copy.request.send}
              </button>
            </>
          )}
        </section>
      )}

      {view === 'organizations' && (
        <section className={styles.contentPanel}>
          <div className={styles.sectionHeading}><div><h2>{copy.organizations.title}</h2><p>{copy.organizations.description}</p></div></div>
          {!can('organization:list') ? (
            <div className={styles.lockedCard}><h3>{copy.organizations.lockedTitle}</h3><p>{copy.organizations.lockedBody}</p><button type="button" className={styles.primaryButton} onClick={openOrganizationSearch}>{copy.organizations.unlock}</button></div>
          ) : (
            <>
              <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.organizations.search} aria-label={copy.organizations.search} />
              <div className={styles.organizationList}>
                {filteredOrganizations.length === 0 ? <p className={styles.empty}>{copy.organizations.empty}</p> : filteredOrganizations.map((item) => (
                  <article key={item.id} className={styles.organizationCard}>
                    <div><strong>{item.name}</strong><small>{copy.organizations.inn}: {item.inn}</small></div>
                    <dl><div><dt>{copy.organizations.status}</dt><dd>{item.status}</dd></div><div><dt>{copy.organizations.kyc}</dt><dd>{item.kycStatus || item.kyc_status || '—'}</dd></div><div><dt>{copy.organizations.aml}</dt><dd>{item.amlStatus || item.aml_status || '—'}</dd></div></dl>
                    <button type="button" className={styles.secondaryButton} onClick={() => selectOrganization(item)} disabled={sessionContext.active}>{copy.organizations.view}</button>
                  </article>
                ))}
              </div>
            </>
          )}

          {cabinet && (
            <article className={styles.cabinetCard}>
              <div className={styles.sectionHeading}><div><h3>{cabinet.effectiveOrganization.name}</h3><p>{roleLabel(cabinet.effectiveRole)} · {copy.activeSession.readOnly}</p></div></div>
              <div className={styles.dealList}>{cabinet.deals.length === 0 ? <p className={styles.empty}>{copy.organizations.empty}</p> : cabinet.deals.map((deal) => <article key={deal.id}><strong>{deal.dealNumber || deal.deal_number || deal.id}</strong><span>{deal.status}</span><small>{deal.nextAction || deal.next_action || '—'} · {formatDate(deal.updatedAt || deal.updated_at, locale)}</small></article>)}</div>
            </article>
          )}
        </section>
      )}

      {view === 'requests' && (
        <section className={styles.contentPanel}>
          <div className={styles.sectionHeading}><h2>{copy.requests.title}</h2></div>
          <RequestList requests={requests} copy={copy} locale={locale} modeLabel={modeLabel} statusLabel={statusLabel} busy={busy} onActivate={activateGrant} activeSession={sessionContext.active} />
        </section>
      )}

      {view === 'sessions' && (
        <section className={styles.contentPanel}>
          <div className={styles.sectionHeading}><div><h2>{copy.sessions.title}</h2><p>{copy.sessions.description}</p></div></div>
          {sessions.length === 0 ? <p className={styles.empty}>{copy.sessions.empty}</p> : <div className={styles.sessionList}>{sessions.map((item) => <article key={item.id}><div><strong>{modeLabel(item.access_mode)}</strong><small>{copy.sessions.expires}: {formatDate(item.expires_at, locale)}</small></div><button type="button" className={styles.dangerTextButton} onClick={() => void endSession(item.id)} disabled={busy === `end:${item.id}`}>{copy.sessions.end}</button></article>)}</div>}
        </section>
      )}

      {view === 'more' && (
        <section className={styles.moreGrid}>
          <article className={styles.contentPanel}>
            <div className={styles.sectionHeading}><div><h2>{copy.more.approvals}</h2><p>{copy.more.approvalsDescription}</p></div></div>
            {!can('staff-request:read') ? (
              <LockedAccess copy={copy} onOpen={() => chooseTask('manage_staff')} />
            ) : reviewRequests.length === 0 ? <p className={styles.empty}>{copy.more.noApprovals}</p> : <div className={styles.reviewList}>{reviewRequests.map((item) => <article key={item.id}><header><div><strong>{modeLabel(item.access_mode)}</strong><small>{item.ticket_id || '—'} · {formatDate(item.requested_at, locale)}</small></div><span>{statusLabel(item.status)}</span></header><p>{item.reason}</p>{item.status === 'PENDING' && can('staff-request:approve') && <><textarea rows={2} value={decisionReasons[item.id] || ''} onChange={(event) => setDecisionReasons((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={copy.more.decisionPlaceholder} /><div className={styles.inlineActions}><button type="button" className={styles.primaryButton} onClick={() => void decideRequest(item.id, 'APPROVE')} disabled={busy === `decision:${item.id}`}>{copy.more.approve}</button><button type="button" className={styles.dangerButton} onClick={() => void decideRequest(item.id, 'DENY')} disabled={busy === `decision:${item.id}`}>{copy.more.deny}</button></div></>}</article>)}</div>}
          </article>

          <article className={styles.contentPanel}>
            <div className={styles.sectionHeading}><h2>{copy.more.activeStaffSessions}</h2></div>
            {!can('staff-session:read') ? <LockedAccess copy={copy} onOpen={() => chooseTask('manage_staff')} /> : reviewSessions.length === 0 ? <p className={styles.empty}>{copy.more.noStaffSessions}</p> : <div className={styles.sessionList}>{reviewSessions.map((item) => <article key={item.id}><div><strong>{roleLabel(item.staff_role)} · {modeLabel(item.access_mode)}</strong><small>{item.actor_user_id} · {formatDate(item.expires_at, locale)}</small></div>{can('staff-session:revoke') && item.id !== activeSessionId && <button type="button" className={styles.dangerTextButton} onClick={() => void revokeSession(item.id)} disabled={busy === `revoke:${item.id}`}>{copy.more.revoke}</button>}</article>)}</div>}
          </article>

          <article className={styles.contentPanel}>
            <div className={styles.sectionHeading}><div><h2>{copy.more.audit}</h2><p>{copy.more.auditDescription}</p></div></div>
            {!can('audit:read') ? <LockedAccess copy={copy} onOpen={() => chooseTask('manage_staff')} /> : auditEvents.length === 0 ? <p className={styles.empty}>{copy.more.noAudit}</p> : <div className={styles.auditList}>{auditEvents.map((item) => <article key={item.id}><div><strong>{item.action}</strong><span>{statusLabel(item.outcome)}</span></div><dl><div><dt>{copy.more.actor}</dt><dd>{item.actor_user_id} · {roleLabel(item.staff_role)}</dd></div><div><dt>{copy.more.time}</dt><dd>{formatDate(item.created_at, locale)}</dd></div><div><dt>{copy.more.correlation}</dt><dd>{item.correlation_id}</dd></div></dl></article>)}</div>}
          </article>

          {canBreakGlass && <article className={`${styles.contentPanel} ${styles.emergencyCard}`}><div><h2>{copy.emergency.title}</h2><p>{copy.emergency.description}</p></div><button type="button" className={styles.dangerButton} onClick={() => setEmergencyOpen(true)}>{copy.emergency.open}</button></article>}
        </section>
      )}

      <nav className={styles.bottomNav} aria-label={copy.title}>
        {NAV_ITEMS.map((item) => <button key={item.id} type="button" className={view === item.id ? styles.navActive : ''} onClick={() => setView(item.id)} aria-current={view === item.id ? 'page' : undefined}><span aria-hidden="true" /><strong>{copy.nav[item.key]}</strong></button>)}
      </nav>

      {emergencyOpen && (
        <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEmergencyOpen(false); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="emergency-title">
            <button type="button" className={styles.dialogClose} onClick={() => setEmergencyOpen(false)} aria-label={copy.close}>×</button>
            <h2 id="emergency-title" ref={emergencyTitleRef} tabIndex={-1}>{copy.emergency.title}</h2>
            <p>{copy.emergency.description}</p>
            <label><span>{copy.emergency.incident}</span><input value={emergencyTicket} onChange={(event) => setEmergencyTicket(event.target.value)} placeholder={copy.emergency.incidentPlaceholder} aria-invalid={Boolean(emergencyErrors.ticket)} />{emergencyErrors.ticket && <small className={styles.fieldError}>{emergencyErrors.ticket}</small>}</label>
            <label><span>{copy.emergency.reason}</span><textarea value={emergencyReason} onChange={(event) => setEmergencyReason(event.target.value)} placeholder={copy.emergency.reasonPlaceholder} rows={5} aria-invalid={Boolean(emergencyErrors.reason)} />{emergencyErrors.reason && <small className={styles.fieldError}>{emergencyErrors.reason}</small>}</label>
            <label className={styles.confirm}><input type="checkbox" checked={emergencyConfirmed} onChange={(event) => setEmergencyConfirmed(event.target.checked)} /><span>{copy.emergency.confirm}</span></label>
            {emergencyErrors.confirmation && <small className={styles.fieldError}>{emergencyErrors.confirmation}</small>}
            <button type="button" className={styles.dangerButton} onClick={() => void activateEmergency()} disabled={busy === 'emergency'}>{busy === 'emergency' ? copy.emergency.activating : copy.emergency.activate}</button>
          </section>
        </div>
      )}
    </main>
  );
}

function LockedAccess({ copy, onOpen }: { copy: OwnerAccessCenterCopy; onOpen: () => void }) {
  return <div className={styles.lockedCard}><p>{copy.more.locked}</p><button type="button" className={styles.secondaryButton} onClick={onOpen}>{copy.more.openAccess}</button></div>;
}

function RequestList({ requests, copy, locale, modeLabel, statusLabel, busy, onActivate, activeSession }: {
  requests: StaffAccessRequest[];
  copy: OwnerAccessCenterCopy;
  locale: AppLocale;
  modeLabel: (value?: string | null) => string;
  statusLabel: (value?: string | null) => string;
  busy: string | null;
  onActivate: (grantId: string) => Promise<void>;
  activeSession: boolean;
}) {
  if (requests.length === 0) return <p className={styles.empty}>{copy.requests.empty}</p>;
  return <div className={styles.requestList}>{requests.map((item) => {
    const grantId = item.grant_id;
    const activatable = Boolean(grantId && ['GRANTED', 'ACTIVE'].includes(item.grant_status || item.status));
    return <article key={item.id}><header><div><strong>{modeLabel(item.access_mode)}</strong><small>{item.ticket_id || '—'} · {formatDate(item.requested_at, locale)}</small></div><span>{statusLabel(item.status)}</span></header><dl><div><dt>{copy.requests.target}</dt><dd>{targetLabel(item)}</dd></div><div><dt>{copy.requests.expires}</dt><dd>{formatDate(item.grant_expires_at || item.expires_at, locale)}</dd></div></dl>{activatable && grantId && <button type="button" className={styles.primaryButton} onClick={() => void onActivate(grantId)} disabled={activeSession || busy === `activate:${grantId}`}>{busy === `activate:${grantId}` ? copy.requests.activating : copy.requests.activate}</button>}</article>;
  })}</div>;
}
