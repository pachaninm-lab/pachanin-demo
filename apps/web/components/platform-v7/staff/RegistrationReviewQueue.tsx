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
    decisions: {
      APPROVE: '批准并激活',
      REQUEST_INFORMATION: '请求补充信息',
      SUSPEND: '暂停',
      REJECT: '拒绝',
    },
  },
} as const;

function newIdempotencyKey(applicationId: string) {
  return `registration-review:${applicationId}:${crypto.randomUUID()}`;
}

export function RegistrationReviewQueue({ locale, csrfToken }: { locale: AppLocale; csrfToken: string }) {
  const copy = COPY[locale];
  const [applications, setApplications] = useState<ReviewApplication[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'unavailable'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setState('forbidden');
        return;
      }
      if (!response.ok || !Array.isArray(payload.applications)) {
        throw new Error(payload.message || copy.unavailable);
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
      const response = await fetch(`/api/staff/registration/applications/${encodeURIComponent(application.applicationId)}/decision`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Idempotency-Key': newIdempotencyKey(application.applicationId),
        },
        body: JSON.stringify({ decision, reason, locale }),
      });
      const payload = await response.json().catch(() => ({})) as QueueResponse;
      if (!response.ok) throw new Error(payload.message || payload.code || copy.unavailable);
      setApplications((current) => current.filter((item) => item.applicationId !== application.applicationId));
      setNotice(copy.success);
      formElement.reset();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : copy.unavailable);
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
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
