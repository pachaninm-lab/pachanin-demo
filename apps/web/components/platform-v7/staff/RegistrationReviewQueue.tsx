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

type CancellationResponse = {
  applicationId?: string;
  status?: string;
  replayed?: boolean;
  code?: string;
  message?: string;
};

type SessionContextResponse = {
  active?: boolean;
  session?: { staffRole?: string } | null;
};

const P0_ACCEPTANCE_LEGAL_NAME_PREFIX = 'Production P0 exact-run organization ';
const OWNER_CANCELLATION_REASON = 'Удалено владельцем из очереди';

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
    cancel: 'Удалить заявку',
    canceling: 'Удаляем…',
    cancelConfirmText: 'Заявка исчезнет из рабочей очереди. Действие будет записано в журнале аудита.',
    cancelSuccess: 'Заявка удалена из очереди.',
    cancelMfa: 'Подтвердите действие через MFA.',
    cancelActivated: 'Активированную заявку удалить нельзя.',
    cancelConflict: 'Очередь обновлена: заявка была изменена другим действием.',
    cancelForbidden: 'Операция недоступна.',
    cancelDismiss: 'Отмена',
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
    cancel: 'Remove application',
    canceling: 'Removing…',
    cancelConfirmText: 'The application will disappear from the work queue. The action will be recorded in the audit log.',
    cancelSuccess: 'Application removed from the queue.',
    cancelMfa: 'Confirm the action with MFA.',
    cancelActivated: 'An activated application cannot be removed.',
    cancelConflict: 'The queue was refreshed because the application changed.',
    cancelForbidden: 'The operation is unavailable.',
    cancelDismiss: 'Cancel',
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
    cancel: '删除申请',
    canceling: '正在删除…',
    cancelConfirmText: '该申请将从工作队列中消失，操作会写入审计日志。',
    cancelSuccess: '申请已从队列中删除。',
    cancelMfa: '请通过 MFA 确认此操作。',
    cancelActivated: '已激活的申请不能删除。',
    cancelConflict: '申请已发生变化，队列已刷新。',
    cancelForbidden: '此操作不可用。',
    cancelDismiss: '取消',
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
  const marker = await decisionMarker(`${applicationId}${version}${decision}`);
  return {
    idempotencyKey: `registration-review:${marker}:${decision.toLowerCase()}`,
    correlationId: `registration-review:${marker}:${crypto.randomUUID()}`,
  };
}

async function cancellationHeaders(application: ReviewApplication) {
  const marker = await decisionMarker(`${application.applicationId}${application.version}OWNER_CANCEL`);
  return {
    idempotencyKey: `owner-registration-cancel:${marker}`,
    correlationId: `owner-registration-cancel:${marker}:${crypto.randomUUID()}`,
  };
}

export function RegistrationReviewQueue({ locale, csrfToken }: { locale: AppLocale; csrfToken: string }) {
  const copy = COPY[locale];
  const [applications, setApplications] = useState<ReviewApplication[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'unavailable'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ReviewApplication | null>(null);

  async function load(signal?: AbortSignal) {
    setState('loading');
    setError(null);
    try {
      const [response, sessionResponse] = await Promise.all([
        fetch('/api/staff/registration/applications', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal,
        }),
        fetch('/api/staff/session-context', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal,
        }).catch(() => null),
      ]);
      const payload = await response.json().catch(() => ({})) as QueueResponse;
      if (response.status === 403) {
        setState('forbidden');
        return;
      }
      if (!response.ok || !Array.isArray(payload.applications)) {
        throw new Error(payload.message || copy.unavailable);
      }
      if (sessionResponse?.ok) {
        const sessionPayload = await sessionResponse.json().catch(() => ({})) as SessionContextResponse;
        setCanCancel(sessionPayload.active === true && sessionPayload.session?.staffRole === 'PLATFORM_OWNER');
      } else {
        setCanCancel(false);
      }
      setApplications(payload.applications);
      setState('ready');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
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
    if (busyId || !canCancel) return;
    setBusyId(application.applicationId);
    setError(null);
    setNotice(null);
    try {
      const headers = await cancellationHeaders(application);
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
          body: JSON.stringify({ reason: OWNER_CANCELLATION_REASON }),
        },
      );
      const payload = await response.json().catch(() => ({})) as CancellationResponse;
      if (!response.ok) {
        if (payload.code === 'FRESH_MFA_REQUIRED') throw new Error(copy.cancelMfa);
        if (payload.code === 'APPLICATION_ALREADY_ACTIVATED') throw new Error(copy.cancelActivated);
        if (payload.code === 'REGISTRATION_VERSION_CONFLICT') {
          await load();
          throw new Error(copy.cancelConflict);
        }
        if (response.status === 403 || payload.code === 'FORBIDDEN') throw new Error(copy.cancelForbidden);
        throw new Error(payload.message || copy.unavailable);
      }
      if (payload.applicationId !== application.applicationId || payload.status !== 'CANCELLED') {
        throw new Error(copy.unavailable);
      }
      setApplications((current) => current.filter((item) => item.applicationId !== application.applicationId));
      setCancelTarget(null);
      setNotice(copy.cancelSuccess);
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
              {canCancel ? (
                <div className={styles.ownerActions}>
                  <button
                    className={styles.destructive}
                    type="button"
                    disabled={!csrfToken || busyId !== null}
                    onClick={() => setCancelTarget(application)}
                  >
                    {busyId === application.applicationId ? copy.canceling : copy.cancel}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {cancelTarget ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="registration-cancel-title">
            <h3 id="registration-cancel-title">
              {locale === 'ru'
                ? `Удалить заявку «${cancelTarget.organization.legalName || cancelTarget.organization.name}»?`
                : `${copy.cancel}: ${cancelTarget.organization.legalName || cancelTarget.organization.name}?`}
            </h3>
            <p>{copy.cancelConfirmText}</p>
            <div className={styles.dialogActions}>
              <button type="button" disabled={busyId !== null} onClick={() => setCancelTarget(null)}>
                {copy.cancelDismiss}
              </button>
              <button
                type="button"
                className={styles.destructive}
                disabled={!csrfToken || busyId !== null}
                onClick={() => void cancelApplication(cancelTarget)}
              >
                {busyId === cancelTarget.applicationId ? copy.canceling : copy.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
