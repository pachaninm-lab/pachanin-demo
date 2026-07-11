'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { StaffCopy } from '@/i18n/staff-messages';

type Assignment = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  valid_from?: string;
  valid_until?: string | null;
};

type Organization = {
  id: string;
  tenant_id: string;
  name: string;
  inn: string;
  status: string;
  kyc_status: string;
  aml_status: string;
  updated_at: string;
};

type OrganizationUser = {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  user_status: string;
  mfa_enabled: boolean;
  role: string;
  is_default: boolean;
  joined_at: string;
};

type AccessRequest = {
  id: string;
  requester_user_id: string;
  assignment_id: string;
  access_mode: string;
  target_tenant_id?: string | null;
  target_organization_id?: string | null;
  target_user_id?: string | null;
  target_role?: string | null;
  target_deal_id?: string | null;
  requested_permissions: string[];
  reason: string;
  ticket_id: string;
  status: string;
  requested_at: string;
  expires_at: string;
};

type StaffSession = {
  id: string;
  actor_user_id: string;
  staff_role: string;
  access_mode: string;
  effective_tenant_id?: string | null;
  effective_organization_id?: string | null;
  effective_user_id?: string | null;
  effective_role?: string | null;
  reason: string;
  ticket_id: string;
  started_at: string;
  expires_at: string;
};

type AuditEvent = {
  id: string;
  actor_user_id: string;
  staff_role: string;
  action: string;
  outcome: string;
  reason?: string | null;
  ticket_id?: string | null;
  correlation_id: string;
  effective_organization_id?: string | null;
  effective_role?: string | null;
  created_at: string;
};

type BreakGlass = {
  id: string;
  actor_user_id: string;
  role: string;
  reason: string;
  ticket_id: string;
  status: string;
  started_at: string;
  expires_at: string;
};

type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  code?: string;
  correlationId?: string;
};

type Section = 'overview' | 'organizations' | 'access' | 'sessions' | 'audit' | 'emergency';

const STAFF_ROLES = [
  'PLATFORM_OWNER',
  'PLATFORM_ADMIN',
  'SUPPORT_L1',
  'SUPPORT_L2',
  'OPERATIONS_AGENT',
  'OPERATIONS_SUPERVISOR',
  'FINANCE_OPS',
  'COMPLIANCE_STAFF',
  'DEVELOPER',
  'SRE_ONCALL',
  'SECURITY_AUDITOR',
  'BREAK_GLASS_ADMIN',
] as const;

const BUSINESS_ROLES = [
  'ADMIN', 'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'SURVEYOR', 'LAB',
  'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'COMPLIANCE_OFFICER', 'ARBITRATOR',
] as const;

const CONTROL_PERMISSIONS: Record<string, string[]> = {
  PLATFORM_OWNER: [
    'organization:list', 'user:list', 'staff-assignment:read', 'staff-assignment:write',
    'staff-request:approve', 'staff-session:read', 'staff-session:revoke', 'audit:read',
    'critical-action:approve', 'diagnostic:read', 'system-health:read',
  ],
  PLATFORM_ADMIN: [
    'organization:list', 'user:list', 'staff-assignment:read', 'staff-assignment:write',
    'staff-request:approve', 'staff-session:read', 'staff-session:revoke', 'audit:read',
  ],
  SUPPORT_L1: ['support-case:read', 'support-case:update', 'account-status:read'],
  SUPPORT_L2: [
    'support-case:read', 'support-case:update', 'account-status:read', 'user:list',
    'user-session:revoke', 'diagnostic:read', 'document-metadata:read',
  ],
  OPERATIONS_AGENT: ['organization:list', 'deal:read', 'operations-queue:read', 'operations-task:update'],
  OPERATIONS_SUPERVISOR: [
    'organization:list', 'deal:read', 'operations-queue:read', 'operations-task:update',
    'staff-request:approve', 'staff-session:read', 'critical-action:approve',
  ],
  FINANCE_OPS: ['payment:read', 'reconciliation:read', 'reconciliation:review', 'audit:read'],
  COMPLIANCE_STAFF: ['organization:list', 'user:list', 'deal:read', 'audit:read', 'compliance:review'],
  DEVELOPER: ['diagnostic:read', 'system-health:read', 'deployment:read'],
  SRE_ONCALL: ['diagnostic:read', 'system-health:read', 'deployment:read', 'incident:update'],
  SECURITY_AUDITOR: ['audit:read', 'staff-session:read', 'organization:list'],
  BREAK_GLASS_ADMIN: ['diagnostic:read', 'system-health:read'],
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—';
}

function scopeLabel(item: AccessRequest | StaffSession) {
  return [
    'target_tenant_id' in item ? item.target_tenant_id : item.effective_tenant_id,
    'target_organization_id' in item ? item.target_organization_id : item.effective_organization_id,
    'target_role' in item ? item.target_role : item.effective_role,
  ].filter(Boolean).join(' / ') || 'platform';
}

async function requestJson<T>(
  channel: 'control' | 'delegated',
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`/api/staff/${channel}/${path}`, {
      ...init,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({})) as T & { code?: string; correlationId?: string };
    return {
      ok: response.ok,
      status: response.status,
      data: response.ok ? payload : null,
      code: payload?.code,
      correlationId: payload?.correlationId || response.headers.get('x-correlation-id') || undefined,
    };
  } catch {
    return { ok: false, status: 503, data: null, code: 'NETWORK_FAILURE' };
  }
}

export function StaffControlCenterClient({ copy }: { copy: StaffCopy }) {
  const router = useRouter();
  const [section, setSection] = React.useState<Section>('overview');
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = React.useState('');
  const [phase, setPhase] = React.useState<'loading' | 'denied' | 'setup' | 'ready' | 'unavailable'>('loading');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [reason, setReason] = React.useState('');
  const [ticket, setTicket] = React.useState('');
  const [duration, setDuration] = React.useState(900);
  const [pendingGrantId, setPendingGrantId] = React.useState('');

  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [organizationUsers, setOrganizationUsers] = React.useState<Record<string, OrganizationUser[]>>({});
  const [expandedOrganization, setExpandedOrganization] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [sessions, setSessions] = React.useState<StaffSession[]>([]);
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [emergencies, setEmergencies] = React.useState<BreakGlass[]>([]);
  const [decisionReasons, setDecisionReasons] = React.useState<Record<string, string>>({});

  const [viewTarget, setViewTarget] = React.useState<Organization | null>(null);
  const [viewRole, setViewRole] = React.useState('BUYER');
  const [viewReason, setViewReason] = React.useState('');
  const [viewTicket, setViewTicket] = React.useState('');

  const [newStaffUserId, setNewStaffUserId] = React.useState('');
  const [newStaffRole, setNewStaffRole] = React.useState<(typeof STAFF_ROLES)[number]>('SUPPORT_L1');
  const [newStaffReason, setNewStaffReason] = React.useState('');
  const [staffAssignments, setStaffAssignments] = React.useState<Record<string, unknown>[]>([]);

  const [emergencyReason, setEmergencyReason] = React.useState('');
  const [emergencyTicket, setEmergencyTicket] = React.useState('');

  const activeAssignment = assignments.find((assignment) => assignment.id === selectedAssignment) || assignments[0];

  const loadAssignments = React.useCallback(async () => {
    setPhase('loading');
    const response = await requestJson<Assignment[]>('control', 'assignments/me');
    if (response.status === 503) {
      setPhase('unavailable');
      return;
    }
    if (!response.ok || !Array.isArray(response.data) || response.data.length === 0) {
      setPhase('denied');
      return;
    }
    setAssignments(response.data);
    setSelectedAssignment((current) => current || response.data![0].id);

    const probe = await requestJson<Organization[]>('control', 'organizations');
    if (probe.ok) {
      setOrganizations(Array.isArray(probe.data) ? probe.data : []);
      setPhase('ready');
    } else {
      setPhase('setup');
    }
  }, []);

  React.useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const loadControlData = React.useCallback(async () => {
    const [orgs, accessRequests, activeSessions, auditEvents, breakGlass, allAssignments] = await Promise.all([
      requestJson<Organization[]>('control', 'organizations'),
      requestJson<AccessRequest[]>('control', 'access/requests/review'),
      requestJson<StaffSession[]>('control', 'access/sessions/review'),
      requestJson<{ items?: AuditEvent[] }>('control', 'audit/events?limit=50'),
      requestJson<BreakGlass[]>('control', 'break-glass/active'),
      requestJson<Record<string, unknown>[]>('control', 'assignments'),
    ]);

    if (!orgs.ok) {
      if (orgs.status === 401 || orgs.status === 403) setPhase('setup');
      else setNotice({ tone: 'error', text: `${copy.failed}${orgs.correlationId ? ` (${orgs.correlationId})` : ''}` });
      return;
    }
    setOrganizations(Array.isArray(orgs.data) ? orgs.data : []);
    if (accessRequests.ok) setRequests(Array.isArray(accessRequests.data) ? accessRequests.data : []);
    if (activeSessions.ok) setSessions(Array.isArray(activeSessions.data) ? activeSessions.data : []);
    if (auditEvents.ok) setEvents(Array.isArray(auditEvents.data?.items) ? auditEvents.data!.items! : []);
    if (breakGlass.ok) setEmergencies(Array.isArray(breakGlass.data) ? breakGlass.data : []);
    if (allAssignments.ok) setStaffAssignments(Array.isArray(allAssignments.data) ? allAssignments.data : []);
    setPhase('ready');
  }, [copy.failed]);

  React.useEffect(() => {
    if (phase === 'ready') void loadControlData();
  }, [phase, loadControlData]);

  async function requestControlSession(event: React.FormEvent) {
    event.preventDefault();
    if (!activeAssignment || reason.trim().length < 10 || ticket.trim().length < 3) return;
    setBusy(true);
    setNotice(null);
    const permissions = CONTROL_PERMISSIONS[activeAssignment.role] || [];
    const response = await requestJson<{ status?: string; grantId?: string; requestId?: string }>('control', 'access/requests', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: activeAssignment.id,
        accessMode: 'CONTROL_PLANE',
        permissions,
        reason: reason.trim(),
        ticketId: ticket.trim(),
        durationSeconds: duration,
      }),
    });
    setBusy(false);
    if (!response.ok || !response.data) {
      setNotice({ tone: 'error', text: `${copy.failed}${response.correlationId ? ` (${response.correlationId})` : ''}` });
      return;
    }
    if (response.data.grantId) {
      setPendingGrantId(response.data.grantId);
      await activateControlGrant(response.data.grantId);
      return;
    }
    setNotice({ tone: 'info', text: copy.requestPending });
  }

  async function activateControlGrant(grantId = pendingGrantId) {
    if (!grantId) return;
    setBusy(true);
    const response = await requestJson<{ accessSessionId?: string; accessMode?: string }>('control', `access/grants/${encodeURIComponent(grantId)}/activate`, { method: 'POST' });
    setBusy(false);
    if (!response.ok) {
      setNotice({ tone: 'error', text: `${copy.failed}${response.correlationId ? ` (${response.correlationId})` : ''}` });
      return;
    }
    setPendingGrantId('');
    setNotice({ tone: 'ok', text: copy.saved });
    setPhase('ready');
    await loadControlData();
  }

  async function openOrganization(organizationId: string) {
    if (expandedOrganization === organizationId) {
      setExpandedOrganization('');
      return;
    }
    const response = await requestJson<OrganizationUser[]>('control', `organizations/${encodeURIComponent(organizationId)}/users`);
    if (!response.ok) {
      setNotice({ tone: 'error', text: copy.forbidden });
      return;
    }
    setOrganizationUsers((current) => ({ ...current, [organizationId]: Array.isArray(response.data) ? response.data : [] }));
    setExpandedOrganization(organizationId);
  }

  async function startViewAs(event: React.FormEvent) {
    event.preventDefault();
    if (!viewTarget || !activeAssignment || viewReason.trim().length < 10 || viewTicket.trim().length < 3) return;
    setBusy(true);
    const request = await requestJson<{ grantId?: string; status?: string }>('control', 'access/requests', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: activeAssignment.id,
        accessMode: 'VIEW_AS',
        permissions: ['cabinet:view-as', 'deal:read'],
        targetTenantId: viewTarget.tenant_id,
        targetOrganizationId: viewTarget.id,
        targetRole: viewRole,
        reason: viewReason.trim(),
        ticketId: viewTicket.trim(),
        durationSeconds: 900,
      }),
    });
    if (!request.ok || !request.data?.grantId) {
      setBusy(false);
      setNotice({ tone: request.ok ? 'info' : 'error', text: request.ok ? copy.requestPending : copy.failed });
      return;
    }
    const activation = await requestJson<{ accessSessionId?: string; accessMode?: string }>('control', `access/grants/${encodeURIComponent(request.data.grantId)}/activate`, { method: 'POST' });
    setBusy(false);
    if (!activation.ok) {
      setNotice({ tone: 'error', text: copy.failed });
      return;
    }
    router.push(`/platform-v7/staff/view-as?organization=${encodeURIComponent(viewTarget.id)}&role=${encodeURIComponent(viewRole)}`);
  }

  async function decideAccess(id: string, decision: 'APPROVE' | 'DENY') {
    const decisionReason = (decisionReasons[id] || '').trim();
    if (decisionReason.length < 5) return;
    setBusy(true);
    const response = await requestJson('control', `access/requests/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason: decisionReason }),
    });
    setBusy(false);
    setNotice({ tone: response.ok ? 'ok' : 'error', text: response.ok ? copy.saved : copy.failed });
    if (response.ok) await loadControlData();
  }

  async function revokeSession(id: string) {
    setBusy(true);
    const response = await requestJson('control', `access/sessions/${encodeURIComponent(id)}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Revoked from Staff Control Center' }),
    });
    setBusy(false);
    setNotice({ tone: response.ok ? 'ok' : 'error', text: response.ok ? copy.saved : copy.failed });
    if (response.ok) await loadControlData();
  }

  async function verifyAudit(actorUserId: string) {
    const response = await requestJson<{ valid?: boolean; checked?: number; failedEventId?: string }>('control', `audit/actors/${encodeURIComponent(actorUserId)}/verify?limit=10000`);
    setNotice({
      tone: response.ok && response.data?.valid ? 'ok' : 'error',
      text: response.ok && response.data?.valid
        ? `${copy.saved} ${response.data.checked ?? 0}`
        : `${copy.failed}${response.data?.failedEventId ? ` ${response.data.failedEventId}` : ''}`,
    });
  }

  async function createStaffAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (newStaffUserId.trim().length < 3 || newStaffReason.trim().length < 10) return;
    setBusy(true);
    const response = await requestJson('control', 'assignments', {
      method: 'POST',
      body: JSON.stringify({ userId: newStaffUserId.trim(), role: newStaffRole, reason: newStaffReason.trim() }),
    });
    setBusy(false);
    setNotice({ tone: response.ok ? 'ok' : 'error', text: response.ok ? copy.saved : copy.failed });
    if (response.ok) {
      setNewStaffUserId('');
      setNewStaffReason('');
      await loadControlData();
    }
  }

  async function activateEmergency(event: React.FormEvent) {
    event.preventDefault();
    if (!activeAssignment || emergencyReason.trim().length < 20 || emergencyTicket.trim().length < 3) return;
    setBusy(true);
    const response = await requestJson('control', 'break-glass/activate', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: activeAssignment.id,
        reason: emergencyReason.trim(),
        ticketId: emergencyTicket.trim(),
      }),
    });
    setBusy(false);
    setNotice({ tone: response.ok ? 'ok' : 'error', text: response.ok ? copy.saved : copy.failed });
    if (response.ok) await loadControlData();
  }

  const visibleOrganizations = organizations.filter((organization) => {
    const value = `${organization.name} ${organization.inn} ${organization.id}`.toLowerCase();
    return value.includes(filter.trim().toLowerCase());
  });

  if (phase === 'loading') return <StateCard title={copy.loading} text={copy.secure} busy />;
  if (phase === 'unavailable') return <StateCard title={copy.unavailableTitle} text={copy.unavailableText} action={copy.retry} onAction={loadAssignments} />;
  if (phase === 'denied') return <StateCard title={copy.deniedTitle} text={copy.deniedText} action={copy.retry} onAction={loadAssignments} />;

  if (phase === 'setup') {
    return (
      <div className='pc-staff-onboarding'>
        <StateCard title={copy.sessionTitle} text={copy.sessionText} />
        <div className='pc-staff-assignments'>
          {assignments.map((assignment) => (
            <button
              key={assignment.id}
              type='button'
              className={selectedAssignment === assignment.id ? 'is-active' : ''}
              onClick={() => setSelectedAssignment(assignment.id)}
            >
              <strong>{assignment.role}</strong>
              <span>{assignment.status}</span>
              <small>{assignment.valid_until ? formatDate(assignment.valid_until) : copy.noExpiry}</small>
            </button>
          ))}
        </div>
        <form className='pc-staff-session-form' onSubmit={requestControlSession}>
          <label><span>{copy.sessionReason}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.sessionReasonPlaceholder} required minLength={10} maxLength={2000} /></label>
          <label><span>{copy.sessionTicket}</span><input value={ticket} onChange={(event) => setTicket(event.target.value)} placeholder={copy.sessionTicketPlaceholder} required minLength={3} maxLength={128} /></label>
          <label><span>{copy.sessionDuration}</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={900}>{copy.minutes15}</option><option value={1800}>{copy.minutes30}</option><option value={3600}>{copy.minutes60}</option></select></label>
          <button type='submit' disabled={busy || !activeAssignment}>{busy ? copy.loading : copy.startSession}</button>
          {pendingGrantId ? <button type='button' onClick={() => void activateControlGrant()}>{copy.activateSession}</button> : null}
        </form>
        {notice ? <Notice notice={notice} /> : null}
      </div>
    );
  }

  const nav: Array<[Section, string]> = [
    ['overview', copy.navOverview], ['organizations', copy.navOrganizations], ['access', copy.navAccess],
    ['sessions', copy.navSessions], ['audit', copy.navAudit], ['emergency', copy.navEmergency],
  ];

  return (
    <div className='pc-staff-console'>
      <aside className='pc-staff-sidebar' aria-label={copy.product}>
        <div className='pc-staff-brand'><strong>{copy.brand}</strong><span>{copy.product}</span><small>{copy.secure}</small></div>
        <nav>{nav.map(([key, label]) => <button key={key} type='button' aria-current={section === key ? 'page' : undefined} onClick={() => setSection(key)}>{label}</button>)}</nav>
        <div className='pc-staff-actor'><span>{copy.role}</span><strong>{activeAssignment?.role || '—'}</strong><small>{activeAssignment?.status || '—'}</small></div>
      </aside>

      <main className='pc-staff-workspace' id='staff-workspace'>
        <header className='pc-staff-workspace-header'>
          <div><span>{copy.secure}</span><h1>{nav.find(([key]) => key === section)?.[1]}</h1></div>
          <button type='button' onClick={() => void loadControlData()} disabled={busy}>{copy.refresh}</button>
        </header>
        {notice ? <Notice notice={notice} /> : null}

        {section === 'overview' ? (
          <section aria-labelledby='staff-overview-title'>
            <SectionHeading id='staff-overview-title' title={copy.overviewTitle} text={copy.overviewLead} />
            <div className='pc-staff-metrics'>
              <Metric label={copy.cardOrganizations} value={organizations.length} />
              <Metric label={copy.cardPending} value={requests.filter((item) => item.status === 'PENDING').length} />
              <Metric label={copy.cardSessions} value={sessions.length} />
              <Metric label={copy.cardBreakGlass} value={emergencies.length} />
              <Metric label={copy.cardAudit} value={events.length} />
            </div>
            <div className='pc-staff-panel'>
              <h2>{copy.sessionTitle}</h2>
              <p>{copy.sessionText}</p>
              <dl><div><dt>{copy.role}</dt><dd>{activeAssignment?.role}</dd></div><div><dt>{copy.assignmentStatus}</dt><dd>{activeAssignment?.status}</dd></div><div><dt>{copy.validUntil}</dt><dd>{activeAssignment?.valid_until ? formatDate(activeAssignment.valid_until) : copy.noExpiry}</dd></div></dl>
            </div>
          </section>
        ) : null}

        {section === 'organizations' ? (
          <section aria-labelledby='staff-organizations-title'>
            <SectionHeading id='staff-organizations-title' title={copy.organizationsTitle} text={copy.organizationsLead} />
            <label className='pc-staff-search'><span>{copy.search}</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={copy.searchPlaceholder} /></label>
            <div className='pc-staff-list'>
              {visibleOrganizations.length === 0 ? <Empty text={copy.empty} /> : visibleOrganizations.map((organization) => (
                <article key={organization.id} className='pc-staff-organization'>
                  <div className='pc-staff-row-main'><div><strong>{organization.name}</strong><span>{organization.inn} · {organization.id}</span></div><div className='pc-staff-badges'><span>{organization.status}</span><span>KYC {organization.kyc_status}</span><span>AML {organization.aml_status}</span></div><button type='button' onClick={() => void openOrganization(organization.id)}>{expandedOrganization === organization.id ? copy.close : copy.open}</button></div>
                  {expandedOrganization === organization.id ? (
                    <div className='pc-staff-organization-detail'>
                      <div className='pc-staff-users'>
                        {(organizationUsers[organization.id] || []).map((member) => (
                          <div key={member.membership_id}><div><strong>{member.full_name}</strong><span>{member.email}</span></div><span>{member.role}</span><span>{member.mfa_enabled ? copy.enabled : copy.disabled}</span></div>
                        ))}
                        {(organizationUsers[organization.id] || []).length === 0 ? <Empty text={copy.empty} /> : null}
                      </div>
                      <button type='button' className='pc-staff-primary' onClick={() => { setViewTarget(organization); setViewRole('BUYER'); setViewReason(''); setViewTicket(''); }}>{copy.viewAs}</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {section === 'access' ? (
          <section aria-labelledby='staff-access-title'>
            <SectionHeading id='staff-access-title' title={copy.accessTitle} text={copy.accessLead} />
            <div className='pc-staff-split'>
              <div className='pc-staff-panel'>
                <h2>{copy.role}</h2>
                <form className='pc-staff-stack' onSubmit={createStaffAssignment}>
                  <label><span>{copy.user}</span><input value={newStaffUserId} onChange={(event) => setNewStaffUserId(event.target.value)} required minLength={3} /></label>
                  <label><span>{copy.role}</span><select value={newStaffRole} onChange={(event) => setNewStaffRole(event.target.value as typeof newStaffRole)}>{STAFF_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
                  <label><span>{copy.sessionReason}</span><textarea value={newStaffReason} onChange={(event) => setNewStaffReason(event.target.value)} required minLength={10} /></label>
                  <button type='submit' disabled={busy}>{copy.startSession}</button>
                </form>
                <div className='pc-staff-compact-list'>{staffAssignments.map((assignment, index) => <pre key={String(assignment.id || index)}>{JSON.stringify(assignment, null, 2)}</pre>)}</div>
              </div>
              <div className='pc-staff-panel'>
                <h2>{copy.cardPending}</h2>
                {requests.length === 0 ? <Empty text={copy.empty} /> : requests.map((item) => (
                  <article key={item.id} className='pc-staff-request'><div><strong>{item.access_mode}</strong><span>{item.requester_user_id}</span><small>{scopeLabel(item)} · {formatDate(item.expires_at)}</small></div><p>{item.reason}</p><input value={decisionReasons[item.id] || ''} onChange={(event) => setDecisionReasons((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={copy.decisionReason} /><div><button type='button' onClick={() => void decideAccess(item.id, 'APPROVE')}>{copy.approve}</button><button type='button' onClick={() => void decideAccess(item.id, 'DENY')}>{copy.deny}</button></div></article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {section === 'sessions' ? (
          <section aria-labelledby='staff-sessions-title'>
            <SectionHeading id='staff-sessions-title' title={copy.sessionsTitle} text={copy.sessionsLead} />
            <div className='pc-staff-list'>{sessions.length === 0 ? <Empty text={copy.empty} /> : sessions.map((session) => <article key={session.id} className='pc-staff-session-row'><div><strong>{session.staff_role} · {session.access_mode}</strong><span>{session.actor_user_id}</span><small>{scopeLabel(session)}</small></div><div><span>{formatDate(session.started_at)}</span><span>{formatDate(session.expires_at)}</span></div><button type='button' onClick={() => void revokeSession(session.id)}>{copy.revokeSession}</button></article>)}</div>
          </section>
        ) : null}

        {section === 'audit' ? (
          <section aria-labelledby='staff-audit-title'>
            <SectionHeading id='staff-audit-title' title={copy.auditTitle} text={copy.auditLead} />
            <div className='pc-staff-list'>{events.length === 0 ? <Empty text={copy.empty} /> : events.map((event) => <article key={event.id} className='pc-staff-audit-row'><div><strong>{event.action}</strong><span>{event.actor_user_id} · {event.staff_role}</span><small>{event.ticket_id || '—'} · {event.correlation_id}</small></div><span data-outcome={event.outcome}>{event.outcome}</span><time>{formatDate(event.created_at)}</time><button type='button' onClick={() => void verifyAudit(event.actor_user_id)}>{copy.verifyChain}</button></article>)}</div>
          </section>
        ) : null}

        {section === 'emergency' ? (
          <section aria-labelledby='staff-emergency-title'>
            <SectionHeading id='staff-emergency-title' title={copy.emergencyTitle} text={copy.emergencyLead} />
            <form className='pc-staff-emergency-form' onSubmit={activateEmergency}><label><span>{copy.emergencyReason}</span><textarea value={emergencyReason} onChange={(event) => setEmergencyReason(event.target.value)} required minLength={20} /></label><label><span>{copy.emergencyTicket}</span><input value={emergencyTicket} onChange={(event) => setEmergencyTicket(event.target.value)} required minLength={3} /></label><button type='submit' disabled={busy}>{copy.activateBreakGlass}</button></form>
            <div className='pc-staff-list'>{emergencies.length === 0 ? <Empty text={copy.empty} /> : emergencies.map((item) => <article key={item.id} className='pc-staff-emergency-row'><div><strong>{item.role}</strong><span>{item.actor_user_id}</span><p>{item.reason}</p></div><div><span>{item.ticket_id}</span><time>{formatDate(item.expires_at)}</time></div></article>)}</div>
          </section>
        ) : null}
      </main>

      <nav className='pc-staff-mobile-nav' aria-label={copy.product}>{nav.map(([key, label]) => <button key={key} type='button' aria-current={section === key ? 'page' : undefined} onClick={() => setSection(key)}>{label}</button>)}</nav>

      {viewTarget ? (
        <div className='pc-staff-modal-backdrop' role='presentation' onMouseDown={(event) => { if (event.currentTarget === event.target) setViewTarget(null); }}>
          <section className='pc-staff-modal' role='dialog' aria-modal='true' aria-labelledby='staff-view-as-title'>
            <header><div><span>{copy.readonly}</span><h2 id='staff-view-as-title'>{copy.viewAsTitle}</h2><p>{copy.viewAsText}</p></div><button type='button' onClick={() => setViewTarget(null)} aria-label={copy.close}>×</button></header>
            <form onSubmit={startViewAs} className='pc-staff-stack'>
              <div className='pc-staff-target'><strong>{viewTarget.name}</strong><span>{viewTarget.id}</span></div>
              <label><span>{copy.targetRole}</span><select value={viewRole} onChange={(event) => setViewRole(event.target.value)}>{BUSINESS_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
              <label><span>{copy.viewReason}</span><textarea value={viewReason} onChange={(event) => setViewReason(event.target.value)} required minLength={10} /></label>
              <label><span>{copy.viewTicket}</span><input value={viewTicket} onChange={(event) => setViewTicket(event.target.value)} required minLength={3} /></label>
              <button type='submit' disabled={busy}>{busy ? copy.loading : copy.startViewAs}</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function StateCard({ title, text, action, onAction, busy = false }: { title: string; text: string; action?: string; onAction?: () => void; busy?: boolean }) {
  return <section className='pc-staff-state' aria-live='polite' aria-busy={busy}><span aria-hidden='true'>◆</span><h1>{title}</h1><p>{text}</p>{action && onAction ? <button type='button' onClick={onAction}>{action}</button> : null}</section>;
}

function SectionHeading({ id, title, text }: { id: string; title: string; text: string }) {
  return <header className='pc-staff-section-heading'><span>{title}</span><h2 id={id}>{title}</h2><p>{text}</p></header>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className='pc-staff-metric'><span>{label}</span><strong>{value}</strong></article>;
}

function Notice({ notice }: { notice: { tone: 'ok' | 'error' | 'info'; text: string } }) {
  return <p className='pc-staff-notice' data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>;
}

function Empty({ text }: { text: string }) {
  return <p className='pc-staff-empty'>{text}</p>;
}
