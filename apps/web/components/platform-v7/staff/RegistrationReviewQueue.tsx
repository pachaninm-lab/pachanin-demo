'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { AppLocale } from '@/i18n/locale';
import styles from './RegistrationReviewQueue.module.css';

type ReviewDecision = 'APPROVE' | 'REJECT' | 'REQUEST_INFORMATION' | 'SUSPEND';

type ReviewApplication = {
  applicationId: string;
  status: string;
  requestedWorkspace: string;
  requestedRole: string;
  organization: {
    name: string;
    legalName: string;
    status: string;
    inn: string;
    kpp: string | null;
    ogrn: string | null;
    region: string;
  };
  applicant: {
    fullName: string;
    position: string;
    email: string;
    phone: string;
  };
  submittedAt: string;
  version: string;
  correlationId: string;
  checks?: { emailVerified: boolean; kycStatus: string; amlStatus: string; sanctionHit: boolean };
  duplicateSignals?: { organizationsWithSameInn: number; applicationsWithSameEmail: number };
  riskFlags?: string[];
  history?: Array<{
    actorKind: string;
    previousStatus: string | null;
    newStatus: string;
    reason: string;
    correlationId: string;
    applicationVersion: string;
    metadata?: { response?: unknown } | null;
    createdAt: string;
  }>;
};

type QueueResponse = {
  applications?: ReviewApplication[];
  code?: string;
  message?: string;
  correlationId?: string;
};

type DecisionResponse = QueueResponse & {
  replayed?: boolean;
  notificationDelivered?: boolean;
};

type CancelResponse = {
  applicationId?: string;
  status?: string;
  replayed?: boolean;
  code?: string;
  message?: string;
};

type StaffSessionContextResponse = {
  active?: boolean;
  session?: { staffRole?: string } | null;
};

const P0_ACCEPTANCE_LEGAL_NAME_PREFIX = 'Production P0 exact-run organization ';
const OWNER_CANCEL_REASON = 'Удалено владельцем из очереди';

const COPY = {
  ru: {
    eyebrow: 'P0 · Допуск организаций',
    title: 'Очередь регистрационных заявок',
    description: 'Решение применяется сервером, требует свежую MFA и активное назначение reviewer. Самоодобрение запрещено.',
    loading: 'Загружаем реальную очередь…',
    empty: 'Новых заявок на проверку нет.',
    unavailable: 'Очередь временно недоступна. Доступ не выдан и данные не подменены.',
    retry: 'Повторить',
    workspace: 'Рабочее пространство',
    applicant: 'Заявитель',
    requisites: 'Реквизиты',
    submitted: 'Подана',
    status: 'Статус',
    correlation: 'Correlation ID',
    checks: 'Доступные проверки',
    risks: 'Риски и дубликаты',
    noRisks: 'Сигналы риска не обнаружены',
    history: 'История заявки',
    applicantResponse: 'Уточнение заявителя',
    reason: 'Основание решения',
    reasonHint: 'Не менее 8 символов; основание сохраняется в неизменяемом аудите.',
    decide: 'Зафиксировать решение',
    deciding: 'Фиксируем…',
    success: 'Решение записано. Заявка обновлена.',
    deleteApplication: 'Удалить заявку',
    deletingApplication: 'Удаляем…',
    deleteConfirm: (organization: string) => `Удалить заявку «${organization}»?`,
    deleteWarning: 'Заявка исчезнет из рабочей очереди. Действие будет записано в журнале аудита.',
    cancel: 'Отмена',
    deleteSuccess: 'Заявка удалена из очереди.',
    freshMfa: 'Подтвердите действие через MFA.',
    activatedDeleteDenied: 'Активированную заявку удалить нельзя.',
    versionConflict: 'Заявка изменилась. Очередь обновлена.',
    deleteForbidden: 'Операция недоступна.',
    decisions: {
      APPROVE: 'Одобрить и активировать',
      REQUEST_INFORMATION: 'Запросить уточнение',
      SUSPEND: 'Приостановить',
      REJECT: 'Отклонить',
    },
  },
  en: {
    eyebrow: 'P0 · Organization admission',
    title: 'Registration review queue',
    description: 'The server applies every decision and requires fresh MFA plus an active reviewer assignment. Self-approval is blocked.',
    loading: 'Loading the live queue…',
    empty: 'There are no new applications to review.',
    unavailable: 'The queue is unavailable. No access was granted and no local data was substituted.',
    retry: 'Retry',
    workspace: 'Workspace',
    applicant: 'Applicant',
    requisites: 'Legal details',
    submitted: 'Submitted',
    status: 'Status',
    correlation: 'Correlation ID',
    checks: 'Available checks',
    risks: 'Risks and duplicates',
    noRisks: 'No risk signals detected',
    history: 'Application history',
    applicantResponse: 'Applicant response',
    reason: 'Decision basis',
    reasonHint: 'At least 8 characters; the basis is retained in immutable audit.',
    decide: 'Record decision',
    deciding: 'Recording…',
    success: 'The decision was recorded and the queue was refreshed.',
    deleteApplication: 'Delete application',
    deletingApplication: 'Deleting…',
    deleteConfirm: (organization: string) => `Delete application “${organization}”?`,
    deleteWarning: 'The application will disappear from the working queue. The action will remain in the audit log.',
    cancel: 'Cancel',
    deleteSuccess: 'Application removed from the queue.',
    freshMfa: 'Confirm this action with MFA.',
    activatedDeleteDenied: 'An activated application cannot be deleted.',
    versionConflict: 'The application changed. The queue was refreshed.',
    deleteForbidden: 'This operation is unavailable.',
    decisions: {
      APPROVE: 'Approve and activate',
      REQUEST_INFORMATION: 'Request information',
      SUSPEND: 'Suspend',
      REJECT: 'Reject',
    },
  },
  zh: {
    eyebrow: 'P0 · 组织准入',
    title: '注册审核队列',
    description: '每项决定均由服务器执行，并要求最新 MFA 与有效审核员任命；禁止自我审批。',
    loading: '正在加载真实队列…',
    empty: '当前没有待审核的新申请。',
    unavailable: '审核队列暂时不可用。系统未授予访问权限，也未使用本地数据替代。',
    retry: '重试',
    workspace: '工作空间',
    applicant: '申请人',
    requisites: '法定信息',
    submitted: '提交时间',
    status: '状态',
    correlation: 'Correlation ID',
    checks: '可用检查',
    risks: '风险与重复项',
    noRisks: '未发现风险信号',
    history: '申请历史',
    applicantResponse: '申请人补充说明',
    reason: '决定依据',
    reasonHint: '至少 8 个字符；依据会保存在不可变审计记录中。',
    decide: '记录决定',
    deciding: '正在记录…',
    success: '决定已记录，队列已更新。',
    deleteApplication: '删除申请',
    deletingApplication: '正在删除…',
    deleteConfirm: (organization: string) => `删除申请“${organization}”？`,
    deleteWarning: '该申请将从工作队列中消失，此操作会记录在审计日志中。',
    cancel: '取消',
    deleteSuccess: '申请已从队列中删除。',
    freshMfa: '请通过 MFA 确认此操作。',
    activatedDeleteDenied: '已激活的申请不能删除。',
    versionConflict: '申请已发生变化，队列已刷新。',
    deleteForbidden: '此操作不可用。',
    decisions: {
      APPROVE: '批准并激活',
      REQUEST_INFORMATION: '请求补充信息',
      SUSPEND: '暂停',
      REJECT: '拒绝',
    },
  },
} as const;

async function decisionMarker(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

async function p0CeremonyHeaders(applicationId: string, phase: 'approve' | 'replay') {
  const marker = await decisionMarker(applicationId);
  return {
    idempotencyKey: `p0-human-review:${marker}`,
    correlationId: `p0-human-${phase}:${marker}`,
  };
}

async function ordinaryDecisionHeaders(
  applicationId: string,
  version: string,
  decision: ReviewDecision,
) {
  const marker = await decisionMarker(`${applicationId}\u001f${version}\u001f${decision}`);
  return {
    idempotencyKey: `registration-review:${marker}:${decision.toLowerCase()}`,
    correlationId: `registration-review:${marker}:${crypto.randomUUID()}`,
  };
}

async function cancellationHeaders(applicationId: string, version: string) {
  const marker = await decisionMarker(`${applicationId}\u001f${version}\u001fOWNER_CANCEL`);
  return {
    idempotencyKey: `registration-cancel:${marker}`,
    correlationId: `registration-cancel:${marker}:${crypto.randomUUID()}`,
  };
}

export function RegistrationReviewQueue({ locale, csrfToken }: { locale: AppLocale; csrfToken: string }) {
  const copy = COPY[locale];
  const [applications, setApplications] = useState<ReviewApplication[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'unavailable'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownerCanCancel, setOwnerCanCancel] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<ReviewApplication | null>(null);

  async function load(signal?: AbortSignal) {
    setState('loading');
    setError(null);
    try {
      const response = await fetch('/api/staff/registration/applications', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal,
      });
      const payload = await response.json().catch(() => ({})) as QueueResponse;
      if (response.status === 403) {
        setOwnerCanCancel(false);
        setState('forbidden');
        return;
      }
      if (!response.ok || !Array.isArray(payload.applications)) {
        throw new Error(payload.message || copy.unavailable);
      }
      setApplications(payload.applications);
      setState('ready');

      try {
        const sessionResponse = await fetch('/api/staff/session-context', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal,
        });
        const sessionPayload = await sessionResponse.json().catch(() => ({})) as StaffSessionContextResponse;
        setOwnerCanCancel(
          sessionResponse.ok
          && sessionPayload.active === true
          && sessionPayload.session?.staffRole === 'PLATFORM_OWNER',
        );
      } catch (sessionError) {
        if (sessionError instanceof DOMException && sessionError.name === 'AbortError') return;
        setOwnerCanCancel(false);
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setOwnerCanCancel(false);
      setError(loadError instanceof Error ? loadError.message : copy.unavailable);
      setState('unavailable');
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  async function decide(event: FormEvent<HTMLFormElement>, application: ReviewApplication) {
    event.preventDefault();
    if (busyId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const decision = String(form.get('decision') || '') as ReviewDecision;
    const reason = String(form.get('reason') || '').trim();
    if (!Object.hasOwn(copy.decisions, decision) || reason.length < 8) {
      setError(copy.reasonHint);
      return;
    }

    setBusyId(application.applicationId);
    setError(null);
    setNotice(null);
    try {
      const p0Ceremony = decision === 'APPROVE'
        && application.organization.legalName.startsWith(P0_ACCEPTANCE_LEGAL_NAME_PREFIX);
      const firstHeaders = p0Ceremony
        ? await p0CeremonyHeaders(application.applicationId, 'approve')
        : await ordinaryDecisionHeaders(application.applicationId, application.version, decision);
      const endpoint = `/api/staff/registration/applications/${encodeURIComponent(application.applicationId)}/decision`;
      const requestBody = JSON.stringify({ decision, reason, locale });
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Idempotency-Key': firstHeaders.idempotencyKey,
          ...(firstHeaders.correlationId ? { 'X-Correlation-Id': firstHeaders.correlationId } : {}),
        },
        body: requestBody,
      });
      const payload = await response.json().catch(() => ({})) as DecisionResponse;
      if (!response.ok) throw new Error(payload.message || payload.code || copy.unavailable);
      if (p0Ceremony) {
        if (payload.replayed === false && payload.notificationDelivered !== true) {
          throw new Error('P0_HUMAN_APPROVAL_NOTIFICATION_NOT_DELIVERED');
        }
        if (payload.replayed !== false && payload.replayed !== true) {
          throw new Error('P0_HUMAN_APPROVAL_RESPONSE_INVALID');
        }
        const replayHeaders = await p0CeremonyHeaders(application.applicationId, 'replay');
        const replayResponse = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            'Idempotency-Key': replayHeaders.idempotencyKey,
            'X-Correlation-Id': replayHeaders.correlationId,
          },
          body: requestBody,
        });
        const replayPayload = await replayResponse.json().catch(() => ({})) as DecisionResponse;
        if (!replayResponse.ok
          || replayPayload.replayed !== true
          || Object.hasOwn(replayPayload, 'notificationDelivered')) {
          throw new Error(replayPayload.message || replayPayload.code || 'P0_HUMAN_APPROVAL_REPLAY_INVALID');
        }
      }
      setApplications((current) => current.filter((item) => item.applicationId !== application.applicationId));
      setNotice(copy.success);
      formElement.reset();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : copy.unavailable);
    } finally {
      setBusyId(null);
    }
  }

  async function cancelApplication(application: ReviewApplication) {
    if (busyId || !ownerCanCancel) return;
    setBusyId(application.applicationId);
    setError(null);
    setNotice(null);
    try {
      const headers = await cancellationHeaders(application.applicationId, application.version);
      const response = await fetch(
        `/api/staff/registration/applications/${encodeURIComponent(application.applicationId)}/cancel`,
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            'Idempotency-Key': headers.idempotencyKey,
            'X-Correlation-Id': headers.correlationId,
          },
          body: JSON.stringify({ reason: OWNER_CANCEL_REASON }),
        },
      );
      const payload = await response.json().catch(() => ({})) as CancelResponse;
      if (!response.ok) {
        if (payload.code === 'FRESH_MFA_REQUIRED') {
          setError(copy.freshMfa);
          return;
        }
        if (payload.code === 'APPLICATION_ALREADY_ACTIVATED') {
          setPendingCancel(null);
          setError(copy.activatedDeleteDenied);
          return;
        }
        if (payload.code === 'REGISTRATION_VERSION_CONFLICT') {
          setPendingCancel(null);
          await load();
          setError(copy.versionConflict);
          return;
        }
        if (response.status === 403) {
          setPendingCancel(null);
          setOwnerCanCancel(false);
          setError(copy.deleteForbidden);
          return;
        }
        throw new Error(payload.message || payload.code || copy.unavailable);
      }
      if (
        payload.applicationId !== application.applicationId
        || payload.status !== 'CANCELLED'
        || typeof payload.replayed !== 'boolean'
      ) {
        throw new Error(copy.unavailable);
      }
      setApplications((current) => current.filter((item) => item.applicationId !== application.applicationId));
      setPendingCancel(null);
      setNotice(copy.deleteSuccess);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : copy.unavailable);
    } finally {
      setBusyId(null);
    }
  }

  if (state === 'forbidden') return null;

  return (
    <section className={styles.surface} aria-labelledby="registration-review-title">
      <header className={styles.header}>
        <p>{copy.eyebrow}</p>
        <h2 id="registration-review-title">{copy.title}</h2>
        <span>{copy.description}</span>
      </header>

      {state === 'loading' ? <p className={styles.state} aria-live="polite">{copy.loading}</p> : null}
      {state === 'unavailable' ? (
        <div className={styles.state} role="alert">
          <p>{error || copy.unavailable}</p>
          <button type="button" onClick={() => void load()}>{copy.retry}</button>
        </div>
      ) : null}
      {notice ? <p className={styles.success} role="status">{notice}</p> : null}
      {state === 'ready' && error ? <p className={styles.error} role="alert">{error}</p> : null}
      {state === 'ready' && applications.length === 0 ? <p className={styles.state}>{copy.empty}</p> : null}

      {state === 'ready' && applications.length > 0 ? (
        <div className={styles.list}>
          {applications.map((application) => (
            <article className={styles.card} key={application.applicationId}>
              <div className={styles.summary}>
                <div>
                  <h3>{application.organization.legalName || application.organization.name}</h3>
                  <p>{copy.status}: <strong>{application.status}</strong></p>
                </div>
                <span>{copy.submitted}: {new Date(application.submittedAt).toLocaleString(locale)}</span>
              </div>
              <dl className={styles.details}>
                <div><dt>{copy.requisites}</dt><dd>ИНН {application.organization.inn}{application.organization.kpp ? ` · КПП ${application.organization.kpp}` : ''}{application.organization.ogrn ? ` · ОГРН ${application.organization.ogrn}` : ''} · {application.organization.region}</dd></div>
                <div><dt>{copy.applicant}</dt><dd>{application.applicant.fullName} · {application.applicant.position}<br />{application.applicant.email} · {application.applicant.phone}</dd></div>
                <div><dt>{copy.workspace}</dt><dd>{application.requestedWorkspace} → {application.requestedRole}</dd></div>
                <div><dt>{copy.correlation}</dt><dd><code>{application.correlationId}</code></dd></div>
                <div>
                  <dt>{copy.checks}</dt>
                  <dd>
                    Email: {application.checks?.emailVerified ? 'VERIFIED' : 'NOT_VERIFIED'} · KYC: {application.checks?.kycStatus || 'UNKNOWN'} · AML: {application.checks?.amlStatus || 'UNKNOWN'}
                  </dd>
                </div>
                <div>
                  <dt>{copy.risks}</dt>
                  <dd>
                    {application.riskFlags?.length ? application.riskFlags.join(' · ') : copy.noRisks}
                    {application.duplicateSignals ? ` · INN ${application.duplicateSignals.organizationsWithSameInn} · EMAIL ${application.duplicateSignals.applicationsWithSameEmail}` : ''}
                  </dd>
                </div>
              </dl>
              {application.history?.length ? (
                <details className={styles.history}>
                  <summary>{copy.history} · {application.history.length}</summary>
                  <ol>
                    {application.history.map((event) => (
                      <li key={`${event.applicationVersion}:${event.newStatus}:${event.createdAt}`}>
                        <strong>{event.previousStatus || '∅'} → {event.newStatus}</strong>
                        <span>{event.actorKind} · {new Date(event.createdAt).toLocaleString(locale)} · {event.reason}</span>
                        {typeof event.metadata?.response === 'string' ? <p><b>{copy.applicantResponse}:</b> {event.metadata.response}</p> : null}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
              <form className={styles.form} onSubmit={(event) => void decide(event, application)}>
                <label>
                  <span>{copy.status}</span>
                  <select name="decision" defaultValue="REQUEST_INFORMATION" disabled={busyId !== null}>
                    {(Object.keys(copy.decisions) as ReviewDecision[]).map((decision) => (
                      <option key={decision} value={decision}>{copy.decisions[decision]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{copy.reason}</span>
                  <textarea name="reason" minLength={8} maxLength={1000} required aria-describedby={`reason-help-${application.applicationId}`} disabled={busyId !== null} />
                  <small id={`reason-help-${application.applicationId}`}>{copy.reasonHint}</small>
                </label>
                <button type="submit" disabled={!csrfToken || busyId !== null}>
                  {busyId === application.applicationId ? copy.deciding : copy.decide}
                </button>
              </form>
              {ownerCanCancel ? (
                <div className={styles.destructiveZone}>
                  <button
                    type="button"
                    className={styles.destructiveButton}
                    disabled={!csrfToken || busyId !== null}
                    onClick={() => setPendingCancel(application)}
                  >
                    {copy.deleteApplication}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {pendingCancel ? (
        <div className={styles.confirmOverlay}>
          <div
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`cancel-registration-title-${pendingCancel.applicationId}`}
          >
            <h3 id={`cancel-registration-title-${pendingCancel.applicationId}`}>
              {copy.deleteConfirm(pendingCancel.organization.legalName || pendingCancel.organization.name)}
            </h3>
            <p>{copy.deleteWarning}</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={busyId !== null}
                onClick={() => setPendingCancel(null)}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                disabled={!csrfToken || busyId !== null}
                onClick={() => void cancelApplication(pendingCancel)}
              >
                {busyId === pendingCancel.applicationId ? copy.deletingApplication : copy.deleteApplication}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
