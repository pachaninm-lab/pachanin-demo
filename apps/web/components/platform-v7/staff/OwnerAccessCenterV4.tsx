'use client';

import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { OwnerAccessCenter as OwnerAccessCenterV3, isOwnerAccessOpening, reserveOwnerAccessOpening, releaseOwnerAccessOpening } from './OwnerAccessCenterV3';
import { OWNER_REGISTRATION_PERMISSIONS, loadOwnerPendingCreate, prepareOwnerCreate, resolveOwnerCreate, recoverOwnerCreate, markOwnerActivation, completeOwnerCreate } from './OwnerAccessCenterV3';
import type { OwnerAccessOpeningCoordinator, OwnerPendingCreate } from './OwnerAccessCenterV3';
import styles from './OwnerAccessCenterV4.module.css';

type Props = ComponentProps<typeof OwnerAccessCenterV3>;
type Assignment = { id: string; role: string; status: string };
type SessionContext = {
  active?: boolean;
  session?: {
    accessSessionId?: string;
    accessMode?: string;
    permissions?: string[];
  } | null;
  code?: string;
  message?: string;
};
type ApiPayload = {
  grantId?: string | null;
  grant_id?: string | null;
  code?: string;
  message?: string;
  accessSessionId?: string;
};
type BootstrapState = 'checking' | 'ready' | 'opening' | 'active' | 'occupied' | 'forbidden' | 'error';

const MANAGE_STAFF_PERMISSIONS = OWNER_REGISTRATION_PERMISSIONS;

const COPY = {
  ru: {
    eyebrow: 'P0 · регистрация',
    title: 'Открыть защищённый доступ к очереди',
    description: 'Создаёт штатную CONTROL_PLANE-сессию владельца на 30 минут. Сервер повторно проверяет назначение, MFA, срок, права и аудит.',
    open: 'Открыть доступ на 30 минут',
    opening: 'Открываем защищённый доступ…',
    activeTitle: 'Защищённый доступ к очереди открыт',
    activeBody: 'Очередь регистрационных заявок теперь может быть загружена и обработана в этой вкладке.',
    reload: 'Обновить очередь',
    checking: 'Проверяем назначение владельца и защищённую сессию…',
    forbidden: 'Активное назначение владельца не подтверждено. Доступ не открыт.',
    occupied: 'Другая защищённая сессия уже открыта. Завершите её в управлении доступами перед открытием очереди.',
    retry: 'Проверить ещё раз',
    failed: 'Не удалось открыть защищённый доступ.',
    pending: 'Сохранён незавершённый запрос. Сначала восстановите его результат.',
    recover: 'Восстановить запрос доступа',
    storage: 'Не удалось сохранить запрос в этой вкладке. Разрешите хранение данных и повторите.',
  },
  en: {
    eyebrow: 'P0 · registration',
    title: 'Open protected access to the review queue',
    description: 'Creates the standard owner CONTROL_PLANE session for 30 minutes. The server revalidates assignment, MFA, duration, permissions and audit.',
    open: 'Open access for 30 minutes',
    opening: 'Opening protected access…',
    activeTitle: 'Protected queue access is active',
    activeBody: 'The registration review queue can now be loaded and processed in this tab.',
    reload: 'Reload queue',
    checking: 'Checking the owner assignment and protected session…',
    forbidden: 'An active owner assignment was not confirmed. Access was not opened.',
    occupied: 'Another protected session is active. End it in access management before opening the queue.',
    retry: 'Check again',
    failed: 'Protected access could not be opened.',
    pending: 'An unfinished request is saved. Recover its result first.',
    recover: 'Recover access request',
    storage: 'This tab could not save the request. Allow site storage and try again.',
  },
  zh: {
    eyebrow: 'P0 · 注册',
    title: '打开注册审核队列的受保护访问',
    description: '为平台所有者创建 30 分钟的标准 CONTROL_PLANE 会话。服务器会重新验证任命、MFA、期限、权限和审计。',
    open: '打开 30 分钟访问',
    opening: '正在打开受保护访问…',
    activeTitle: '审核队列的受保护访问已打开',
    activeBody: '现在可以在此标签页中加载并处理注册审核队列。',
    reload: '刷新审核队列',
    checking: '正在检查所有者任命和受保护会话…',
    forbidden: '未确认有效的平台所有者任命，未打开访问。',
    occupied: '另一个受保护会话仍在使用。请先在访问管理中结束该会话，再打开审核队列。',
    retry: '重新检查',
    failed: '无法打开受保护访问。',
    pending: '已保存未完成的请求。请先恢复其结果。',
    recover: '恢复访问请求',
    storage: '此标签页无法保存请求。请允许网站存储后重试。',
  },
} as const;

function currentCsrfToken(fallback: string) {
  if (typeof document === 'undefined') return fallback;
  const row = document.cookie.split('; ').find((entry) => entry.startsWith('pc_csrf_token='));
  return row ? decodeURIComponent(row.slice(row.indexOf('=') + 1)) : fallback;
}

async function readPayload(response: Response): Promise<ApiPayload> {
  return response.json().catch(() => ({})) as Promise<ApiPayload>;
}

function errorMessage(payload: ApiPayload, fallback: string) {
  const detail = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : fallback;
  return payload.code ? `${detail} (${payload.code})` : detail;
}

function hasRegistrationReviewSession(context: SessionContext) {
  const permissions = Array.isArray(context.session?.permissions) ? context.session.permissions : [];
  return context.active === true
    && context.session?.accessMode === 'CONTROL_PLANE'
    && permissions.includes('staff-request:read')
    && permissions.includes('staff-request:approve');
}

export function OwnerAccessCenter(props: Props) {
  const { locale, csrfToken, identity } = props;
  const copy = COPY[locale];
  const [state, setState] = useState<BootstrapState>('checking');
  const [assignmentId, setAssignmentId] = useState('');
  const verifiedAssignmentId = useRef('');
  const [error, setError] = useState('');
  const commandError = useRef<string | null>(null);
  const checkGeneration = useRef(0);
  const openingCoordinator = useRef<OwnerAccessOpeningCoordinator>({ opening: false });
  const [pendingCreate, setPendingCreate] = useState<OwnerPendingCreate | null>(null);
  const actorRef = useRef(identity?.id);
  actorRef.current = identity?.id;
  const operationGeneration = useRef(0);
  const createController = useRef<AbortController | null>(null);
  useEffect(() => () => { operationGeneration.current += 1; createController.current?.abort(); }, [identity?.id]);
  useEffect(() => { verifiedAssignmentId.current = ''; commandError.current = null; setAssignmentId(''); setPendingCreate(null); setError(''); setState('checking'); }, [identity?.id]);

  const check = useCallback(async (allowPending = false): Promise<boolean> => {
    if (isOwnerAccessOpening(openingCoordinator.current)) {
      setState('occupied');
      return false;
    }
    const generation = ++checkGeneration.current;
    const checkActorId = identity?.id;
    const isCurrent = () => generation === checkGeneration.current && actorRef.current === checkActorId;
    setState('checking');
    setError(commandError.current || '');
    try {
      const savedCreate = identity?.id ? loadOwnerPendingCreate(identity.id, openingCoordinator.current) : null;
      setPendingCreate(savedCreate);
      openingCoordinator.current.pendingCreate = savedCreate;
      const savedRecovery = savedCreate ? await recoverOwnerCreate(savedCreate, AbortSignal.timeout(8_000)) : null;
      if (!isCurrent()) return false;
      const assignmentsResponse = await fetch('/api/staff/assignments/me', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      const assignmentsPayload = await assignmentsResponse.json().catch(() => []) as Assignment[] | ApiPayload;
      if (!assignmentsResponse.ok || !Array.isArray(assignmentsPayload)) {
        throw new Error(errorMessage(assignmentsPayload as ApiPayload, copy.failed));
      }
      const owner = assignmentsPayload.find((item) => item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE');
      if (!isCurrent()) return false;
      if (!owner) {
        verifiedAssignmentId.current = '';
        setAssignmentId('');
        setState('forbidden');
        return false;
      }
      setAssignmentId(owner.id);
      verifiedAssignmentId.current = owner.id;

      const [contextResponse, sessionsResponse] = await Promise.all([
        fetch('/api/staff/session-context', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }),
        fetch('/api/staff/access/sessions', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }),
      ]);
      const context = await contextResponse.json().catch(() => null) as SessionContext | null;
      const sessions = await sessionsResponse.json().catch(() => null) as Array<{ id?: string; grant_id?: string }> | null;
      if (!contextResponse.ok || !sessionsResponse.ok || typeof context?.active !== 'boolean'
        || (context.active && !context.session) || (!context.active && context.session)
        || !Array.isArray(sessions) || sessions.length >= 200
        || sessions.some((row) => !row || typeof row.id !== 'string' || !row.id)) {
        throw new Error(copy.failed);
      }
      if (!isCurrent()) return false;
      if (isOwnerAccessOpening(openingCoordinator.current)) {
        setState('occupied');
        return false;
      }
      if (context.active || sessions.length > 0) {
        const sameSession = context.session && sessions.length === 1
          && sessions[0].id === context.session.accessSessionId;
        if (context.active && !sameSession) throw new Error(copy.failed);
        const registrationActive = sameSession && hasRegistrationReviewSession(context);
        if (registrationActive && savedCreate?.kind === 'registration' && savedRecovery
          && sessions[0].grant_id === savedRecovery.currentProjection.grantId) {
          completeOwnerCreate(savedCreate, openingCoordinator.current);
          setPendingCreate(null);
        }
        setState(registrationActive ? 'active' : 'occupied');
        return false;
      }
      if (savedCreate) {
        setError(copy.pending);
        setState('error');
        return allowPending && savedCreate.kind === 'registration' && savedCreate.phase !== 'activation-unknown';
      }
      if (commandError.current) { setState('error'); return false; }
      setState('ready');
      return !allowPending;
    } catch (checkError) {
      if (!isCurrent()) return false;
      setError(checkError instanceof Error ? checkError.message : copy.failed);
      setState('error');
      return false;
    }
  }, [copy.failed, copy.pending, identity?.id]);

  useEffect(() => {
    void check();
    return () => { checkGeneration.current += 1; };
  }, [check]);
  useEffect(() => {
    const recheck = () => { void check(); };
    window.addEventListener('pc:staff-session-changed', recheck);
    return () => window.removeEventListener('pc:staff-session-changed', recheck);
  }, [check]);
  useEffect(() => {
    const opening = () => {
      checkGeneration.current += 1;
      setState('occupied');
    };
    window.addEventListener('pc:staff-session-opening', opening);
    return () => window.removeEventListener('pc:staff-session-opening', opening);
  }, []);

  async function openAccess(resume = false) {
    if (!assignmentId || (!resume && (state !== 'ready' || pendingCreate))
      || (resume && pendingCreate?.kind !== 'registration')) return;
    if (!await check(resume)) return;
    if (!reserveOwnerAccessOpening(openingCoordinator.current)) return;
    const actorId = identity?.id;
    const generation = ++operationGeneration.current;
    const isCurrent = () => generation === operationGeneration.current && actorRef.current === actorId;
    setState('opening');
    commandError.current = null;
    setError('');
    const controller = new AbortController();
    createController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      let pending = prepareOwnerCreate(actorId, 'registration', {
        assignmentId: verifiedAssignmentId.current, accessMode: 'CONTROL_PLANE', permissions: [...MANAGE_STAFF_PERMISSIONS],
        reason: 'Одобрение production acceptance заявок PC-CROP для подтверждения 9/9 ролей.',
        ticketId: 'PC-CROP-3785', durationSeconds: 30 * 60,
      }, openingCoordinator.current, resume);
      setPendingCreate(pending);
      const refreshCsrf = async () => {
        const response = await fetch('/platform-v7/staff/prepare?format=json', {
          credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; csrfToken?: string } | null;
        if (!response.ok || payload?.ok !== true || typeof payload.csrfToken !== 'string' || payload.csrfToken.length < 32) throw new Error(copy.failed);
        return payload.csrfToken;
      };
      const resolved = await resolveOwnerCreate(pending, openingCoordinator.current, {
        signal: controller.signal, csrfToken: currentCsrfToken(csrfToken), refreshCsrf, isCurrent,
      });
      if (!isCurrent()) return;
      pending = resolved.record;
      setPendingCreate(pending);
      const grantId = resolved.recovered.currentProjection.grantId;
      if (pending.phase === 'activation-unknown' || !grantId
        || !resolved.recovered.currentProjection.activationEligible
        || resolved.recovered.currentProjection.grantStatus !== 'ACTIVE'
        || Date.parse(resolved.recovered.currentProjection.expiresAt) <= Date.now()) throw new Error(copy.pending);
      pending = markOwnerActivation(pending, openingCoordinator.current);
      setPendingCreate(pending);
      const activationResponse = await fetch(`/api/staff/access/grants/${encodeURIComponent(grantId)}/activate`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': resolved.token },
        body: '{}', signal: controller.signal,
      });
      const activationPayload = await readPayload(activationResponse);
      if (!activationResponse.ok) throw new Error(errorMessage(activationPayload, copy.failed));
      const [contextResponse, sessionsResponse] = await Promise.all([
        fetch('/api/staff/session-context', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }),
        fetch('/api/staff/access/sessions', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }),
      ]);
      const context = await contextResponse.json().catch(() => null) as SessionContext | null;
      const sessions = await sessionsResponse.json().catch(() => null) as Array<{ id?: string; grant_id?: string }> | null;
      if (!isCurrent()) return;
      if (!contextResponse.ok || !sessionsResponse.ok || !context || !hasRegistrationReviewSession(context)
        || !activationPayload.accessSessionId || context.session?.accessSessionId !== activationPayload.accessSessionId
        || !Array.isArray(sessions) || sessions.length !== 1 || sessions[0].id !== activationPayload.accessSessionId
        || sessions[0].grant_id !== grantId) throw new Error(copy.pending);
      completeOwnerCreate(pending, openingCoordinator.current);
      setPendingCreate(null);
      setState('active');
      window.dispatchEvent(new Event('pc:staff-session-changed'));
      window.location.reload();
    } catch (openError) {
      if (!isCurrent()) return;
      const storageError = openError instanceof Error && /OWNER_CREATE_(?:STORAGE|CRYPTO|IDENTITY)_/.test(openError.message);
      commandError.current = storageError ? copy.storage : openError instanceof Error && openError.message.startsWith('OWNER_CREATE_')
        ? copy.pending : openError instanceof Error ? openError.message : copy.failed;
      setError(commandError.current);
      setState('error');
    } finally {
      window.clearTimeout(timeout);
      if (createController.current === controller) createController.current = null;
      releaseOwnerAccessOpening(openingCoordinator.current);
    }
  }

  return (
    <>
      <section className={styles.bootstrap} data-p0-registration-access-bootstrap aria-live="polite">
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2>{state === 'active' ? copy.activeTitle : copy.title}</h2>
          <p>{state === 'active' ? copy.activeBody : copy.description}</p>
        </div>

        {state === 'checking' ? <p className={styles.status}>{copy.checking}</p> : null}
        {state === 'forbidden' ? <p className={styles.error}>{copy.forbidden}</p> : null}
        {state === 'occupied' ? <p className={styles.status}>{copy.occupied}</p> : null}
        {state === 'error' && error ? <p className={styles.error}>{error}</p> : null}

        {state === 'ready' || state === 'opening' ? (
          <button type="button" onClick={() => void openAccess()} disabled={state === 'opening'}>
            {state === 'opening' ? copy.opening : copy.open}
          </button>
        ) : null}
        {state === 'active' ? (
          <button type="button" onClick={() => window.location.reload()}>{copy.reload}</button>
        ) : null}
        {state === 'forbidden' || state === 'error' || state === 'occupied' ? (
          <button type="button" className={styles.secondary} onClick={() => { commandError.current = null; void check(); }}>{copy.retry}</button>
        ) : null}
      {pendingCreate?.kind === 'registration' && pendingCreate.actorId === identity?.id && state !== 'active' && (
        <button type="button" className={styles.secondary} onClick={() => pendingCreate.phase === 'activation-unknown' ? void check() : void openAccess(true)}
          disabled={state === 'opening' || state === 'checking'} data-owner-registration-create-recovery>
          {pendingCreate.phase === 'activation-unknown' ? copy.retry : copy.recover}
        </button>
      )}
      </section>
      <OwnerAccessCenterV3 {...props} openingCoordinator={openingCoordinator.current} />
    </>
  );
}
