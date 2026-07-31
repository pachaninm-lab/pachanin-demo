'use client';

import * as React from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';

type RegistrationStatus = {
  applicationId?: string;
  kind?: string;
  status?: string;
  requestedWorkspace?: string;
  nextAction?: string;
  submittedAt?: string;
  updatedAt?: string;
  reason?: string | null;
  version?: string;
  correlationId?: string;
  statusToken?: string;
};

type Copy = {
  workspace: string;
  orgType: string;
  legalName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  region: string;
  fullName: string;
  position: string;
  phone: string;
  email: string;
  password: string;
  passwordHint: string;
  terms: string;
  privacy: string;
  acceptTerms: string;
  acceptPrivacy: string;
  submit: string;
  submitting: string;
  unavailable: string;
  invalid: string;
  existingAccount: string;
  verifyTitle: string;
  verifyLead: string;
  verifyButton: string;
  verifying: string;
  verifyInvalid: string;
  statusTitle: string;
  refresh: string;
  nextAction: string;
  applicationId: string;
  status: string;
  reason: string;
  login: string;
  recovery: string;
  statusLabels: Record<string, string>;
  nextLabels: Record<string, string>;
  workspaces: Array<{ value: string; label: string }>;
  orgTypes: Array<{ value: string; label: string }>;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    workspace: 'Рабочее пространство',
    orgType: 'Тип организации',
    legalName: 'Юридическое наименование',
    inn: 'ИНН',
    kpp: 'КПП',
    ogrn: 'ОГРН / ОГРНИП',
    region: 'Регион',
    fullName: 'ФИО заявителя',
    position: 'Должность',
    phone: 'Телефон',
    email: 'Рабочий email',
    password: 'Пароль',
    passwordHint: 'Не менее 12 символов; строчные, прописные, цифры и специальные знаки.',
    terms: 'пользовательского соглашения',
    privacy: 'политики обработки данных',
    acceptTerms: 'Я принимаю условия',
    acceptPrivacy: 'Я принимаю условия',
    submit: 'Отправить заявку на проверку',
    submitting: 'Отправляем…',
    unavailable: 'Сервис регистрации недоступен. Доступ не создан. Повтори позже.',
    invalid: 'Проверь введённые данные и обязательные согласия.',
    existingAccount: 'Учётная запись уже существует. Используй вход или восстановление доступа.',
    verifyTitle: 'Подтверждение email',
    verifyLead: 'Подтверждение не открывает личный кабинет. После него заявка поступит на проверку организации.',
    verifyButton: 'Подтвердить email',
    verifying: 'Подтверждаем…',
    verifyInvalid: 'Ссылка недействительна, истекла или уже использована.',
    statusTitle: 'Статус заявки',
    refresh: 'Обновить статус',
    nextAction: 'Следующее действие',
    applicationId: 'Заявка',
    status: 'Статус',
    reason: 'Основание',
    login: 'Войти',
    recovery: 'Восстановить доступ',
    statusLabels: {
      EMAIL_VERIFICATION_REQUIRED: 'Требуется подтверждение email',
      ORGANIZATION_VERIFICATION_PENDING: 'Организация ожидает проверки',
      ADDITIONAL_INFORMATION_REQUIRED: 'Требуются уточнения',
      APPROVED: 'Одобрено, выполняется активация',
      ACTIVATED: 'Доступ активирован',
      REJECTED: 'Заявка отклонена',
      SUSPENDED: 'Заявка приостановлена',
      EXPIRED: 'Срок заявки истёк',
      CANCELLED: 'Заявка отменена',
    },
    nextLabels: {
      VERIFY_EMAIL: 'Открой письмо и подтверди email.',
      WAIT_FOR_REVIEW: 'Ожидай решения проверяющего. Доступ в кабинет пока закрыт.',
      PROVIDE_ADDITIONAL_INFORMATION: 'Предоставь запрошенные уточнения.',
      WAIT_FOR_ACTIVATION: 'Ожидай завершения активации.',
      LOGIN: 'Войди с подтверждённой учётной записью.',
      CONTACT_SUPPORT: 'Используй correlation ID при обращении в поддержку.',
      START_NEW_APPLICATION: 'Создай новую заявку.',
      WAIT: 'Ожидай следующего изменения статуса.',
    },
    workspaces: [
      { value: 'seller', label: 'Продавец' },
      { value: 'buyer', label: 'Покупатель' },
      { value: 'logistics', label: 'Логистическая организация' },
      { value: 'driver', label: 'Водитель' },
      { value: 'elevator', label: 'Элеватор или склад' },
      { value: 'lab', label: 'Лаборатория' },
      { value: 'surveyor', label: 'Сюрвейер' },
      { value: 'bank', label: 'Банковский пользователь' },
      { value: 'employee', label: 'Сотрудник существующей организации' },
    ],
    orgTypes: [
      { value: 'LEGAL', label: 'Юридическое лицо' },
      { value: 'INDIVIDUAL', label: 'Индивидуальный предприниматель' },
      { value: 'SELF_EMPLOYED', label: 'Самозанятый' },
    ],
  },
  en: {
    workspace: 'Workspace', orgType: 'Organization type', legalName: 'Legal name', inn: 'Tax ID', kpp: 'KPP', ogrn: 'OGRN / OGRNIP', region: 'Region', fullName: 'Applicant full name', position: 'Position', phone: 'Phone', email: 'Work email', password: 'Password', passwordHint: 'At least 12 characters with lowercase, uppercase, digits and symbols.', terms: 'user agreement', privacy: 'data processing policy', acceptTerms: 'I accept the', acceptPrivacy: 'I accept the', submit: 'Submit application for review', submitting: 'Submitting…', unavailable: 'Registration service is unavailable. No access was created. Try again later.', invalid: 'Check the entered data and required consents.', existingAccount: 'The account already exists. Use sign in or access recovery.', verifyTitle: 'Email confirmation', verifyLead: 'Confirmation does not open a workspace. The organization review begins after confirmation.', verifyButton: 'Confirm email', verifying: 'Confirming…', verifyInvalid: 'The link is invalid, expired or already used.', statusTitle: 'Application status', refresh: 'Refresh status', nextAction: 'Next action', applicationId: 'Application', status: 'Status', reason: 'Reason', login: 'Sign in', recovery: 'Restore access',
    statusLabels: { EMAIL_VERIFICATION_REQUIRED: 'Email confirmation required', ORGANIZATION_VERIFICATION_PENDING: 'Organization review pending', ADDITIONAL_INFORMATION_REQUIRED: 'Additional information required', APPROVED: 'Approved; activation pending', ACTIVATED: 'Access activated', REJECTED: 'Application rejected', SUSPENDED: 'Application suspended', EXPIRED: 'Application expired', CANCELLED: 'Application cancelled' },
    nextLabels: { VERIFY_EMAIL: 'Open the email and confirm your address.', WAIT_FOR_REVIEW: 'Wait for the reviewer decision. Workspace access remains closed.', PROVIDE_ADDITIONAL_INFORMATION: 'Provide the requested information.', WAIT_FOR_ACTIVATION: 'Wait for activation to finish.', LOGIN: 'Sign in with the confirmed account.', CONTACT_SUPPORT: 'Use the correlation ID when contacting support.', START_NEW_APPLICATION: 'Create a new application.', WAIT: 'Wait for the next status change.' },
    workspaces: [{ value: 'seller', label: 'Seller' }, { value: 'buyer', label: 'Buyer' }, { value: 'logistics', label: 'Logistics organization' }, { value: 'driver', label: 'Driver' }, { value: 'elevator', label: 'Elevator or warehouse' }, { value: 'lab', label: 'Laboratory' }, { value: 'surveyor', label: 'Surveyor' }, { value: 'bank', label: 'Bank user' }, { value: 'employee', label: 'Employee of an existing organization' }],
    orgTypes: [{ value: 'LEGAL', label: 'Legal entity' }, { value: 'INDIVIDUAL', label: 'Sole proprietor' }, { value: 'SELF_EMPLOYED', label: 'Self-employed' }],
  },
  zh: {
    workspace: '工作空间', orgType: '组织类型', legalName: '法定名称', inn: '税号', kpp: 'KPP', ogrn: 'OGRN / OGRNIP', region: '地区', fullName: '申请人姓名', position: '职位', phone: '电话', email: '工作邮箱', password: '密码', passwordHint: '至少12个字符，并包含小写字母、大写字母、数字和特殊符号。', terms: '用户协议', privacy: '数据处理政策', acceptTerms: '我接受', acceptPrivacy: '我接受', submit: '提交审核申请', submitting: '正在提交…', unavailable: '注册服务不可用。未创建任何访问权限。请稍后重试。', invalid: '请检查输入内容和必选同意项。', existingAccount: '该账户已存在。请登录或恢复访问权限。', verifyTitle: '确认电子邮箱', verifyLead: '确认邮箱不会直接开放工作空间。确认后将开始组织审核。', verifyButton: '确认电子邮箱', verifying: '正在确认…', verifyInvalid: '链接无效、已过期或已被使用。', statusTitle: '申请状态', refresh: '更新状态', nextAction: '下一步', applicationId: '申请', status: '状态', reason: '原因', login: '登录', recovery: '恢复访问权限',
    statusLabels: { EMAIL_VERIFICATION_REQUIRED: '需要确认电子邮箱', ORGANIZATION_VERIFICATION_PENDING: '等待组织审核', ADDITIONAL_INFORMATION_REQUIRED: '需要补充信息', APPROVED: '已批准，等待激活', ACTIVATED: '访问权限已激活', REJECTED: '申请已拒绝', SUSPENDED: '申请已暂停', EXPIRED: '申请已过期', CANCELLED: '申请已取消' },
    nextLabels: { VERIFY_EMAIL: '打开邮件并确认电子邮箱。', WAIT_FOR_REVIEW: '等待审核决定。工作空间访问仍处于关闭状态。', PROVIDE_ADDITIONAL_INFORMATION: '提交所需补充信息。', WAIT_FOR_ACTIVATION: '等待激活完成。', LOGIN: '使用已确认的账户登录。', CONTACT_SUPPORT: '联系支持时请提供 correlation ID。', START_NEW_APPLICATION: '创建新申请。', WAIT: '等待下一次状态更新。' },
    workspaces: [{ value: 'seller', label: '卖方' }, { value: 'buyer', label: '买方' }, { value: 'logistics', label: '物流组织' }, { value: 'driver', label: '司机' }, { value: 'elevator', label: '粮库或仓库' }, { value: 'lab', label: '实验室' }, { value: 'surveyor', label: '检验员' }, { value: 'bank', label: '银行用户' }, { value: 'employee', label: '现有组织员工' }],
    orgTypes: [{ value: 'LEGAL', label: '法人实体' }, { value: 'INDIVIDUAL', label: '个体经营者' }, { value: 'SELF_EMPLOYED', label: '自雇人员' }],
  },
};

function field(form: FormData, name: string) {
  return String(form.get(name) || '').trim();
}

export function RegisterFormClient({
  locale,
  verifyToken,
  initialStatusToken,
}: {
  locale: Locale;
  verifyToken?: string;
  initialStatusToken?: string;
}) {
  const copy = COPY[locale];
  const idempotencyKey = React.useRef<string>(globalThis.crypto?.randomUUID?.() || `reg-${Date.now()}-${Math.random()}`);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [correlationId, setCorrelationId] = React.useState('');
  const [statusToken, setStatusToken] = React.useState(initialStatusToken || '');
  const [status, setStatus] = React.useState<RegistrationStatus | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(Boolean(initialStatusToken));
  const [verificationCompleted, setVerificationCompleted] = React.useState(false);

  const loadStatus = React.useCallback(async (token: string) => {
    if (!token) return;
    setStatusLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/registration/status?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => ({} as RegistrationStatus & { code?: string }));
      setCorrelationId(String(payload.correlationId || ''));
      if (!response.ok || payload.ok === false) throw new Error('status_failed');
      setStatus(payload);
    } catch {
      setError(copy.unavailable);
    } finally {
      setStatusLoading(false);
    }
  }, [copy.unavailable]);

  React.useEffect(() => {
    if (initialStatusToken) void loadStatus(initialStatusToken);
  }, [initialStatusToken, loadStatus]);

  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    if (form.get('acceptTerms') !== 'yes' || form.get('acceptPrivacy') !== 'yes') {
      setError(copy.invalid);
      return;
    }

    const payload = {
      workspace: field(form, 'workspace'),
      orgType: field(form, 'orgType'),
      orgLegalName: field(form, 'orgLegalName'),
      orgInn: field(form, 'orgInn'),
      orgKpp: field(form, 'orgKpp') || undefined,
      orgOgrn: field(form, 'orgOgrn') || undefined,
      region: field(form, 'region'),
      fullName: field(form, 'fullName'),
      position: field(form, 'position'),
      phone: field(form, 'phone'),
      email: field(form, 'email').toLowerCase(),
      password: field(form, 'password'),
      termsVersion: '2026-07-31',
      privacyVersion: '2026-07-31',
      acceptTerms: true,
      acceptPrivacy: true,
      locale,
    };

    setSubmitting(true);
    setError('');
    setCorrelationId('');
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'idempotency-key': idempotencyKey.current,
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      const result = await response.json().catch(() => ({} as RegistrationStatus & { accepted?: boolean; code?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.accepted !== true || !result.statusToken) {
        if (result.code === 'REGISTRATION_ACCOUNT_ALREADY_EXISTS') throw new Error('existing');
        if (response.status === 400) throw new Error('invalid');
        throw new Error('unavailable');
      }
      setStatusToken(result.statusToken);
      setStatus(result);
      window.history.replaceState(null, '', `/platform-v7/register?statusToken=${encodeURIComponent(result.statusToken)}&lang=${locale}`);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'unavailable';
      setError(reason === 'existing' ? copy.existingAccount : reason === 'invalid' ? copy.invalid : copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyEmail() {
    if (!verifyToken || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/registration/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken }),
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const result = await response.json().catch(() => ({} as RegistrationStatus & { ok?: boolean; code?: string }));
      setCorrelationId(String(result.correlationId || ''));
      if (!response.ok || result.ok !== true || !result.statusToken) throw new Error('verify_failed');
      setVerificationCompleted(true);
      setStatusToken(result.statusToken);
      setStatus(result);
      window.history.replaceState(null, '', `/platform-v7/register?statusToken=${encodeURIComponent(result.statusToken)}&lang=${locale}`);
    } catch {
      setError(copy.verifyInvalid);
    } finally {
      setSubmitting(false);
    }
  }

  if (verifyToken && !verificationCompleted && !status) {
    return (
      <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-verify-title'>
        <ShieldCheck size={40} aria-hidden='true' />
        <h2 id='p0-register-verify-title'>{copy.verifyTitle}</h2>
        <p>{copy.verifyLead}</p>
        {error ? <p className='p0-register-error' role='alert'>{error}{correlationId ? ` ID: ${correlationId}` : ''}</p> : null}
        <button type='button' className='p0-register-primary' onClick={verifyEmail} disabled={submitting} aria-busy={submitting}>
          {submitting ? copy.verifying : copy.verifyButton}
        </button>
      </section>
    );
  }

  if (statusToken || status) {
    const statusCode = String(status?.status || 'EMAIL_VERIFICATION_REQUIRED');
    const nextCode = String(status?.nextAction || 'VERIFY_EMAIL');
    return (
      <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
        {statusCode === 'ACTIVATED' ? <CheckCircle2 size={40} aria-hidden='true' /> : <ShieldCheck size={40} aria-hidden='true' />}
        <h2 id='p0-register-status-title'>{copy.statusTitle}</h2>
        <dl className='p0-register-status-list'>
          <div><dt>{copy.applicationId}</dt><dd>{status?.applicationId || '—'}</dd></div>
          <div><dt>{copy.status}</dt><dd>{copy.statusLabels[statusCode] || statusCode}</dd></div>
          <div><dt>{copy.nextAction}</dt><dd>{copy.nextLabels[nextCode] || nextCode}</dd></div>
          {status?.reason ? <div><dt>{copy.reason}</dt><dd>{status.reason}</dd></div> : null}
        </dl>
        {error ? <p className='p0-register-error' role='alert'>{error}</p> : null}
        {correlationId || status?.correlationId ? <p className='p0-register-correlation'>ID: {correlationId || status?.correlationId}</p> : null}
        <div className='p0-register-actions'>
          <button type='button' className='p0-register-secondary' onClick={() => void loadStatus(statusToken)} disabled={statusLoading || !statusToken}>
            <RefreshCw size={17} aria-hidden='true' />{statusLoading ? '…' : copy.refresh}
          </button>
          {statusCode === 'ACTIVATED' ? <a className='p0-register-primary' href='/platform-v7/login'>{copy.login}</a> : null}
        </div>
      </section>
    );
  }

  return (
    <form className='p0-register-form' onSubmit={submitRegistration} noValidate>
      <section className='p0-register-card'>
        <h2>1. {copy.workspace}</h2>
        <div className='p0-register-grid'>
          <label><span>{copy.workspace}</span><select name='workspace' defaultValue='seller' required>{copy.workspaces.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>{copy.orgType}</span><select name='orgType' defaultValue='LEGAL' required>{copy.orgTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
      </section>

      <section className='p0-register-card'>
        <h2>2. {copy.legalName}</h2>
        <div className='p0-register-grid'>
          <label className='p0-register-wide'><span>{copy.legalName}</span><input name='orgLegalName' minLength={2} maxLength={300} required autoComplete='organization' /></label>
          <label><span>{copy.inn}</span><input name='orgInn' inputMode='numeric' pattern='(?:[0-9]{10}|[0-9]{12})' required /></label>
          <label><span>{copy.kpp}</span><input name='orgKpp' inputMode='numeric' pattern='[0-9]{9}' /></label>
          <label><span>{copy.ogrn}</span><input name='orgOgrn' inputMode='numeric' pattern='(?:[0-9]{13}|[0-9]{15})' /></label>
          <label><span>{copy.region}</span><input name='region' minLength={2} maxLength={160} required autoComplete='address-level1' /></label>
        </div>
      </section>

      <section className='p0-register-card'>
        <h2>3. {copy.fullName}</h2>
        <div className='p0-register-grid'>
          <label><span>{copy.fullName}</span><input name='fullName' minLength={2} maxLength={200} required autoComplete='name' /></label>
          <label><span>{copy.position}</span><input name='position' minLength={2} maxLength={200} required autoComplete='organization-title' /></label>
          <label><span>{copy.phone}</span><input name='phone' type='tel' minLength={7} maxLength={24} required autoComplete='tel' /></label>
          <label><span>{copy.email}</span><input name='email' type='email' maxLength={254} required autoComplete='email' autoCapitalize='none' spellCheck={false} /></label>
          <label className='p0-register-wide'><span>{copy.password}</span><input name='password' type='password' minLength={12} maxLength={128} required autoComplete='new-password' aria-describedby='p0-register-password-hint' /><small id='p0-register-password-hint'>{copy.passwordHint}</small></label>
        </div>
      </section>

      <section className='p0-register-card p0-register-consents'>
        <label><input name='acceptTerms' type='checkbox' value='yes' required /><span>{copy.acceptTerms} <a href='/platform-v7/terms' target='_blank' rel='noreferrer'>{copy.terms}</a>.</span></label>
        <label><input name='acceptPrivacy' type='checkbox' value='yes' required /><span>{copy.acceptPrivacy} <a href='/platform-v7/privacy' target='_blank' rel='noreferrer'>{copy.privacy}</a>.</span></label>
      </section>

      {error ? <p className='p0-register-error' role='alert'>{error}{correlationId ? ` ID: ${correlationId}` : ''}</p> : null}
      <button className='p0-register-primary p0-register-submit' type='submit' disabled={submitting} aria-busy={submitting}>
        {submitting ? copy.submitting : copy.submit}
      </button>
      <div className='p0-register-help-links'>
        <a href='/platform-v7/login'>{copy.login}</a>
        <a href='/platform-v7/forgot-password'>{copy.recovery}</a>
      </div>
    </form>
  );
}
