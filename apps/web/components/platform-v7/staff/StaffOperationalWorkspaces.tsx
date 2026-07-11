'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppLocale } from '@/i18n/locale';
import type { StaffOperationalWorkspaceCopy } from '@/i18n/staff-operational-workspace-messages';
import { StaffCriticalActionRequestForm } from './StaffCriticalActionRequestForm';
import { StaffSupportCaseWorkspace } from './StaffSupportCaseWorkspace';
import styles from './StaffOperationalWorkspaces.module.css';

type SessionContext = { active: boolean; session: { accessSessionId: string; staffRole: string; accessMode: string; permissions: string[]; expiresAt: string } | null };
type WorkspaceTab = 'support' | 'operations' | 'finance' | 'diagnostics' | 'people' | 'critical' | 'emergency';
type ApiObject = Record<string, unknown>;
type Props = { locale: AppLocale; copy: StaffOperationalWorkspaceCopy };

const STAFF_ROLES = ['PLATFORM_OWNER','PLATFORM_ADMIN','SUPPORT_L1','SUPPORT_L2','OPERATIONS_AGENT','OPERATIONS_SUPERVISOR','FINANCE_OPS','COMPLIANCE_STAFF','DEVELOPER','SRE_ONCALL','SECURITY_AUDITOR','BREAK_GLASS_ADMIN'] as const;

function csrfToken() {
  if (typeof document === 'undefined') return '';
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : '';
}

async function api<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const method = init?.method || 'GET';
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() } : {}),
    },
    body: method === 'POST' ? JSON.stringify(init?.body || {}) : undefined,
  });
  const payload = await response.json().catch(() => ({})) as ApiObject;
  if (!response.ok) throw new Error(typeof payload.message === 'string' ? payload.message : String(payload.code || 'STAFF_WORKSPACE_ERROR'));
  return payload as T;
}

function text(value: unknown) { return value == null || value === '' ? '—' : String(value); }
function date(value: unknown, locale: AppLocale) {
  const parsed = new Date(String(value || ''));
  if (!Number.isFinite(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}
function array(value: unknown): ApiObject[] { return Array.isArray(value) ? value.filter((item): item is ApiObject => Boolean(item && typeof item === 'object')) : []; }
function object(value: unknown): ApiObject { return value && typeof value === 'object' ? value as ApiObject : {}; }
function uniqueStrings(values: unknown[]) { return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]; }

export function StaffOperationalWorkspaces({ locale, copy }: Props) {
  const [context, setContext] = useState<SessionContext>({ active: false, session: null });
  const [tab, setTab] = useState<WorkspaceTab>('support');
  const [data, setData] = useState<ApiObject | ApiObject[] | null>(null);
  const [organizations, setOrganizations] = useState<ApiObject[]>([]);
  const [organizationUsers, setOrganizationUsers] = useState<Record<string, ApiObject[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [userId, setUserId] = useState('');
  const [staffRole, setStaffRole] = useState<(typeof STAFF_ROLES)[number]>('SUPPORT_L1');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [revokeReasons, setRevokeReasons] = useState<Record<string, string>>({});
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [auditActor, setAuditActor] = useState('');
  const [endReasons, setEndReasons] = useState<Record<string, string>>({});

  const permissions = context.session?.permissions || [];
  const can = useCallback((permission: string) => permissions.includes(permission), [permissions]);
  const availableTabs = useMemo(() => {
    const rows: WorkspaceTab[] = [];
    if (can('support-case:read')) rows.push('support');
    if (can('deal:list')) rows.push('operations');
    if (can('payment:metadata:read')) rows.push('finance');
    if (can('diagnostic:read')) rows.push('diagnostics');
    if (can('staff-assignment:read') || can('user:list')) rows.push('people');
    if (can('critical-action:request') || can('critical-action:approve')) rows.push('critical');
    if (can('staff-session:read')) rows.push('emergency');
    return rows;
  }, [can]);

  const clearPrivilegedState = useCallback(() => {
    setData(null);
    setOrganizations([]);
    setOrganizationUsers({});
  }, []);

  const loadContext = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = await api<SessionContext>('/api/staff/session-context');
      setContext(next);
      if (!next.active || !next.session) clearPrivilegedState();
    } catch (value) {
      setError(value instanceof Error ? value.message : copy.failed);
      setContext({ active: false, session: null });
      clearPrivilegedState();
    } finally { setLoading(false); }
  }, [clearPrivilegedState, copy.failed]);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => {
    const refresh = () => { void loadContext(); };
    window.addEventListener('pc:staff-session-changed', refresh);
    return () => window.removeEventListener('pc:staff-session-changed', refresh);
  }, [loadContext]);
  useEffect(() => {
    if (availableTabs.length && !availableTabs.includes(tab)) setTab(availableTabs[0]);
  }, [availableTabs, tab]);

  const endpoint = useMemo(() => {
    if (tab === 'people') return '/api/staff/workspaces/assignments';
    if (tab === 'emergency') return '/api/staff/workspaces/break-glass';
    if (tab === 'critical') return can('critical-action:approve')
      ? '/api/staff/workspaces/critical-actions'
      : '/api/staff/workspaces/critical-actions/mine';
    return `/api/staff/workspaces/${tab}`;
  }, [can, tab]);

  const loadTab = useCallback(async () => {
    if (!context.active || !availableTabs.includes(tab)) return;
    setLoading(true); setError('');
    try {
      if (tab === 'people') {
        const assignmentRows = can('staff-assignment:read')
          ? await api<ApiObject[]>('/api/staff/workspaces/assignments')
          : [];
        setData(Array.isArray(assignmentRows) ? assignmentRows : []);
        if (can('user:list')) {
          const orgs = await api<ApiObject[]>('/api/staff/organizations');
          setOrganizations(Array.isArray(orgs) ? orgs : []);
        } else {
          setOrganizations([]);
        }
        return;
      }
      const payload = await api<ApiObject | ApiObject[]>(endpoint);
      setData(payload);
    } catch (value) {
      clearPrivilegedState();
      setError(value instanceof Error ? value.message : copy.failed);
    } finally { setLoading(false); }
  }, [availableTabs, can, clearPrivilegedState, context.active, copy.failed, endpoint, tab]);

  useEffect(() => { void loadTab(); }, [loadTab]);

  async function post(path: string, body: unknown, key: string) {
    setBusy(key); setError(''); setNotice('');
    try {
      await api(`/api/staff/workspaces/${path}`, { method: 'POST', body });
      setNotice(copy.saved);
      await loadTab();
    } catch (value) { setError(value instanceof Error ? value.message : copy.failed); }
    finally { setBusy(null); }
  }

  async function createAssignment() {
    if (userId.trim().length < 3 || assignmentReason.trim().length < 10) { setError(copy.failed); return; }
    await post('assignments', { userId: userId.trim(), role: staffRole, reason: assignmentReason.trim(), ...(validUntil ? { validUntil: new Date(validUntil).toISOString() } : {}) }, 'create-assignment');
    setUserId(''); setAssignmentReason(''); setValidUntil('');
  }

  async function loadUsers(organizationId: string) {
    setBusy(`users:${organizationId}`); setError('');
    try {
      const rows = await api<ApiObject[]>(`/api/staff/workspaces/organizations/${encodeURIComponent(organizationId)}/users`);
      setOrganizationUsers((current) => ({ ...current, [organizationId]: Array.isArray(rows) ? rows : [] }));
    } catch (value) { setError(value instanceof Error ? value.message : copy.failed); }
    finally { setBusy(null); }
  }

  if (loading && !context.session && !data) {
    return <section className={styles.section}><div className={styles.locked}><span className={styles.spinner} /> {copy.loading}</div></section>;
  }

  return (
    <section className={styles.section} aria-labelledby="staff-operational-workspaces-title">
      <div className={styles.header}>
        <div><h2 id="staff-operational-workspaces-title">{copy.title}</h2><p>{copy.lead}</p></div>
        <button type="button" className={styles.button} onClick={() => void loadContext()} disabled={Boolean(busy)}>{copy.refresh}</button>
      </div>
      <div className={styles.statusRow} aria-live="polite">
        {!context.active && <div className={styles.locked}>{copy.locked}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}
        {error && <div className={styles.error}>{error}</div>}
      </div>
      {context.active && context.session && (
        <>
          <div className={styles.metricGrid}>
            <div className={styles.metric}><span>{copy.labels.actor}</span><strong>{copy.roles[context.session.staffRole] || context.session.staffRole}</strong></div>
            <div className={styles.metric}><span>{copy.labels.mode}</span><strong>{context.session.accessMode}</strong></div>
            <div className={styles.metric}><span>{copy.labels.expires}</span><strong>{date(context.session.expiresAt, locale)}</strong></div>
            <div className={styles.metric}><span>{copy.labels.active}</span><strong>{permissions.length}</strong></div>
          </div>
          <nav className={styles.tabs} aria-label={copy.title}>
            {availableTabs.map((item) => <button key={item} type="button" aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{copy.tabs[item]}</button>)}
          </nav>
          {loading ? <div className={styles.locked}><span className={styles.spinner} /> {copy.loading}</div> : null}
          {!loading && tab === 'support' && (() => {
          const supportData = object(data);
          const supportDeals = array(supportData.deals);
          const supportTasks = array(supportData.kycTasks);
          const organizationIds = uniqueStrings([
            ...supportDeals.flatMap((row) => [object(row.seller).id, object(row.buyer).id]),
            ...supportTasks.flatMap((row) => [row.organizationId, object(row.organization).id]),
          ]);
          const dealIds = uniqueStrings(supportDeals.map((row) => row.id));
          return <>
            <SupportPanel payload={supportData} copy={copy} locale={locale} />
            <StaffSupportCaseWorkspace
              locale={locale}
              permissions={permissions}
              suggestedOrganizationIds={organizationIds}
              suggestedDealIds={dealIds}
              onError={setError}
              onNotice={setNotice}
            />
          </>;
        })()}
          {!loading && tab === 'operations' && <OperationsPanel payload={object(data)} copy={copy} locale={locale} />}
          {!loading && tab === 'finance' && <FinancePanel payload={object(data)} copy={copy} locale={locale} />}
          {!loading && tab === 'diagnostics' && <DiagnosticsPanel payload={object(data)} copy={copy} locale={locale} />}
          {!loading && tab === 'people' && <PeoplePanel rows={array(data)} organizations={organizations} organizationUsers={organizationUsers} copy={copy} locale={locale} canWrite={can('staff-assignment:write')} busy={busy} userId={userId} setUserId={setUserId} staffRole={staffRole} setStaffRole={setStaffRole} assignmentReason={assignmentReason} setAssignmentReason={setAssignmentReason} validUntil={validUntil} setValidUntil={setValidUntil} createAssignment={createAssignment} revokeReasons={revokeReasons} setRevokeReasons={setRevokeReasons} revoke={(id, reason) => post(`assignments/${encodeURIComponent(id)}/revoke`, { reason }, `revoke:${id}`)} loadUsers={loadUsers} />}
          {!loading && tab === 'critical' && <div className={styles.grid}>
          {can('critical-action:request') && <StaffCriticalActionRequestForm locale={locale} enabled={context.active} onCreated={loadTab} onError={setError} onNotice={setNotice} />}
          <CriticalPanel rows={array(data)} copy={copy} locale={locale} busy={busy} canApprove={can('critical-action:approve')} decisionReasons={decisionReasons} setDecisionReasons={setDecisionReasons} decide={(id, decision, reason) => post(`critical-actions/${encodeURIComponent(id)}/decision`, { decision, reason }, `critical:${id}`)} />
        </div>}
          {!loading && tab === 'emergency' && <EmergencyPanel rows={array(data)} copy={copy} locale={locale} busy={busy} endReasons={endReasons} setEndReasons={setEndReasons} end={(id, reason) => post(`break-glass/${encodeURIComponent(id)}/end`, { reason }, `emergency:${id}`)} auditActor={auditActor} setAuditActor={setAuditActor} verify={async () => { if (!auditActor.trim()) return; setBusy('verify'); try { const result = await api<ApiObject>(`/api/staff/workspaces/audit/actors/${encodeURIComponent(auditActor.trim())}/verify?limit=10000`); setNotice(`${copy.saved} ${text(result.checked)}`); } catch (value) { setError(value instanceof Error ? value.message : copy.failed); } finally { setBusy(null); } }} />}
        </>
      )}
    </section>
  );
}

function SupportPanel({ payload, copy, locale }: { payload: ApiObject; copy: StaffOperationalWorkspaceCopy; locale: AppLocale }) {
  const deals = array(payload.deals); const tasks = array(payload.kycTasks);
  return <div className={`${styles.grid} ${styles.three}`}><Panel title={copy.tabs.support}><div className={styles.metricGrid}><Metric label={copy.labels.deal} value={deals.length} /><Metric label={copy.labels.kyc} value={tasks.length} /></div></Panel><Panel title={copy.labels.blocker} span>{deals.length ? <div className={styles.list}>{deals.map((row) => <article className={styles.card} key={text(row.id)}><header><div><strong>{text(row.dealNumber || row.id)}</strong><small>{text(object(row.seller).name)} → {text(object(row.buyer).name)}</small></div><Badge value={text(row.status)} bad={Boolean(row.overdue)} /></header><Details rows={[[copy.labels.nextAction,row.nextAction],[copy.labels.sla,date(row.slaAt,locale)],[copy.labels.blocker,array(row.blockers).map((item)=>text(item.blocker)).join('; ')]]} /></article>)}</div> : <Empty copy={copy} />}</Panel><Panel title={copy.labels.kyc}>{tasks.length ? <div className={styles.list}>{tasks.map((row) => <article className={styles.card} key={text(row.id)}><header><strong>{text(object(row.organization).name || row.organizationId)}</strong><Badge value={text(row.status)} /></header><Details rows={[[copy.labels.event,row.type],[copy.labels.updated,date(row.updatedAt,locale)]]} /></article>)}</div> : <Empty copy={copy} />}</Panel></div>;
}

function OperationsPanel({ payload, copy, locale }: { payload: ApiObject; copy: StaffOperationalWorkspaceCopy; locale: AppLocale }) {
  const rows = array(payload.items);
  return <div className={styles.grid}><Panel title={copy.tabs.operations} span>{rows.length ? <div className={styles.list}>{rows.map((row) => { const shipment = object(row.shipmentSummary); const documents = object(row.documentSummary); return <article className={styles.card} key={text(row.id)}><header><div><strong>{text(row.dealNumber || row.id)}</strong><small>{text(object(row.seller).name)} → {text(object(row.buyer).name)}</small></div><Badge value={text(row.status)} bad={Boolean(row.overdue) || Number(shipment.blocked || 0) > 0} /></header><Details rows={[[copy.labels.nextAction,row.nextAction],[copy.labels.sla,date(row.slaAt,locale)],[copy.labels.shipments,`${text(shipment.active)} / ${text(shipment.total)} · ${copy.labels.blocker}: ${text(shipment.blocked)}`],[copy.labels.documents,`${text(documents.pending)} / ${text(documents.total)}`],[copy.labels.disputes,row.openDisputes],[copy.labels.payment,object(row.payment).status]]} /></article>; })}</div> : <Empty copy={copy} />}</Panel></div>;
}

function FinancePanel({ payload, copy, locale }: { payload: ApiObject; copy: StaffOperationalWorkspaceCopy; locale: AppLocale }) {
  const payments = array(payload.payments); const operations = array(payload.bankOperations);
  return <div className={styles.grid}><Panel title={copy.labels.payment}>{payments.length ? <div className={styles.list}>{payments.map((row) => <article className={styles.card} key={text(row.id)}><header><strong>{text(object(row.deal).dealNumber || row.dealId)}</strong><Badge value={text(row.status)} bad={['FAILED','REJECTED','ERROR'].includes(text(row.status))} /></header><Details rows={[[copy.labels.amount,row.amountKopecks],[copy.labels.callbacks,row.callbackState],[copy.labels.updated,date(row.updatedAt,locale)]]} /></article>)}</div> : <Empty copy={copy} />}</Panel><Panel title={copy.labels.bankOperation}>{operations.length ? <div className={styles.list}>{operations.map((row) => <article className={styles.card} key={text(row.id)}><header><strong>{text(row.type)} · {text(object(row.deal).dealNumber || row.dealId)}</strong><Badge value={text(row.status)} bad={Boolean(row.failureReason)} /></header><Details rows={[[copy.labels.amount,row.amountKopecks],[copy.labels.error,row.failureReason],[copy.labels.updated,date(row.updatedAt,locale)]]} /></article>)}</div> : <Empty copy={copy} />}</Panel></div>;
}

function DiagnosticsPanel({ payload, copy, locale }: { payload: ApiObject; copy: StaffOperationalWorkspaceCopy; locale: AppLocale }) {
  const integrations = array(payload.integrations); const outbox = array(payload.outbox); const runtime = array(payload.runtimeAttempts);
  return <div className={styles.grid}><Panel title={copy.labels.integration}>{integrations.length ? <div className={styles.list}>{integrations.map((row) => <DiagnosticCard key={text(row.id)} title={`${text(row.adapterName)} · ${text(row.eventType)}`} status={text(row.status)} error={row.errorMessage} correlation={row.id} updated={row.createdAt} copy={copy} locale={locale} />)}</div> : <Empty copy={copy} />}</Panel><Panel title={copy.labels.outbox}>{outbox.length ? <div className={styles.list}>{outbox.map((row) => <DiagnosticCard key={text(row.id)} title={`${text(row.type)} · ${text(row.dealId)}`} status={text(row.status)} error={row.lastError} correlation={row.correlationId} updated={row.createdAt} copy={copy} locale={locale} extra={`${copy.labels.retries}: ${text(row.retryCount)} / ${text(row.maxRetries)}`} />)}</div> : <Empty copy={copy} />}</Panel><Panel title={copy.labels.runtime} span>{runtime.length ? <div className={styles.list}>{runtime.map((row) => <DiagnosticCard key={text(row.id)} title={`${text(row.stage)} · ${text(row.transactionId)}`} status={text(row.outcome)} error={row.failureReason || row.failureCode} correlation={row.correlationId} updated={row.startedAt} copy={copy} locale={locale} />)}</div> : <Empty copy={copy} />}</Panel></div>;
}

function PeoplePanel(props: { rows: ApiObject[]; organizations: ApiObject[]; organizationUsers: Record<string, ApiObject[]>; copy: StaffOperationalWorkspaceCopy; locale: AppLocale; canWrite: boolean; busy: string | null; userId: string; setUserId: (v:string)=>void; staffRole: (typeof STAFF_ROLES)[number]; setStaffRole: (v:(typeof STAFF_ROLES)[number])=>void; assignmentReason:string; setAssignmentReason:(v:string)=>void; validUntil:string; setValidUntil:(v:string)=>void; createAssignment:()=>Promise<void>; revokeReasons:Record<string,string>; setRevokeReasons:(v:Record<string,string>)=>void; revoke:(id:string,reason:string)=>Promise<void>; loadUsers:(id:string)=>Promise<void> }) {
  const { rows, organizations, organizationUsers, copy, locale } = props;
  return <div className={styles.grid}><Panel title={copy.tabs.people}>{props.canWrite && <div className={`${styles.form} ${styles.two}`}><label><span>{copy.labels.userId}</span><input value={props.userId} onChange={(event)=>props.setUserId(event.target.value)} /></label><label><span>{copy.labels.role}</span><select value={props.staffRole} onChange={(event)=>props.setStaffRole(event.target.value as (typeof STAFF_ROLES)[number])}>{STAFF_ROLES.map((role)=><option key={role} value={role}>{copy.roles[role] || role}</option>)}</select></label><label><span>{copy.labels.validUntil}</span><input type="datetime-local" value={props.validUntil} onChange={(event)=>props.setValidUntil(event.target.value)} /></label><label className={styles.full}><span>{copy.actions.assignmentReason}</span><textarea value={props.assignmentReason} onChange={(event)=>props.setAssignmentReason(event.target.value)} /></label><button type="button" className={styles.primary} onClick={()=>void props.createAssignment()} disabled={props.busy==='create-assignment'}>{copy.actions.create}</button></div>}<div className={styles.list}>{rows.length ? rows.map((row)=><article className={styles.card} key={text(row.id)}><header><div><strong>{copy.roles[text(row.role)] || text(row.role)}</strong><small>{text(row.email || row.user_id || row.userId)}</small></div><Badge value={text(row.status)} /></header><Details rows={[[copy.labels.validUntil,date(row.valid_until || row.validUntil,locale)],[copy.labels.reason,row.reason]]} />{props.canWrite && <div className={styles.actions}><input value={props.revokeReasons[text(row.id)] || ''} onChange={(event)=>props.setRevokeReasons({...props.revokeReasons,[text(row.id)]:event.target.value})} placeholder={copy.actions.revokeReason} /><button type="button" className={styles.danger} onClick={()=>void props.revoke(text(row.id),props.revokeReasons[text(row.id)] || '')} disabled={(props.revokeReasons[text(row.id)] || '').trim().length<10}>{copy.actions.revoke}</button></div>}</article>) : <Empty copy={copy} />}</div></Panel><Panel title={copy.labels.members}>{organizations.length ? <div className={styles.list}>{organizations.map((org)=><article className={styles.card} key={text(org.id)}><header><div><strong>{text(org.name)}</strong><small>{text(org.inn)}</small></div><button type="button" className={styles.button} onClick={()=>void props.loadUsers(text(org.id))} disabled={props.busy===`users:${text(org.id)}`}>{copy.actions.loadUsers}</button></header>{organizationUsers[text(org.id)] && <div className={styles.list}>{organizationUsers[text(org.id)].map((member)=><article className={styles.card} key={text(member.membership_id || member.id)}><strong>{text(member.full_name || object(member.user).fullName)}</strong><small>{text(member.email || object(member.user).email)} · {text(member.role)} · {copy.labels.mfa}: {text(member.mfa_enabled ?? object(member.user).mfaEnabled)}</small></article>)}</div>}</article>)}</div> : <Empty copy={copy} />}</Panel></div>;
}

function CriticalPanel(props: { rows:ApiObject[]; copy:StaffOperationalWorkspaceCopy; locale:AppLocale; busy:string|null; canApprove:boolean; decisionReasons:Record<string,string>; setDecisionReasons:(v:Record<string,string>)=>void; decide:(id:string,decision:'APPROVE'|'DENY',reason:string)=>Promise<void> }) {
  return <div className={styles.grid}><Panel title={props.copy.tabs.critical} span>{props.rows.length ? <div className={styles.list}>{props.rows.map((row)=><article className={styles.card} key={text(row.id)}><header><div><strong>{text(row.action)}</strong><small>{text(row.resource_type)} · {text(row.resource_id)}</small></div><Badge value={text(row.status)} /></header><Details rows={[[props.copy.labels.actor,row.requester_user_id],[props.copy.labels.approvals,`${text(row.approvals)} / ${text(row.required_approvals)}`],[props.copy.labels.expires,date(row.expires_at,props.locale)]]} />{props.canApprove && <div className={`${styles.form} ${styles.actions}`}><input value={props.decisionReasons[text(row.id)] || ''} onChange={(event)=>props.setDecisionReasons({...props.decisionReasons,[text(row.id)]:event.target.value})} placeholder={props.copy.actions.decisionReason} /><button type="button" className={styles.primary} onClick={()=>void props.decide(text(row.id),'APPROVE',props.decisionReasons[text(row.id)] || '')} disabled={(props.decisionReasons[text(row.id)] || '').trim().length<5}>{props.copy.actions.approve}</button><button type="button" className={styles.danger} onClick={()=>void props.decide(text(row.id),'DENY',props.decisionReasons[text(row.id)] || '')} disabled={(props.decisionReasons[text(row.id)] || '').trim().length<5}>{props.copy.actions.deny}</button></div>}</article>)}</div> : <Empty copy={props.copy} />}</Panel></div>;
}

function EmergencyPanel(props: { rows:ApiObject[]; copy:StaffOperationalWorkspaceCopy; locale:AppLocale; busy:string|null; endReasons:Record<string,string>; setEndReasons:(v:Record<string,string>)=>void; end:(id:string,reason:string)=>Promise<void>; auditActor:string; setAuditActor:(v:string)=>void; verify:()=>Promise<void> }) {
  return <div className={styles.grid}><Panel title={props.copy.tabs.emergency}>{props.rows.length ? <div className={styles.list}>{props.rows.map((row)=><article className={styles.card} key={text(row.id)}><header><strong>{text(row.role)}</strong><Badge value={text(row.status)} bad /></header><Details rows={[[props.copy.labels.actor,row.actor_user_id],[props.copy.labels.ticket,row.ticket_id],[props.copy.labels.expires,date(row.expires_at,props.locale)],[props.copy.labels.reason,row.reason]]} /><div className={styles.actions}><input value={props.endReasons[text(row.id)] || ''} onChange={(event)=>props.setEndReasons({...props.endReasons,[text(row.id)]:event.target.value})} placeholder={props.copy.labels.reason} /><button type="button" className={styles.danger} onClick={()=>void props.end(text(row.id),props.endReasons[text(row.id)] || '')} disabled={(props.endReasons[text(row.id)] || '').trim().length<10}>{props.copy.actions.end}</button></div></article>)}</div> : <Empty copy={props.copy} />}</Panel><Panel title={props.copy.actions.verify}><div className={styles.form}><label><span>{props.copy.labels.actor}</span><input value={props.auditActor} onChange={(event)=>props.setAuditActor(event.target.value)} /></label><button type="button" className={styles.primary} onClick={()=>void props.verify()} disabled={!props.auditActor.trim() || props.busy==='verify'}>{props.copy.actions.verify}</button></div></Panel></div>;
}

function Panel({ title, span, children }: { title:string; span?:boolean; children:ReactNode }) { return <article className={`${styles.panel} ${span ? styles.span2 : ''}`}><h3>{title}</h3>{children}</article>; }
function Metric({ label, value }: { label:string; value:unknown }) { return <div className={styles.metric}><span>{label}</span><strong>{text(value)}</strong></div>; }
function Empty({ copy }: { copy:StaffOperationalWorkspaceCopy }) { return <p className={styles.empty}>{copy.empty}</p>; }
function Badge({ value, bad }: { value:string; bad?:boolean }) { return <span className={`${styles.badge} ${bad ? styles.bad : ''}`}>{value}</span>; }
function Details({ rows }: { rows:Array<[string,unknown]> }) { return <dl className={styles.details}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}</dl>; }
function DiagnosticCard({ title,status,error,correlation,updated,extra,copy,locale }: { title:string; status:string; error:unknown; correlation:unknown; updated:unknown; extra?:string; copy:StaffOperationalWorkspaceCopy; locale:AppLocale }) { return <article className={styles.card}><header><strong>{title}</strong><Badge value={status} bad={Boolean(error)} /></header><Details rows={[[copy.labels.error,error],[copy.labels.correlation,correlation],[copy.labels.updated,date(updated,locale)],...(extra ? [[copy.labels.retries,extra] as [string,unknown]] : [])]} /></article>; }
