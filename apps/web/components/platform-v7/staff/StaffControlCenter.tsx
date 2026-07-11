'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppLocale } from '@/i18n/locale';
import type { StaffControlCenterCopy } from '@/i18n/staff-control-center-messages';
import styles from './StaffControlCenter.module.css';

type StaffIdentity = {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
  organizationId?: string;
  tenantId?: string;
};

type StaffAssignment = {
  id: string;
  role: string;
  status: string;
  valid_from?: string;
  valid_until?: string | null;
};

type StaffAccessRequest = {
  id: string;
  requester_user_id?: string;
  assignment_id?: string;
  access_mode: string;
  target_tenant_id?: string | null;
  target_organization_id?: string | null;
  target_user_id?: string | null;
  target_role?: string | null;
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
  effective_tenant_id?: string | null;
  effective_organization_id?: string | null;
  effective_user_id?: string | null;
  effective_role?: string | null;
  target_deal_id?: string | null;
  reason?: string;
  ticket_id?: string;
  expires_at?: string;
  created_at?: string;
};

type SessionMetadata = {
  accessSessionId: string;
  staffRole?: string;
  accessMode: string;
  permissions: string[];
  effectiveTenantId?: string | null;
  effectiveOrganizationId?: string | null;
  effectiveUserId?: string | null;
  effectiveRole?: string | null;
  targetDealId?: string | null;
  reason?: string | null;
  ticketId?: string | null;
  expiresAt: string;
};

type SessionContext = { active: boolean; session: SessionMetadata | null };

type Organization = {
  id: string;
  tenantId?: string;
  tenant_id?: string;
  name: string;
  inn: string;
  status: string;
  kycStatus?: string;
  kyc_status?: string;
  amlStatus?: string;
  aml_status?: string;
};

type CabinetProjection = {
  mode: string;
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
  effective_organization_id?: string | null;
  ticket_id?: string | null;
};

type Tab = 'overview' | 'access' | 'organizations' | 'review' | 'audit';
type AccessMode = 'CONTROL_PLANE' | 'VIEW_AS' | 'ASSISTED' | 'OPERATIONS' | 'JIT_PRIVILEGED';

type Props = {
  locale: AppLocale;
  copy: StaffControlCenterCopy;
  identity: StaffIdentity | null;
  apiAvailable: boolean;
};

class StaffApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

const CABINET_ROLES = [
  'BUYER', 'FARMER', 'LOGISTICIAN', 'DRIVER', 'ELEVATOR', 'LAB',
  'SURVEYOR', 'ACCOUNTING', 'ARBITRATOR', 'COMPLIANCE_OFFICER', 'EXECUTIVE', 'ADMIN',
] as const;

const ACCESS_PRESETS: Record<string, Partial<Record<AccessMode, string[]>>> = {
  PLATFORM_OWNER: {
    CONTROL_PLANE: ['organization:list', 'user:list', 'staff-request:read', 'staff-request:approve', 'staff-session:read', 'staff-session:revoke', 'audit:read'],
    VIEW_AS: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
    ASSISTED: ['cabinet:assisted-action', 'deal:read'],
    OPERATIONS: ['deal:list', 'deal:read', 'deal:blocker:read', 'deal:operation:retry', 'document:metadata:read'],
    JIT_PRIVILEGED: ['diagnostic:read', 'critical-action:request'],
  },
  PLATFORM_ADMIN: {
    CONTROL_PLANE: ['organization:list', 'user:list', 'staff-request:read', 'staff-request:approve', 'staff-session:read', 'staff-session:revoke', 'audit:read'],
    VIEW_AS: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
    ASSISTED: ['cabinet:assisted-action', 'deal:read'],
    OPERATIONS: ['deal:list', 'deal:read', 'deal:blocker:read', 'deal:operation:retry'],
    JIT_PRIVILEGED: ['diagnostic:read', 'critical-action:request'],
  },
  SUPPORT_L1: {
    CONTROL_PLANE: ['organization:read', 'user:read', 'support-case:read'],
  },
  SUPPORT_L2: {
    CONTROL_PLANE: ['organization:read', 'user:read', 'support-case:read', 'support-case:update'],
    VIEW_AS: ['cabinet:view-as', 'deal:read', 'document:metadata:read', 'document:content:read'],
    ASSISTED: ['cabinet:assisted-action', 'deal:read'],
  },
  OPERATIONS_AGENT: {
    CONTROL_PLANE: ['deal:list', 'deal:read', 'deal:blocker:read'],
    VIEW_AS: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
    OPERATIONS: ['deal:list', 'deal:read', 'deal:blocker:read', 'deal:operation:retry', 'document:request'],
  },
  OPERATIONS_SUPERVISOR: {
    CONTROL_PLANE: ['deal:list', 'deal:read', 'deal:blocker:read', 'staff-request:read', 'staff-request:approve'],
    VIEW_AS: ['cabinet:view-as', 'deal:read', 'document:metadata:read'],
    OPERATIONS: ['deal:list', 'deal:read', 'deal:blocker:read', 'deal:operation:retry', 'document:request', 'manual-review:route'],
    JIT_PRIVILEGED: ['diagnostic:read', 'critical-action:request'],
  },
  FINANCE_OPS: {
    CONTROL_PLANE: ['payment:read', 'bank-event:read', 'reconciliation:read'],
    JIT_PRIVILEGED: ['payment:read', 'bank-event:read', 'reconciliation:read', 'reconciliation:route', 'critical-action:request'],
  },
  COMPLIANCE_STAFF: {
    CONTROL_PLANE: ['organization:list', 'user:list', 'staff-request:read', 'staff-request:approve', 'audit:read'],
    VIEW_AS: ['cabinet:view-as', 'deal:read', 'document:metadata:read', 'document:content:read'],
    JIT_PRIVILEGED: ['diagnostic:read', 'critical-action:request'],
  },
  DEVELOPER: {
    CONTROL_PLANE: ['diagnostic:read', 'deployment:read', 'feature-flag:read'],
    JIT_PRIVILEGED: ['diagnostic:read', 'deployment:read', 'feature-flag:read', 'critical-action:request'],
  },
  SRE_ONCALL: {
    CONTROL_PLANE: ['diagnostic:read', 'deployment:read', 'feature-flag:read'],
    JIT_PRIVILEGED: ['diagnostic:read', 'deployment:read', 'feature-flag:read', 'feature-flag:write', 'critical-action:request'],
  },
  SECURITY_AUDITOR: {
    CONTROL_PLANE: ['staff-assignment:read', 'staff-request:read', 'staff-session:read', 'audit:read'],
  },
  BREAK_GLASS_ADMIN: {
    CONTROL_PLANE: ['staff-session:read', 'staff-session:revoke', 'audit:read'],
  },
};

const BREAK_GLASS_ROLES = new Set(['PLATFORM_OWNER', 'SRE_ONCALL', 'BREAK_GLASS_ADMIN']);

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
    dateStyle: 'short', timeStyle: 'short',
  }).format(date);
}

function statusLabel(copy: StaffControlCenterCopy, status?: string | null) {
  if (!status) return '—';
  return (copy.statuses as Record<string, string>)[status] || status;
}

function roleLabel(copy: StaffControlCenterCopy, role?: string | null) {
  if (!role) return '—';
  return (copy.roles as Record<string, string>)[role]
    || (copy.cabinetRoles as Record<string, string>)[role]
    || role;
}

function modeLabel(copy: StaffControlCenterCopy, mode?: string | null) {
  if (!mode) return '—';
  return (copy.modes as Record<string, string>)[mode] || mode;
}

function currentTarget(request: StaffAccessRequest) {
  return request.target_deal_id || request.target_organization_id || request.target_tenant_id || '—';
}

function permissionsFor(role: string, mode: AccessMode) {
  return ACCESS_PRESETS[role]?.[mode] || [];
}

export function StaffControlCenter({ locale, copy, identity, apiAvailable }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(apiAvailable);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const [lastGrantId, setLastGrantId] = useState<string | null>(null);
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});

  const [assignmentId, setAssignmentId] = useState('');
  const [mode, setMode] = useState<AccessMode>('CONTROL_PLANE');
  const [organizationId, setOrganizationId] = useState('');
  const [targetRole, setTargetRole] = useState('BUYER');
  const [targetDealId, setTargetDealId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [breakGlassConfirmed, setBreakGlassConfirmed] = useState(false);

  const activeAssignment = assignments.find((item) => item.id === assignmentId) || assignments[0];
  const activeRole = activeAssignment?.role || '';
  const availableModes = useMemo(
    () => Object.keys(ACCESS_PRESETS[activeRole] || {}) as AccessMode[],
    [activeRole],
  );
  const requestedPermissions = useMemo(() => permissionsFor(activeRole, mode), [activeRole, mode]);
  const permissions = sessionContext.session?.permissions || [];
  const can = useCallback((permission: string) => permissions.includes(permission), [permissions]);

  const translateError = useCallback((value: unknown) => {
    if (value instanceof StaffApiError) {
      if (value.status === 401) return copy.errors.unauthenticated;
      if (value.status === 403 && value.code === 'CSRF_REJECTED') return copy.errors.csrf;
      if (value.status === 403) return copy.errors.forbidden;
      return value.message || copy.errors.generic;
    }
    return copy.errors.generic;
  }, [copy]);

  const loadPrivileged = useCallback(async (context: SessionContext) => {
    const activePermissions = context.session?.permissions || [];
    const jobs: Promise<void>[] = [];

    if (activePermissions.includes('organization:list')) {
      jobs.push(staffApi<Organization[]>('organizations').then(setOrganizations));
    } else setOrganizations([]);

    if (activePermissions.includes('staff-request:read')) {
      jobs.push(staffApi<StaffAccessRequest[]>('access/requests/review').then(setReviewRequests));
    } else setReviewRequests([]);

    if (activePermissions.includes('staff-session:read')) {
      jobs.push(staffApi<StaffSession[]>('access/sessions/review').then(setReviewSessions));
    } else setReviewSessions([]);

    if (activePermissions.includes('audit:read')) {
      jobs.push(staffApi<{ items: AuditEvent[] }>('audit/events?limit=50').then((value) => setAuditEvents(value.items || [])));
    } else setAuditEvents([]);

    const session = context.session;
    if (
      context.active
      && session?.accessMode === 'VIEW_AS'
      && session.effectiveOrganizationId
      && session.effectiveRole
    ) {
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
    }
  }, [apiAvailable, loadPrivileged, translateError]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (availableModes.length > 0 && !availableModes.includes(mode)) setMode(availableModes[0]);
  }, [availableModes, mode]);

  const submitRequest = async () => {
    if (!activeAssignment || !ticketId.trim() || reason.trim().length < 10 || requestedPermissions.length === 0) {
      setError(copy.errors.validation);
      return;
    }
    if (mode === 'VIEW_AS' && (!organizationId || !targetRole)) {
      setError(copy.errors.validation);
      return;
    }
    setBusy('request'); setError(null); setNotice(null);
    try {
      const result = await staffApi<{ status: string; grantId?: string | null }>('access/requests', {
        method: 'POST',
        body: {
          assignmentId: activeAssignment.id,
          accessMode: mode,
          permissions: requestedPermissions,
          ...(organizationId ? { targetOrganizationId: organizationId } : {}),
          ...(mode === 'VIEW_AS' ? { targetRole } : {}),
          ...(targetDealId.trim() ? { targetDealId: targetDealId.trim() } : {}),
          reason: reason.trim(),
          ticketId: ticketId.trim(),
          durationSeconds: durationMinutes * 60,
        },
      });
      setLastGrantId(result.grantId || null);
      setNotice(result.status === 'GRANTED' ? copy.access.granted : copy.access.pending);
      setReason('');
      await reload();
    } catch (value) {
      setError(translateError(value));
    } finally { setBusy(null); }
  };

  const activateGrant = async (grantId: string) => {
    setBusy(`activate:${grantId}`); setError(null); setNotice(null);
    try {
      await staffApi(`access/grants/${encodeURIComponent(grantId)}/activate`, { method: 'POST', body: {} });
      setLastGrantId(null);
      setNotice(copy.session.bannerControl);
      await reload();
      setTab('overview');
    } catch (value) { setError(translateError(value)); }
    finally { setBusy(null); }
  };

  const endSession = async (sessionId: string) => {
    setBusy(`end:${sessionId}`); setError(null);
    try {
      await staffApi(`access/sessions/${encodeURIComponent(sessionId)}/end`, {
        method: 'POST', body: { reason: 'Staff actor ended the protected session' },
      });
      await reload();
    } catch (value) { setError(translateError(value)); }
    finally { setBusy(null); }
  };

  const decideRequest = async (requestId: string, decision: 'APPROVE' | 'DENY') => {
    const decisionReason = decisionReasons[requestId]?.trim();
    if (!decisionReason || decisionReason.length < 5) { setError(copy.errors.validation); return; }
    setBusy(`decision:${requestId}`); setError(null);
    try {
      await staffApi(`access/requests/${encodeURIComponent(requestId)}/decision`, {
        method: 'POST', body: { decision, reason: decisionReason },
      });
      setDecisionReasons((current) => ({ ...current, [requestId]: '' }));
      await reload();
    } catch (value) { setError(translateError(value)); }
    finally { setBusy(null); }
  };

  const revokeSession = async (sessionId: string) => {
    setBusy(`revoke:${sessionId}`); setError(null);
    try {
      await staffApi(`access/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: 'POST', body: { reason: 'Revoked from Staff Control Center' },
      });
      await reload();
    } catch (value) { setError(translateError(value)); }
    finally { setBusy(null); }
  };

  const activateBreakGlass = async () => {
    if (!activeAssignment || !breakGlassConfirmed || reason.trim().length < 20 || ticketId.trim().length < 3) {
      setError(copy.errors.validation); return;
    }
    setBusy('break-glass'); setError(null);
    try {
      await staffApi('break-glass/activate', {
        method: 'POST',
        body: { assignmentId: activeAssignment.id, reason: reason.trim(), ticketId: ticketId.trim() },
      });
      setNotice(copy.emergency.description);
      setBreakGlassConfirmed(false);
      setReason('');
    } catch (value) { setError(translateError(value)); }
    finally { setBusy(null); }
  };

  const chooseOrganization = (organization: Organization) => {
    setOrganizationId(organization.id);
    setMode('VIEW_AS');
    setTab('access');
    setNotice(copy.access.description);
  };

  const filteredOrganizations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return organizations;
    return organizations.filter((item) => `${item.name} ${item.inn}`.toLocaleLowerCase(locale).includes(normalized));
  }, [organizations, query, locale]);

  const pendingOwn = requests.filter((item) => item.status === 'PENDING').length;
  const mainRole = assignments[0]?.role;
  const activeSessionId = sessionContext.session?.accessSessionId;
  const canBreakGlass = assignments.some((item) => BREAK_GLASS_ROLES.has(item.role));

  if (!apiAvailable) {
    return <main className={styles.page}><section className={styles.stateCard}><strong>{copy.unavailableTitle}</strong><p>{copy.unavailableBody}</p><Link href="/platform-v7" className={styles.primaryButton}>{copy.backToPlatform}</Link></section></main>;
  }

  if (loading) {
    return <main className={styles.page}><section className={styles.stateCard} aria-live="polite"><span className={styles.spinner} />{copy.loading}</section></main>;
  }

  if (assignments.length === 0) {
    return <main className={styles.page}><section className={styles.stateCard}><strong>{copy.noAssignmentTitle}</strong><p>{copy.noAssignmentBody}</p><Link href="/platform-v7" className={styles.primaryButton}>{copy.backToPlatform}</Link></section></main>;
  }

  return (
    <main className={styles.page} data-staff-control-center data-locale={locale}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.pageTitle}</h1>
          <p className={styles.description}>{copy.description}</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={() => void reload()} disabled={Boolean(busy)}>{copy.refresh}</button>
      </header>

      <div className={styles.maturity} role="note">{copy.maturity}</div>
      {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setError(null)} aria-label="Close">×</button></div>}
      {notice && <div className={styles.notice} role="status">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Close">×</button></div>}

      <section className={styles.summaryGrid} aria-label={copy.tabs.overview}>
        <article><span>{copy.summary.assignment}</span><strong>{roleLabel(copy, mainRole)}</strong><small>{identity?.email || identity?.fullName || identity?.id}</small></article>
        <article><span>{copy.summary.protectedSession}</span><strong>{sessionContext.active ? copy.summary.active : copy.summary.inactive}</strong><small>{sessionContext.session ? modeLabel(copy, sessionContext.session.accessMode) : copy.session.none}</small></article>
        <article><span>{copy.summary.requests}</span><strong>{requests.length}</strong><small>{pendingOwn} {copy.summary.pending}</small></article>
        <article><span>{copy.summary.boundary}</span><strong>{copy.summary.readOnly}</strong><small>{copy.cabinet.warning}</small></article>
      </section>

      {sessionContext.active && sessionContext.session && (
        <section className={`${styles.sessionBanner} ${sessionContext.session.accessMode === 'VIEW_AS' ? styles.viewAsBanner : ''}`}>
          <div><strong>{copy.session.title}</strong><p>{sessionContext.session.accessMode === 'VIEW_AS' ? copy.session.bannerViewAs : copy.session.bannerControl}</p></div>
          <dl><div><dt>{copy.session.mode}</dt><dd>{modeLabel(copy, sessionContext.session.accessMode)}</dd></div><div><dt>{copy.session.expires}</dt><dd>{formatDate(sessionContext.session.expiresAt, locale)}</dd></div></dl>
          <div className={styles.permissionList}>{sessionContext.session.permissions.map((item) => <code key={item}>{item}</code>)}</div>
          <button type="button" className={styles.dangerButton} onClick={() => void endSession(sessionContext.session!.accessSessionId)} disabled={busy === `end:${sessionContext.session.accessSessionId}`}>{busy === `end:${sessionContext.session.accessSessionId}` ? copy.session.ending : copy.session.end}</button>
        </section>
      )}

      <nav className={styles.tabs} aria-label={copy.pageTitle}>
        {(Object.keys(copy.tabs) as Tab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? styles.activeTab : ''} onClick={() => setTab(item)} aria-current={tab === item ? 'page' : undefined}>{copy.tabs[item]}</button>
        ))}
      </nav>

      {tab === 'overview' && (
        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>{copy.requests.title}</h2><p>{copy.access.description}</p></div><button type="button" className={styles.textButton} onClick={() => setTab('access')}>{copy.tabs.access}</button></div>
            <RequestCards requests={requests.slice(0, 4)} copy={copy} locale={locale} onActivate={activateGrant} busy={busy} lastGrantId={lastGrantId} />
          </article>
          <article className={styles.panel}>
            <h2>{copy.session.title}</h2>
            {!sessionContext.active ? <p className={styles.empty}>{copy.session.none}</p> : <><dl className={styles.detailList}><div><dt>{copy.session.mode}</dt><dd>{modeLabel(copy, sessionContext.session?.accessMode)}</dd></div><div><dt>{copy.session.expires}</dt><dd>{formatDate(sessionContext.session?.expiresAt, locale)}</dd></div></dl><div className={styles.permissionList}>{permissions.map((item) => <code key={item}>{item}</code>)}</div></>}
          </article>
        </section>
      )}

      {tab === 'access' && (
        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>{copy.access.title}</h2><p>{copy.access.description}</p></div></div>
            <div className={styles.formGrid}>
              <label><span>{copy.access.assignment}</span><select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>{assignments.map((item) => <option key={item.id} value={item.id}>{roleLabel(copy, item.role)} · {statusLabel(copy, item.status)}</option>)}</select></label>
              <label><span>{copy.access.mode}</span><select value={mode} onChange={(event) => setMode(event.target.value as AccessMode)}>{availableModes.map((item) => <option key={item} value={item}>{modeLabel(copy, item)}</option>)}</select></label>
              {mode === 'VIEW_AS' && <><label><span>{copy.access.organization}</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">{copy.access.organizationPlaceholder}</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.inn}</option>)}</select></label><label><span>{copy.access.role}</span><select value={targetRole} onChange={(event) => setTargetRole(event.target.value)}>{CABINET_ROLES.map((item) => <option key={item} value={item}>{roleLabel(copy, item)}</option>)}</select></label><label className={styles.fullWidth}><span>{copy.access.deal}</span><input value={targetDealId} onChange={(event) => setTargetDealId(event.target.value)} placeholder={copy.access.dealPlaceholder} /></label></>}
              <label><span>{copy.access.ticket}</span><input value={ticketId} onChange={(event) => setTicketId(event.target.value)} placeholder={copy.access.ticketPlaceholder} maxLength={128} /></label>
              <label><span>{copy.access.duration}</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>{[5, 10, 15, 30, 60].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className={styles.fullWidth}><span>{copy.access.reason}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.access.reasonPlaceholder} maxLength={2000} rows={4} /></label>
            </div>
            <div className={styles.permissionBlock}><span>{copy.access.permissions}</span><div className={styles.permissionList}>{requestedPermissions.map((item) => <code key={item}>{item}</code>)}</div></div>
            {mode === 'VIEW_AS' && organizations.length === 0 && <p className={styles.hint}>{copy.access.controlFirst}</p>}
            <button type="button" className={styles.primaryButton} onClick={() => void submitRequest()} disabled={busy === 'request'}>{busy === 'request' ? copy.access.submitting : copy.access.submit}</button>
          </article>

          <article className={styles.panel}>
            <h2>{copy.requests.title}</h2>
            <RequestCards requests={requests} copy={copy} locale={locale} onActivate={activateGrant} busy={busy} lastGrantId={lastGrantId} />
            <h3 className={styles.subheading}>{copy.session.title}</h3>
            {sessions.length === 0 ? <p className={styles.empty}>{copy.session.none}</p> : <div className={styles.cardList}>{sessions.map((item) => <article className={styles.compactCard} key={item.id}><div><strong>{modeLabel(copy, item.access_mode)}</strong><small>{formatDate(item.expires_at, locale)}</small></div><button type="button" className={styles.dangerTextButton} onClick={() => void endSession(item.id)} disabled={busy === `end:${item.id}`}>{copy.session.end}</button></article>)}</div>}
          </article>

          {canBreakGlass && (
            <article className={`${styles.panel} ${styles.emergencyPanel}`}>
              <h2>{copy.emergency.title}</h2><p>{copy.emergency.description}</p>
              <label className={styles.confirm}><input type="checkbox" checked={breakGlassConfirmed} onChange={(event) => setBreakGlassConfirmed(event.target.checked)} /><span>{copy.emergency.confirm}</span></label>
              <button type="button" className={styles.dangerButton} disabled={!breakGlassConfirmed || busy === 'break-glass'} onClick={() => void activateBreakGlass()}>{copy.emergency.activate}</button>
            </article>
          )}
        </section>
      )}

      {tab === 'organizations' && (
        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>{copy.organizations.title}</h2><p>{copy.organizations.description}</p></div></div>
            {!can('organization:list') ? <p className={styles.empty}>{copy.access.controlFirst}</p> : <><input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.organizations.search} /><div className={styles.cardList}>{filteredOrganizations.length === 0 ? <p className={styles.empty}>{copy.organizations.empty}</p> : filteredOrganizations.map((item) => <article key={item.id} className={styles.organizationCard}><div><strong>{item.name}</strong><small>{copy.organizations.inn}: {item.inn}</small></div><dl><div><dt>{copy.organizations.status}</dt><dd>{item.status}</dd></div><div><dt>{copy.organizations.kyc}</dt><dd>{item.kycStatus || item.kyc_status || '—'}</dd></div><div><dt>{copy.organizations.aml}</dt><dd>{item.amlStatus || item.aml_status || '—'}</dd></div></dl><button type="button" className={styles.secondaryButton} onClick={() => chooseOrganization(item)}>{copy.organizations.select}</button></article>)}</div></>}
          </article>
          {cabinet && <CabinetView cabinet={cabinet} copy={copy} locale={locale} />}
        </section>
      )}

      {tab === 'review' && (
        <section className={styles.contentGrid}>
          <article className={styles.panel}><div className={styles.panelHeader}><div><h2>{copy.review.requestQueue}</h2><p>{copy.review.description}</p></div></div>{!can('staff-request:read') ? <p className={styles.empty}>{copy.errors.forbidden}</p> : reviewRequests.length === 0 ? <p className={styles.empty}>{copy.review.noRequests}</p> : <div className={styles.cardList}>{reviewRequests.map((item) => <article key={item.id} className={styles.reviewCard}><header><div><strong>{modeLabel(copy, item.access_mode)}</strong><small>{item.ticket_id} · {formatDate(item.requested_at, locale)}</small></div><span className={styles.status}>{statusLabel(copy, item.status)}</span></header><p>{item.reason}</p><div className={styles.permissionList}>{(item.permissions || []).map((permission) => <code key={permission}>{permission}</code>)}</div>{item.status === 'PENDING' && can('staff-request:approve') && <><textarea rows={2} value={decisionReasons[item.id] || ''} onChange={(event) => setDecisionReasons((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={copy.review.decisionPlaceholder} /><div className={styles.inlineActions}><button type="button" className={styles.primaryButton} onClick={() => void decideRequest(item.id, 'APPROVE')} disabled={busy === `decision:${item.id}`}>{copy.review.approve}</button><button type="button" className={styles.dangerButton} onClick={() => void decideRequest(item.id, 'DENY')} disabled={busy === `decision:${item.id}`}>{copy.review.deny}</button></div></>}</article>)}</div>}</article>
          <article className={styles.panel}><h2>{copy.review.activeSessions}</h2>{!can('staff-session:read') ? <p className={styles.empty}>{copy.errors.forbidden}</p> : reviewSessions.length === 0 ? <p className={styles.empty}>{copy.review.noSessions}</p> : <div className={styles.cardList}>{reviewSessions.map((item) => <article key={item.id} className={styles.compactCard}><div><strong>{roleLabel(copy, item.staff_role)} · {modeLabel(copy, item.access_mode)}</strong><small>{item.actor_user_id} · {formatDate(item.expires_at, locale)}</small></div>{can('staff-session:revoke') && item.id !== activeSessionId && <button type="button" className={styles.dangerTextButton} onClick={() => void revokeSession(item.id)} disabled={busy === `revoke:${item.id}`}>{copy.review.revoke}</button>}</article>)}</div>}</article>
        </section>
      )}

      {tab === 'audit' && (
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>{copy.audit.title}</h2><p>{copy.audit.description}</p></div></div>{!can('audit:read') ? <p className={styles.empty}>{copy.errors.forbidden}</p> : auditEvents.length === 0 ? <p className={styles.empty}>{copy.audit.empty}</p> : <div className={styles.auditList}>{auditEvents.map((item) => <article key={item.id}><div><strong>{item.action}</strong><span className={styles.status}>{statusLabel(copy, item.outcome)}</span></div><dl><div><dt>{copy.audit.actor}</dt><dd>{item.actor_user_id} · {roleLabel(copy, item.staff_role)}</dd></div><div><dt>{copy.audit.time}</dt><dd>{formatDate(item.created_at, locale)}</dd></div><div><dt>{copy.audit.correlation}</dt><dd><code>{item.correlation_id}</code></dd></div></dl></article>)}</div>}</section>
      )}
    </main>
  );
}

function RequestCards({ requests, copy, locale, onActivate, busy, lastGrantId }: {
  requests: StaffAccessRequest[];
  copy: StaffControlCenterCopy;
  locale: AppLocale;
  onActivate: (grantId: string) => Promise<void>;
  busy: string | null;
  lastGrantId: string | null;
}) {
  if (requests.length === 0 && !lastGrantId) return <p className={styles.empty}>{copy.requests.empty}</p>;
  return <div className={styles.cardList}>{lastGrantId && <article className={styles.requestCard}><header><strong>{copy.access.granted}</strong></header><button type="button" className={styles.primaryButton} onClick={() => void onActivate(lastGrantId)} disabled={busy === `activate:${lastGrantId}`}>{copy.access.activate}</button></article>}{requests.map((item) => { const grantId = item.grant_id; const activatable = Boolean(grantId && ['GRANTED', 'ACTIVE'].includes(item.grant_status || item.status)); return <article key={item.id} className={styles.requestCard}><header><div><strong>{modeLabel(copy, item.access_mode)}</strong><small>{item.ticket_id || '—'} · {formatDate(item.requested_at, locale)}</small></div><span className={styles.status}>{statusLabel(copy, item.status)}</span></header><dl><div><dt>{copy.requests.target}</dt><dd>{currentTarget(item)}</dd></div><div><dt>{copy.requests.expiresAt}</dt><dd>{formatDate(item.grant_expires_at || item.expires_at, locale)}</dd></div></dl>{activatable && <button type="button" className={styles.primaryButton} onClick={() => void onActivate(grantId!)} disabled={busy === `activate:${grantId}`}>{busy === `activate:${grantId}` ? copy.access.activating : copy.access.activate}</button>}</article>; })}</div>;
}

function CabinetView({ cabinet, copy, locale }: { cabinet: CabinetProjection; copy: StaffControlCenterCopy; locale: AppLocale }) {
  return <article className={`${styles.panel} ${styles.cabinetPanel}`}><div className={styles.panelHeader}><div><p className={styles.eyebrow}>{copy.cabinet.title}</p><h2>{cabinet.effectiveOrganization?.name}</h2><p>{roleLabel(copy, cabinet.effectiveRole)}</p></div><span className={styles.readOnlyBadge}>READ ONLY</span></div><div className={styles.warning}>{copy.cabinet.warning}</div>{!cabinet.deals?.length ? <p className={styles.empty}>{copy.cabinet.noDeals}</p> : <div className={styles.cardList}>{cabinet.deals.map((deal) => <article key={deal.id} className={styles.dealCard}><header><strong>{deal.dealNumber || deal.deal_number || deal.id}</strong><span className={styles.status}>{deal.status}</span></header><dl><div><dt>{copy.cabinet.nextAction}</dt><dd>{deal.nextAction || deal.next_action || '—'}</dd></div><div><dt>{copy.cabinet.updatedAt}</dt><dd>{formatDate(deal.updatedAt || deal.updated_at, locale)}</dd></div></dl></article>)}</div>}</article>;
}
