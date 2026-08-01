'use client';

import * as React from 'react';
import { applyCsrfHeader } from '@/lib/csrf';
import type { OrganizationTeamMember } from '@/lib/organization-team-server';
import styles from './OrganizationTeamAdminClient.module.css';

type Locale = 'ru' | 'en' | 'zh';
type Invitation = {
  invitationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  version: string;
  correlationId: string;
};
type JoinRequest = {
  applicationId: string;
  status: string;
  requestedWorkspace: string;
  requestedRole: string;
  applicant: { fullName: string; email: string; phone: string; position: string };
  submittedAt: string;
  version: string;
  correlationId: string;
};

const COPY = {
  ru: {
    title: 'Управление доступом', inviteTitle: 'Пригласить сотрудника', email: 'Рабочий email', role: 'Роль', invite: 'Отправить приглашение', sending: 'Отправляем…',
    invitations: 'Приглашения', joins: 'Заявки на присоединение', members: 'Действующие доступы', emptyInvitations: 'Приглашений пока нет.', emptyJoins: 'Новых заявок нет.',
    resend: 'Отправить повторно', revokeInvitation: 'Отозвать приглашение', approve: 'Одобрить', reject: 'Отклонить', reason: 'Основание решения',
    changeRole: 'Сохранить роль', revokeMember: 'Отозвать доступ', resetMfa: 'Инициировать восстановление MFA', mfaRecoverySent: 'Одноразовая ссылка отправлена сотруднику. MFA и доступ пока не изменены.', admin: 'Администратор организации', mfa: 'Для управления нужна свежая MFA.',
    stepUpTitle: 'Подтвердить MFA', stepUpLead: 'Введи текущий код TOTP или резервный код. Активная сессия останется открытой.', stepUpStart: 'Начать проверку', stepUpCode: 'Код MFA', stepUpVerify: 'Подтвердить', stepUpRestart: 'Начать заново', stepUpInvalid: 'Код не подтверждён. Начни проверку заново.',
    unavailable: 'Сервер не выполнил команду. Доступ не изменён.', success: 'Команда выполнена.', expires: 'Истекает', status: 'Статус', correlation: 'ID', activeSessions: 'Активных сессий', lastSeen: 'Последняя активность', confirmRevoke: 'Отозвать доступ этого сотрудника и все его сессии?',
  },
  en: {
    title: 'Access management', inviteTitle: 'Invite employee', email: 'Work email', role: 'Role', invite: 'Send invitation', sending: 'Sending…',
    invitations: 'Invitations', joins: 'Join requests', members: 'Current access', emptyInvitations: 'No invitations yet.', emptyJoins: 'No new requests.',
    resend: 'Resend', revokeInvitation: 'Revoke invitation', approve: 'Approve', reject: 'Reject', reason: 'Decision reason', changeRole: 'Save role', revokeMember: 'Revoke access',
    resetMfa: 'Initiate MFA recovery', mfaRecoverySent: 'A single-use link was sent to the employee. MFA and access have not changed yet.', admin: 'Organization administrator', mfa: 'Fresh MFA is required.', stepUpTitle: 'Confirm MFA', stepUpLead: 'Enter your current TOTP or backup code. Your active session stays open.', stepUpStart: 'Start verification', stepUpCode: 'MFA code', stepUpVerify: 'Confirm', stepUpRestart: 'Start again', stepUpInvalid: 'The code was not confirmed. Start verification again.', unavailable: 'The server did not execute the command. Access was not changed.', success: 'Command completed.', expires: 'Expires', status: 'Status', correlation: 'ID', activeSessions: 'Active sessions', lastSeen: 'Last activity', confirmRevoke: 'Revoke this employee access and all related sessions?',
  },
  zh: {
    title: '访问管理', inviteTitle: '邀请员工', email: '工作邮箱', role: '角色', invite: '发送邀请', sending: '正在发送…', invitations: '邀请', joins: '加入申请', members: '当前访问权限',
    emptyInvitations: '暂无邀请。', emptyJoins: '暂无新申请。', resend: '重新发送', revokeInvitation: '撤销邀请', approve: '批准', reject: '拒绝', reason: '决定依据', changeRole: '保存角色', revokeMember: '撤销访问权限', resetMfa: '发起 MFA 恢复', mfaRecoverySent: '一次性链接已发送给员工。MFA 和访问权限尚未更改。',
    admin: '组织管理员', mfa: '管理操作需要最新 MFA。', stepUpTitle: '确认 MFA', stepUpLead: '请输入当前 TOTP 或备用代码。活动会话将保持打开。', stepUpStart: '开始验证', stepUpCode: 'MFA 代码', stepUpVerify: '确认', stepUpRestart: '重新开始', stepUpInvalid: '代码未通过验证。请重新开始。', unavailable: '服务器未执行命令。访问权限未更改。', success: '命令已完成。', expires: '到期时间', status: '状态', correlation: 'ID', activeSessions: '活动会话', lastSeen: '最后活动', confirmRevoke: '撤销该员工的访问权限和所有相关会话？',
  },
} as const;

const ROLE_LABELS: Record<Locale, Record<string, string>> = {
  ru: { FARMER: 'Продавец', BUYER: 'Покупатель', LOGISTICIAN: 'Логистика', DRIVER: 'Водитель', ELEVATOR: 'Элеватор', LAB: 'Лаборатория', SURVEYOR: 'Сюрвейер', ACCOUNTING: 'Финансы', GUEST: 'Сотрудник' },
  en: { FARMER: 'Seller', BUYER: 'Buyer', LOGISTICIAN: 'Logistics', DRIVER: 'Driver', ELEVATOR: 'Elevator', LAB: 'Laboratory', SURVEYOR: 'Surveyor', ACCOUNTING: 'Finance', GUEST: 'Employee' },
  zh: { FARMER: '卖方', BUYER: '买方', LOGISTICIAN: '物流', DRIVER: '司机', ELEVATOR: '粮库', LAB: '实验室', SURVEYOR: '检验员', ACCOUNTING: '财务', GUEST: '员工' },
};

const ROLE_CEILING: Record<string, string[]> = {
  FARMER: ['FARMER', 'GUEST'], BUYER: ['BUYER', 'GUEST'], LOGISTICIAN: ['LOGISTICIAN', 'DRIVER', 'GUEST'],
  DRIVER: ['DRIVER', 'GUEST'], ELEVATOR: ['ELEVATOR', 'LAB', 'GUEST'], LAB: ['LAB', 'GUEST'],
  SURVEYOR: ['SURVEYOR', 'GUEST'], ACCOUNTING: ['ACCOUNTING', 'GUEST'], GUEST: ['GUEST'],
};

async function readJson(response: Response) {
  return response.json().catch(() => ({} as Record<string, unknown>)) as Promise<Record<string, unknown>>;
}

export function OrganizationTeamAdminClient({
  locale,
  currentRole,
  hasFreshMfa,
  currentMembershipId,
  members,
}: {
  locale: Locale;
  currentRole: string;
  hasFreshMfa: boolean;
  currentMembershipId: string;
  members: readonly OrganizationTeamMember[];
}) {
  const copy = COPY[locale];
  const roles = ROLE_CEILING[currentRole] || ['GUEST'];
  const [freshMfa, setFreshMfa] = React.useState(hasFreshMfa);
  const [stepUpStarted, setStepUpStarted] = React.useState(false);
  const [stepUpCode, setStepUpCode] = React.useState('');
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [joins, setJoins] = React.useState<JoinRequest[]>([]);
  const [loading, setLoading] = React.useState(freshMfa);
  const [busy, setBusy] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [joinReasons, setJoinReasons] = React.useState<Record<string, string>>({});
  const [memberRoles, setMemberRoles] = React.useState<Record<string, string>>(
    () => Object.fromEntries(members.map((member) => [member.membershipId, member.role])),
  );
  const inviteKey = React.useRef(globalThis.crypto?.randomUUID?.() || `invite-${Date.now()}`);

  const refresh = React.useCallback(async () => {
    if (!freshMfa) return;
    setLoading(true);
    try {
      const [invitationResponse, joinResponse] = await Promise.all([
        fetch('/api/proxy/auth/organization-invitations', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/proxy/auth/organization-join-requests', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      const invitationPayload = await readJson(invitationResponse);
      const joinPayload = await readJson(joinResponse);
      if (!invitationResponse.ok || !joinResponse.ok) throw new Error('load_failed');
      setInvitations(Array.isArray(invitationPayload.invitations) ? invitationPayload.invitations as Invitation[] : []);
      setJoins(Array.isArray(joinPayload.applications) ? joinPayload.applications as JoinRequest[] : []);
    } catch {
      setError(copy.unavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.unavailable, freshMfa]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  async function beginStepUp() {
    if (busy) return;
    setBusy('mfa-step-up-start'); setError(''); setMessage(''); setStepUpCode('');
    try {
      const response = await fetch('/api/auth/mfa-step-up/start', {
        method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }), body: '{}',
        cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('step_up_start_failed');
      setStepUpStarted(true);
    } catch {
      setError(copy.unavailable);
      setStepUpStarted(false);
    } finally { setBusy(''); }
  }

  async function verifyStepUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = stepUpCode.trim();
    if (busy || !/^(?:\d{6}|[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4})$/.test(code)) {
      setError(copy.stepUpInvalid);
      return;
    }
    setBusy('mfa-step-up-verify'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/mfa-step-up/verify', {
        method: 'POST', headers: applyCsrfHeader({ 'Content-Type': 'application/json' }), body: JSON.stringify({ code }),
        cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10_000),
      });
      const payload = await readJson(response);
      if (!response.ok || payload.mfaVerified !== true) throw new Error('step_up_verify_failed');
      setFreshMfa(true);
      setStepUpStarted(false);
      setStepUpCode('');
      setMessage(copy.success);
    } catch {
      setError(copy.stepUpInvalid);
      setStepUpStarted(false);
      setStepUpCode('');
    } finally { setBusy(''); }
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const role = String(form.get('role') || 'GUEST');
    setBusy('invite'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/organization-invitations', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': inviteKey.current }),
        body: JSON.stringify({ email, role, locale }),
        cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.correlationId || ''));
      inviteKey.current = globalThis.crypto?.randomUUID?.() || `invite-${Date.now()}`;
      event.currentTarget.reset();
      setMessage(`${copy.success} ${copy.correlation}: ${String(payload.correlationId || '—')}`);
      await refresh();
    } catch (cause) {
      const id = cause instanceof Error ? cause.message : '';
      setError(`${copy.unavailable}${id ? ` ${copy.correlation}: ${id}` : ''}`);
    } finally { setBusy(''); }
  }

  async function invitationCommand(invitationId: string, command: 'resend' | 'revoke') {
    if (busy) return;
    setBusy(`${command}:${invitationId}`); setError(''); setMessage('');
    try {
      const dedicated = command === 'resend';
      const url = dedicated
        ? `/api/auth/organization-invitations/${encodeURIComponent(invitationId)}/resend`
        : `/api/proxy/auth/organization-invitations/${encodeURIComponent(invitationId)}/revoke`;
      const response = await fetch(url, {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': globalThis.crypto.randomUUID() }),
        body: JSON.stringify({ reason: command === 'resend' ? 'Resent by organization administrator' : 'Revoked by organization administrator', locale }),
        cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.correlationId || ''));
      setMessage(`${copy.success} ${copy.correlation}: ${String(payload.correlationId || '—')}`);
      await refresh();
    } catch (cause) {
      const id = cause instanceof Error ? cause.message : '';
      setError(`${copy.unavailable}${id ? ` ${copy.correlation}: ${id}` : ''}`);
    } finally { setBusy(''); }
  }

  async function decideJoin(applicationId: string, decision: 'APPROVE' | 'REJECT') {
    if (busy) return;
    const reason = String(joinReasons[applicationId] || '').trim();
    if (reason.length < 8) { setError(copy.reason); return; }
    setBusy(`join:${applicationId}`); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/auth/organization-join-requests/${encodeURIComponent(applicationId)}/decision`, {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': globalThis.crypto.randomUUID() }),
        body: JSON.stringify({ decision, reason, locale }), cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.correlationId || ''));
      setMessage(`${copy.success} ${copy.correlation}: ${String(payload.correlationId || '—')}`);
      await refresh();
      window.location.reload();
    } catch (cause) {
      const id = cause instanceof Error ? cause.message : '';
      setError(`${copy.unavailable}${id ? ` ${copy.correlation}: ${id}` : ''}`);
    } finally { setBusy(''); }
  }

  async function memberCommand(member: OrganizationTeamMember, command: 'role' | 'revoke' | 'mfa-reset') {
    if (busy || member.membershipId === currentMembershipId) return;
    if (command === 'revoke' && !window.confirm(copy.confirmRevoke)) return;
    setBusy(`${command}:${member.membershipId}`); setError(''); setMessage('');
    try {
      const url = command === 'mfa-reset'
        ? `/api/auth/organization-memberships/${encodeURIComponent(member.membershipId)}/mfa-recovery`
        : `/api/proxy/auth/organization-memberships/${encodeURIComponent(member.membershipId)}/${command}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json', 'idempotency-key': globalThis.crypto.randomUUID() }),
        body: JSON.stringify({
          version: member.version,
          reason: command === 'role'
            ? 'Role changed by organization administrator'
            : command === 'mfa-reset'
              ? 'Controlled MFA recovery initiated; subject confirmation required'
              : 'Access revoked by organization administrator',
          ...(command === 'role' ? { role: memberRoles[member.membershipId] || member.role } : {}),
          ...(command === 'mfa-reset' ? { locale } : {}),
        }),
        cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(String(payload.correlationId || ''));
      setMessage(`${command === 'mfa-reset' ? copy.mfaRecoverySent : copy.success} ${copy.correlation}: ${String(payload.correlationId || '—')}`);
      window.location.reload();
    } catch (cause) {
      const id = cause instanceof Error ? cause.message : '';
      setError(`${copy.unavailable}${id ? ` ${copy.correlation}: ${id}` : ''}`);
    } finally { setBusy(''); }
  }

  if (!freshMfa) return <section className={styles.panel} aria-labelledby='team-step-up-title'>
    <h2 id='team-step-up-title'>{copy.stepUpTitle}</h2>
    <p>{copy.mfa} {copy.stepUpLead}</p>
    {error ? <p className={styles.error} role='alert'>{error}</p> : null}
    {!stepUpStarted ? <button type='button' onClick={() => void beginStepUp()} disabled={Boolean(busy)}>{copy.stepUpStart}</button> : (
      <form className={styles.form} onSubmit={verifyStepUp}>
        <label><span>{copy.stepUpCode}</span><input value={stepUpCode} onChange={(event) => setStepUpCode(event.target.value)} required autoComplete='one-time-code' inputMode='text' maxLength={32} autoFocus /></label>
        <div className={styles.actions}>
          <button type='submit' disabled={Boolean(busy)}>{copy.stepUpVerify}</button>
          <button type='button' onClick={() => void beginStepUp()} disabled={Boolean(busy)}>{copy.stepUpRestart}</button>
        </div>
      </form>
    )}
  </section>;

  return (
    <section className={styles.panel} aria-labelledby='team-admin-title'>
      <h2 id='team-admin-title'>{copy.title}</h2>
      {error ? <p className={styles.error} role='alert'>{error}</p> : null}
      {message ? <p className={styles.success} role='status'>{message}</p> : null}

      <form className={styles.form} onSubmit={invite}>
        <h3>{copy.inviteTitle}</h3>
        <label><span>{copy.email}</span><input name='email' type='email' required maxLength={254} autoComplete='email' /></label>
        <label><span>{copy.role}</span><select name='role' defaultValue={roles[0]}>{roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[locale][role] || role}</option>)}</select></label>
        <button type='submit' disabled={Boolean(busy)}>{busy === 'invite' ? copy.sending : copy.invite}</button>
      </form>

      <div className={styles.section}>
        <h3>{copy.invitations}</h3>
        {loading ? <p aria-live='polite'>…</p> : invitations.length ? <ul className={styles.list}>{invitations.map((item) => <li key={item.invitationId}>
          <div><strong>{item.email}</strong><span>{ROLE_LABELS[locale][item.role] || item.role} · {copy.status}: {item.status} · {copy.expires}: {new Date(item.expiresAt).toLocaleString()}</span></div>
          {item.status === 'PENDING' ? <div className={styles.actions}>
            <button type='button' onClick={() => void invitationCommand(item.invitationId, 'resend')} disabled={Boolean(busy)}>{copy.resend}</button>
            <button type='button' className={styles.danger} onClick={() => void invitationCommand(item.invitationId, 'revoke')} disabled={Boolean(busy)}>{copy.revokeInvitation}</button>
          </div> : null}
        </li>)}</ul> : <p>{copy.emptyInvitations}</p>}
      </div>

      <div className={styles.section}>
        <h3>{copy.joins}</h3>
        {loading ? <p aria-live='polite'>…</p> : joins.length ? <ul className={styles.list}>{joins.map((item) => <li key={item.applicationId}>
          <div><strong>{item.applicant.fullName} · {item.applicant.email}</strong><span>{item.applicant.position} · {item.requestedWorkspace} / {ROLE_LABELS[locale][item.requestedRole] || item.requestedRole}</span></div>
          <label className={styles.reason}><span>{copy.reason}</span><textarea value={joinReasons[item.applicationId] || ''} minLength={8} maxLength={500} onChange={(event) => setJoinReasons((current) => ({ ...current, [item.applicationId]: event.target.value }))} /></label>
          <div className={styles.actions}>
            <button type='button' onClick={() => void decideJoin(item.applicationId, 'APPROVE')} disabled={Boolean(busy)}>{copy.approve}</button>
            <button type='button' className={styles.danger} onClick={() => void decideJoin(item.applicationId, 'REJECT')} disabled={Boolean(busy)}>{copy.reject}</button>
          </div>
        </li>)}</ul> : <p>{copy.emptyJoins}</p>}
      </div>

      <div className={styles.section}>
        <h3>{copy.members}</h3>
        <ul className={styles.list}>{members.map((member) => <li key={member.membershipId}>
          <div><strong>{member.fullName} · {member.email}</strong><span>{member.membershipStatus}{member.isOrgAdmin ? ` · ${copy.admin}` : ''}{member.activeSessionCount !== null ? ` · ${copy.activeSessions}: ${member.activeSessionCount}${member.lastSessionSeenAt ? ` · ${copy.lastSeen}: ${new Date(member.lastSessionSeenAt).toLocaleString(locale)}` : ''}` : ''}</span></div>
          {member.membershipId !== currentMembershipId && member.membershipStatus === 'ACTIVE' ? <div className={styles.memberControls}>
            <select aria-label={`${copy.role}: ${member.fullName}`} value={memberRoles[member.membershipId] || member.role} onChange={(event) => setMemberRoles((current) => ({ ...current, [member.membershipId]: event.target.value }))}>
              {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[locale][role] || role}</option>)}
            </select>
            <button type='button' onClick={() => void memberCommand(member, 'role')} disabled={Boolean(busy)}>{copy.changeRole}</button>
            <button type='button' onClick={() => void memberCommand(member, 'mfa-reset')} disabled={Boolean(busy)}>{copy.resetMfa}</button>
            <button type='button' className={styles.danger} onClick={() => void memberCommand(member, 'revoke')} disabled={Boolean(busy)}>{copy.revokeMember}</button>
          </div> : null}
        </li>)}</ul>
      </div>
    </section>
  );
}
