'use client';

import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { OwnerAccessCenter as OwnerAccessCenterV3 } from './OwnerAccessCenterV3';
import styles from './OwnerAccessCenterV4.module.css';

type Props = ComponentProps<typeof OwnerAccessCenterV3>;
type Assignment = { id: string; role: string; status: string };
type SessionContext = {
  active?: boolean;
  session?: {
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
};
type BootstrapState = 'checking' | 'ready' | 'opening' | 'active' | 'forbidden' | 'error';

const MANAGE_STAFF_PERMISSIONS = [
  'staff-assignment:read',
  'staff-assignment:write',
  'staff-request:read',
  'staff-request:approve',
  'staff-session:read',
  'staff-session:revoke',
  'audit:read',
] as const;

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
    retry: 'Проверить ещё раз',
    failed: 'Не удалось открыть защищённый доступ.',
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
    retry: 'Check again',
    failed: 'Protected access could not be opened.',
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
    retry: '重新检查',
    failed: '无法打开受保护访问。',
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
  const { locale, csrfToken } = props;
  const copy = COPY[locale];
  const [state, setState] = useState<BootstrapState>('checking');
  const [assignmentId, setAssignmentId] = useState('');
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    setState('checking');
    setError('');
    try {
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
      if (!owner) {
        setAssignmentId('');
        setState('forbidden');
        return;
      }
      setAssignmentId(owner.id);

      try {
        const contextResponse = await fetch('/api/staff/session-context', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        });
        const context = await contextResponse.json().catch(() => ({})) as SessionContext;
        if (contextResponse.ok && hasRegistrationReviewSession(context)) {
          setState('active');
          return;
        }
      } catch {
        // The owner assignment remains authoritative. The activation POST below
        // is still server-validated and will reject any conflicting session.
      }

      setState('ready');
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : copy.failed);
      setState('error');
    }
  }, [copy.failed]);

  useEffect(() => {
    void check();
  }, [check]);

  async function openAccess() {
    if (!assignmentId || state === 'opening') return;
    setState('opening');
    setError('');
    const token = currentCsrfToken(csrfToken);

    try {
      const requestResponse = await fetch('/api/staff/access/requests', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({
          assignmentId,
          accessMode: 'CONTROL_PLANE',
          permissions: [...MANAGE_STAFF_PERMISSIONS],
          reason: 'Одобрение production acceptance заявок PC-CROP для подтверждения 9/9 ролей.',
          ticketId: 'PC-CROP-3785',
          durationSeconds: 30 * 60,
        }),
      });
      const requestPayload = await readPayload(requestResponse);
      if (!requestResponse.ok) {
        throw new Error(errorMessage(requestPayload, copy.failed));
      }
      const grantId = requestPayload.grantId || requestPayload.grant_id;
      if (!grantId) {
        throw new Error(errorMessage(requestPayload, 'CONTROL_PLANE_GRANT_NOT_RETURNED'));
      }

      const activationResponse = await fetch(`/api/staff/access/grants/${encodeURIComponent(grantId)}/activate`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: '{}',
      });
      const activationPayload = await readPayload(activationResponse);
      if (!activationResponse.ok) {
        throw new Error(errorMessage(activationPayload, copy.failed));
      }

      setState('active');
      window.dispatchEvent(new Event('pc:staff-session-changed'));
      window.location.reload();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : copy.failed);
      setState('error');
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
        {state === 'error' && error ? <p className={styles.error}>{error}</p> : null}

        {state === 'ready' || state === 'opening' ? (
          <button type="button" onClick={() => void openAccess()} disabled={state === 'opening'}>
            {state === 'opening' ? copy.opening : copy.open}
          </button>
        ) : null}
        {state === 'active' ? (
          <button type="button" onClick={() => window.location.reload()}>{copy.reload}</button>
        ) : null}
        {state === 'forbidden' || state === 'error' ? (
          <button type="button" className={styles.secondary} onClick={() => void check()}>{copy.retry}</button>
        ) : null}
      </section>
      <OwnerAccessCenterV3 {...props} />
    </>
  );
}
